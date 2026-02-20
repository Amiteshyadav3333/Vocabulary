'use client';
import { useState, useEffect, useRef } from 'react';

export default function Game() {
  const [mounted, setMounted] = useState(false);

  // Network States
  const [networkPhase, setNetworkPhase] = useState('menu'); // 'menu', 'setup', 'playing', 'ended'
  const [roomId, setRoomId] = useState('');
  const [playerIndex, setPlayerIndex] = useState(null); // 0 for Host, 1 for Guest
  const [roomUrl, setRoomUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected 🔴');

  // Game States
  const [players, setPlayers] = useState([
    { name: '', emoji: '😀', score: 0, missedTurns: 0 },
    { name: '', emoji: '😎', score: 0, missedTurns: 0 }
  ]);
  const [targetScore, setTargetScore] = useState(100);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [turnPhase, setTurnPhase] = useState('place_letter');
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedCells, setSelectedCells] = useState([]);
  const [claimedWords, setClaimedWords] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [messages, setMessages] = useState([]);
  const [board, setBoard] = useState(Array(10).fill(null).map(() => Array(10).fill('')));
  const [chatInput, setChatInput] = useState('');

  const timerRef = useRef(null);

  // Refs for callbacks
  const stateRef = useRef();
  const peerRef = useRef(null);
  const connRef = useRef(null);

  const emojis = ['😀', '😎', '🎮', '🚀', '⭐', '🔥', '💎', '🎯', '🏆', '👑', '🎨', '🌟', '💪', '🎭', '🦄', '🐉', '🌈', '⚡', '🎪', '🎸'];
  const chatEmojis = ['😊', '😂', '🤣', '😍', '🥳', '😱', '🤔', '👍', '👏', '🙌', '💯', '🔥', '❤️', '✨', '🎉', '😅', '😎', '🤩', '😜', '🤗'];

  // Sync state reference for PeerJS callbacks
  useEffect(() => {
    stateRef.current = {
      networkPhase, players, targetScore, currentPlayer,
      turnPhase, timeLeft, selectedCells, claimedWords, currentWord, messages, board
    };
  });

  const applyUpdates = (updates) => {
    if ('networkPhase' in updates) setNetworkPhase(updates.networkPhase);
    if ('players' in updates) setPlayers(updates.players);
    if ('targetScore' in updates) setTargetScore(updates.targetScore);
    if ('currentPlayer' in updates) setCurrentPlayer(updates.currentPlayer);
    if ('turnPhase' in updates) setTurnPhase(updates.turnPhase);
    if ('timeLeft' in updates) setTimeLeft(updates.timeLeft);
    if ('selectedCells' in updates) setSelectedCells(updates.selectedCells);
    if ('claimedWords' in updates) setClaimedWords(updates.claimedWords);
    if ('currentWord' in updates) setCurrentWord(updates.currentWord);
    if ('messages' in updates) setMessages(updates.messages);
    if ('board' in updates) setBoard(updates.board);
  };

  const emitUpdate = (updates) => {
    applyUpdates(updates);
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'UPDATE', updates });
    }
  };

  const setupConnection = (conn, isHost) => {
    connRef.current = conn;
    conn.on('open', () => {
      setConnectionStatus('Connected! 🟢');
      if (isHost) {
        conn.send({ type: 'SYNC', state: stateRef.current });
      }
    });

    conn.on('data', (data) => {
      if (data.type === 'SYNC') {
        applyUpdates(data.state);
      } else if (data.type === 'UPDATE') {
        applyUpdates(data.updates);
      }
    });

    conn.on('close', () => {
      setConnectionStatus('Disconnected 🔴');
    });

    conn.on('error', (err) => {
      console.error("Connection Error:", err);
    });
  };

  useEffect(() => {
    setMounted(true);

    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      const cleanRoom = roomFromUrl.toUpperCase();
      setRoomId(cleanRoom);
      joinRoomBtn(cleanRoom);
      window.history.pushState({}, document.title, window.location.pathname);
    }

    return () => {
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const createRoom = async () => {
    try {
      const Peer = (await import('peerjs')).default;
      const newRoom = Math.random().toString(36).substring(2, 7).toUpperCase();
      setRoomId(newRoom);
      setPlayerIndex(0); // I am Host
      setNetworkPhase('setup');
      setConnectionStatus('Waiting for Player 2...');

      const u = new URL(window.location.href);
      u.searchParams.set('room', newRoom);
      setRoomUrl(u.toString());

      const peer = new Peer(`VOCAB-${newRoom}`);
      peerRef.current = peer;

      peer.on('connection', (conn) => {
        setupConnection(conn, true);
      });

      peer.on('error', err => {
        alert('Peer error: ' + err.message);
      });
    } catch (e) {
      console.error("Failed to load Peer", e);
    }
  };

  const joinRoomBtn = async (overrideRoomId = null) => {
    const targetRoom = (overrideRoomId || roomId).trim().toUpperCase();
    if (!targetRoom) return;
    setRoomId(targetRoom);
    setPlayerIndex(1); // I am Guest
    setNetworkPhase('setup');
    setConnectionStatus('Connecting to Host...');

    try {
      const Peer = (await import('peerjs')).default;
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', () => {
        const conn = peer.connect(`VOCAB-${targetRoom}`);
        setupConnection(conn, false);
      });

      peer.on('error', (err) => {
        alert('Failed to connect to room. Make sure the code is correct!');
        setConnectionStatus('Connection Failed 🔴');
      });
    } catch (e) {
      console.error("Failed to load Peer", e);
    }
  };

  // Timer Tick - Completely driven locally to avoid latency jitter on clock update
  useEffect(() => {
    if (networkPhase === 'playing') {
      timerRef.current = setInterval(() => {
        if (playerIndex === 0) { // Keep time in sync by only sending ticks from host occasionally, but we trust local decrements mostly
          setTimeLeft(prev => {
            const nextTime = prev - 1;
            // Every 5 seconds host broadcasts the exact time to prevent drift
            if (nextTime % 5 === 0) {
              if (connRef.current && connRef.current.open) {
                connRef.current.send({ type: 'UPDATE', updates: { timeLeft: nextTime } });
              }
            }
            return nextTime;
          });
        } else if (playerIndex === 1) {
          setTimeLeft(prev => prev - 1);
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [networkPhase, currentPlayer, turnPhase]); // re-bind to sync

  // Timer Expiration Logic (Only Host fires this rule)
  useEffect(() => {
    if (networkPhase === 'playing' && timeLeft <= 0 && playerIndex === 0) {
      handleTimeout();
    }
  }, [timeLeft, networkPhase, playerIndex]);

  const handleTimeout = () => {
    const s = stateRef.current;
    const currP = s.currentPlayer;
    const newPlayers = [...s.players];
    newPlayers[currP] = { ...newPlayers[currP], missedTurns: newPlayers[currP].missedTurns + 1 };

    if (newPlayers[currP].missedTurns >= 5) {
      const msg = `⏰ ${newPlayers[1 - currP].emoji} ${newPlayers[1 - currP].name} wins! Opponent missed 5 turns.`;
      emitUpdate({
        networkPhase: 'ended',
        players: newPlayers,
        messages: [...s.messages, { text: msg, time: new Date().toLocaleTimeString() }]
      });
    } else {
      const msg = `⏰ ${newPlayers[currP].emoji} ${newPlayers[currP].name} ran out of time!`;
      emitUpdate({
        players: newPlayers,
        messages: [...s.messages, { text: msg, time: new Date().toLocaleTimeString() }],
        currentPlayer: 1 - currP,
        timeLeft: 60,
        selectedCells: [],
        currentWord: '',
        turnPhase: 'place_letter'
      });
    }
  };

  const endTurn = () => {
    if (playerIndex !== currentPlayer) return;
    emitUpdate({
      currentPlayer: 1 - currentPlayer,
      timeLeft: 60,
      selectedCells: [],
      currentWord: '',
      turnPhase: 'place_letter'
    });
  };

  const handleCellClick = (row, col) => {
    if (playerIndex !== currentPlayer) return; // Prevent opponent taking ghost acts

    const cellId = `${row}-${col}`;
    const cellContent = board[row][col];

    if (turnPhase === 'place_letter') {
      if (cellContent !== '') return;
      emitUpdate({ selectedCells: [{ id: cellId, row, col }] });
    } else if (turnPhase === 'claim_word') {
      if (cellContent === '') return;

      const lastCell = selectedCells[selectedCells.length - 1];
      if (selectedCells.length > 0 && lastCell) {
        const [lastRow, lastCol] = lastCell.id.split('-').map(Number);
        const rowDiff = row - lastRow;
        const colDiff = col - lastCol;

        if (selectedCells.length > 1) {
          const firstCell = selectedCells[0];
          const isHorizontal = firstCell.row === row;
          const isVertical = firstCell.col === col;
          if (!isHorizontal && !isVertical) return;
        }

        const isAdjacent = (Math.abs(rowDiff) === 1 && colDiff === 0) || (Math.abs(colDiff) === 1 && rowDiff === 0);
        if (!isAdjacent && selectedCells.length > 0) return;
      }

      const isSelected = selectedCells.some(c => c.id === cellId);
      if (isSelected) return;

      const newSelected = [...selectedCells, { id: cellId, row, col }];
      const word = newSelected.map(c => board[c.row][c.col]).join('');
      // Live sync
      emitUpdate({ selectedCells: newSelected, currentWord: word });
    }
  };

  const handleLetterInput = (row, col, letter) => {
    if (playerIndex !== currentPlayer) return;
    if (turnPhase !== 'place_letter') return;
    if (!letter.trim()) return;

    if (!/^[a-zA-Z]$/.test(letter)) {
      emitUpdate({
        messages: [...stateRef.current.messages, { text: `⚠️ Only English letters (A-Z) are allowed!`, time: new Date().toLocaleTimeString() }]
      });
      return;
    }

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = letter.toUpperCase();

    emitUpdate({
      board: newBoard,
      selectedCells: [],
      currentWord: '',
      turnPhase: 'claim_word'
    });
  };

  const claimWordPoints = () => {
    if (playerIndex !== currentPlayer) return;
    if (currentWord.length < 2) return;

    if (claimedWords.includes(currentWord)) {
      emitUpdate({
        messages: [...stateRef.current.messages, { text: `⚠️ The word "${currentWord}" has already been claimed!`, time: new Date().toLocaleTimeString() }],
        selectedCells: [],
        currentWord: ''
      });
      return;
    }

    const points = currentWord.length;
    const newPlayers = [...players];
    newPlayers[currentPlayer] = { ...newPlayers[currentPlayer], score: newPlayers[currentPlayer].score + points, missedTurns: 0 };

    const newClaimed = [...claimedWords, currentWord];
    const newMsgs = [...stateRef.current.messages, { text: `🌟 ${newPlayers[currentPlayer].emoji} ${newPlayers[currentPlayer].name} claimed "${currentWord}" (+${points} pts)`, time: new Date().toLocaleTimeString() }];

    const winThreshold = Math.floor(targetScore / 2) + 1;
    if (newPlayers[currentPlayer].score >= winThreshold) {
      newMsgs.push({ text: `🏆 ${newPlayers[currentPlayer].emoji} ${newPlayers[currentPlayer].name} wins!`, time: new Date().toLocaleTimeString() });
      emitUpdate({
        networkPhase: 'ended',
        players: newPlayers,
        claimedWords: newClaimed,
        messages: newMsgs
      });
      return;
    }

    emitUpdate({
      players: newPlayers,
      claimedWords: newClaimed,
      messages: newMsgs,
      currentPlayer: 1 - currentPlayer,
      timeLeft: 60,
      selectedCells: [],
      currentWord: '',
      turnPhase: 'place_letter'
    });
  };

  const sendChat = () => {
    if (chatInput.trim()) {
      const s = stateRef.current;
      const myPlayer = s.players[playerIndex] || s.players[0];
      const newMsg = { text: `${myPlayer.emoji} ${myPlayer.name}: ${chatInput}`, time: new Date().toLocaleTimeString() };
      emitUpdate({ messages: [...s.messages, newMsg] });
      setChatInput('');
    }
  };

  const resetSelection = () => {
    if (playerIndex !== currentPlayer) return;
    emitUpdate({ selectedCells: [], currentWord: '' });
  };

  if (!mounted) return null;

  // Render Logic
  if (networkPhase === 'menu') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title} className="titleResponsive">🌐 Vocabulary Battle Online</h1>
        <div style={{ ...styles.setupBox, textAlign: 'center' }} className="setupBoxResponsive">
          <button style={styles.startBtn} onClick={createRoom}>🏠 Create New Room (Host Game)</button>

          <div style={{ margin: '40px 0', fontSize: '24px', fontWeight: 'bold', color: '#666' }}>OR</div>

          <div style={{ background: '#f8f9ff', padding: '20px', borderRadius: '15px', border: '2px solid #ddd' }}>
            <input
              style={{ ...styles.input, textAlign: 'center', fontSize: '24px', letterSpacing: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}
              placeholder="Enter 5-Letter Code"
              maxLength={5}
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
            />
            <button style={{ ...styles.startBtn, background: '#4caf50' }} onClick={() => joinRoomBtn()}>🔗 Join Existing Room</button>
          </div>
        </div>
      </div>
    );
  }

  if (networkPhase === 'setup') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title} className="titleResponsive">🌐 Multiplayer Waiting...</h1>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ color: 'white', background: 'rgba(0,0,0,0.5)', display: 'inline-block', padding: '10px 30px', borderRadius: '15px' }}>
            Room Code: <span style={{ color: '#ffeb3b', letterSpacing: '2px' }}>{roomId}</span>
          </h2>

          {playerIndex === 0 && (
            <div style={{ marginTop: '15px' }}>
              <button style={{ padding: '10px 20px', background: '#e91e63', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}
                onClick={() => navigator.clipboard.writeText(roomUrl || window.location.href)}>
                📋 Copy Direct Invite Link
              </button>
            </div>
          )}
          <p style={{ color: 'white', marginTop: '15px', fontSize: '18px' }}>
            {connectionStatus}
          </p>
        </div>

        <div style={styles.setupBox} className="setupBoxResponsive">
          {players.map((p, i) => (
            <div key={i} style={{ ...styles.playerSetup, opacity: playerIndex !== i ? 0.3 : 1 }}>
              <h3>Player {i + 1} {playerIndex === i ? '(You)' : ''} {playerIndex !== i ? '(Opponent)' : ''}</h3>
              <input
                style={styles.input}
                placeholder={playerIndex === i ? "Enter your name" : "Waiting for player..."}
                value={p.name}
                disabled={playerIndex !== i}
                onChange={(e) => {
                  const newPlayers = [...players];
                  newPlayers[i].name = e.target.value;
                  emitUpdate({ players: newPlayers });
                }}
              />
              <div style={styles.emojiGrid} className="emojiGridResponsive">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    disabled={playerIndex !== i}
                    style={{ ...styles.emojiBtn, ...(p.emoji === emoji ? styles.selectedEmoji : {}) }}
                    onClick={() => {
                      const newPlayers = [...players];
                      newPlayers[i].emoji = emoji;
                      emitUpdate({ players: newPlayers });
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {playerIndex === 0 ? (
            <div style={{ marginTop: '30px', padding: '20px', borderTop: '2px dashed #ccc' }}>
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <label style={{ color: 'black', fontSize: '18px', fontWeight: 'bold' }}>Target Score (Chat with opponent): </label>
                <input
                  type="number"
                  style={{ ...styles.input, width: '100px', display: 'inline-block', marginLeft: '10px', marginBottom: '0' }}
                  value={targetScore}
                  onChange={(e) => emitUpdate({ targetScore: Number(e.target.value) })}
                />
              </div>
              <button
                style={{ ...styles.startBtn, opacity: (!players[0].name || !players[1].name) ? 0.5 : 1 }}
                onClick={() => {
                  if (players[0].name && players[1].name && targetScore > 0) {
                    emitUpdate({
                      networkPhase: 'playing',
                      turnPhase: 'place_letter',
                      messages: [...messages, { text: `🎮 Game started! First to ${Math.floor(targetScore / 2) + 1} points wins!`, time: new Date().toLocaleTimeString() }]
                    });
                  }
                }}
              >
                🎮 Start Game Now
              </button>
              {(!players[0].name || !players[1].name) && <p style={{ textAlign: 'center', color: '#e91e63' }}>Waiting for both players to arrange names to start.</p>}
            </div>
          ) : (
            <div style={{ marginTop: '30px', padding: '20px', textAlign: 'center', background: '#ffeacc', borderRadius: '12px' }}>
              <h3 style={{ color: '#ff9800', margin: 0 }}>Target Score: {targetScore}</h3>
              <p style={{ color: 'black', margin: '10px 0 0 0' }}>Only the Host can start the game.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (networkPhase === 'ended') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>🏆 Game Over!</h1>
        <div style={styles.scoreBoard} className="scoreBoardResponsive">
          {players.map((p, i) => (
            <div key={i} style={styles.finalScore}>
              <span style={styles.bigEmoji}>{p.emoji}</span>
              <h2 style={{ color: 'black' }}>{p.name}</h2>
              <h1 style={{ color: 'black' }}>{p.score} pts</h1>
            </div>
          ))}
        </div>

        {playerIndex === 0 ? (
          <button style={{ ...styles.startBtn, maxWidth: '500px', display: 'block', margin: '0 auto' }} onClick={() => {
            emitUpdate({
              players: [
                { ...players[0], score: 0, missedTurns: 0 },
                { ...players[1], score: 0, missedTurns: 0 }
              ],
              networkPhase: 'setup',
              messages: [],
              claimedWords: [],
              board: Array(10).fill(null).map(() => Array(10).fill(''))
            });
          }}>Restart Lobby (Host)</button>
        ) : (
          <h3 style={{ color: 'white', textAlign: 'center' }}>Waiting for Host to restart game...</h3>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header} className="headerResponsive">
        <div style={styles.playerInfo} className="playerInfoResponsive">
          {players.map((p, i) => (
            <div key={i} style={{ ...styles.playerCard, ...(currentPlayer === i ? styles.activePlayer : {}), opacity: currentPlayer === i ? 1 : 0.6 }}>
              <span style={styles.playerEmoji}>{p.emoji}</span>
              <div>
                <div style={styles.playerName}>{p.name}  {playerIndex === i ? '(You)' : ''}</div>
                <div style={styles.score}>{p.score} / {Math.floor(targetScore / 2) + 1} (to win)</div>
                <div style={styles.missedTurns}>Missed: {p.missedTurns}/5</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={styles.timer} className="timerResponsive">⏱️ {timeLeft}s</div>
          <strong style={{ color: '#ffeb3b', marginTop: '5px', background: 'rgba(0,0,0,0.3)', padding: '5px 15px', borderRadius: '10px' }}>Room: {roomId}</strong>
        </div>
      </div>

      <div style={styles.gameArea} className="gameAreaResponsive">
        <div style={styles.playArea}>
          <h2 style={styles.turnHeader}>
            {players[currentPlayer].emoji} {playerIndex === currentPlayer ? "It's Your Turn!" : `${players[currentPlayer].name}'s Turn (Waiting...)`}
          </h2>
          <div style={styles.instructions}>
            {turnPhase === 'place_letter' ?
              "📝 Phase 1: Click an EMPTY box & type ONE letter!" :
              "🎯 Phase 2: Select adjacent letters (horizontally or vertically) to claim points!"
            }
          </div>

          <div style={{ opacity: playerIndex !== currentPlayer ? 0.6 : 1, pointerEvents: playerIndex !== currentPlayer ? 'none' : 'auto' }}>
            <div style={styles.boardContainer}>
              <div style={styles.grid} className="gridResponsive">
                {board.map((row, rowIdx) => (
                  <div key={rowIdx} style={styles.row}>
                    {row.map((cell, colIdx) => {
                      const cellId = `${rowIdx}-${colIdx}`;
                      const isSelected = selectedCells.some(c => c.id === cellId);
                      const selectedIndex = selectedCells.findIndex(c => c.id === cellId);
                      return (
                        <div
                          key={colIdx}
                          style={{
                            ...styles.cell,
                            ...(isSelected ? styles.selectedCell : {})
                          }}
                          onClick={() => handleCellClick(rowIdx, colIdx)}
                        >
                          {isSelected && (
                            <span style={styles.cellNumber}>{selectedIndex + 1}</span>
                          )}
                          {isSelected && turnPhase === 'place_letter' ? (
                            <input
                              style={styles.cellInput}
                              maxLength={1}
                              value={cell}
                              onChange={(e) => handleLetterInput(rowIdx, colIdx, e.target.value)}
                              autoFocus
                            />
                          ) : (
                            cell || ''
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.wordDisplay}>
              <div style={styles.formedWord}>
                Word: <strong style={{ color: '#4caf50' }}>{currentWord || '...'}</strong>
              </div>
            </div>

            {turnPhase === 'claim_word' && (
              <div style={styles.claimSection}>
                {currentWord && currentWord.length >= 2 ? (
                  <button
                    style={{
                      padding: '20px',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      width: '100%',
                      boxShadow: '0 4px 8px rgba(76, 175, 80, 0.3)',
                      marginBottom: '15px'
                    }}
                    onClick={claimWordPoints}
                  >
                    🎯 Claim &quot;{currentWord}&quot; for {currentWord.length} pts!
                  </button>
                ) : (
                  <div style={{ color: '#999', fontSize: '18px', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                    Select at least 2 letters horizontally or vertically!
                  </div>
                )}

                <button
                  style={{ ...styles.resetBtn, background: '#6c757d' }}
                  onClick={endTurn}
                >
                  ⏭️ End Turn (Skip Claiming)
                </button>
              </div>
            )}

            {turnPhase === 'place_letter' && (
              <button
                style={styles.resetBtn}
                onClick={resetSelection}
              >
                🔄 Reset Selection
              </button>
            )}
          </div>
        </div>

        <div style={styles.chatArea}>
          <h3 style={{ color: 'black', margin: '0 0 15px 0' }}>💬 Live Net-Chat ({connectionStatus})</h3>
          <div style={styles.messages}>
            {messages.map((msg, i) => (
              <div key={i} style={styles.message}>
                <span style={styles.time}>{msg.time}</span> {msg.text}
              </div>
            ))}
          </div>
          <div style={styles.emojiPicker}>
            {chatEmojis.map(emoji => (
              <button
                key={emoji}
                style={styles.chatEmojiBtn}
                onClick={() => setChatInput(prev => prev + emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div style={styles.chatInputArea}>
            <input
              style={styles.chatInputBox}
              placeholder="Type cross-device message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChat()}
            />
            <button style={styles.sendBtn} onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    textAlign: 'center',
    color: 'white',
    fontSize: '3em',
    marginBottom: '30px',
  },
  setupBox: {
    maxWidth: '800px',
    margin: '0 auto',
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
  },
  playerSetup: {
    marginBottom: '30px',
    transition: 'opacity 0.3s'
  },
  input: {
    width: '100%',
    padding: '15px',
    fontSize: '18px',
    borderRadius: '10px',
    border: '2px solid #ddd',
    marginBottom: '15px',
  },
  emojiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: '10px',
  },
  emojiBtn: {
    fontSize: '30px',
    padding: '10px',
    border: '2px solid #ddd',
    borderRadius: '10px',
    background: 'white',
    cursor: 'pointer',
  },
  selectedEmoji: {
    border: '3px solid #667eea',
    background: '#f0f0ff',
  },
  startBtn: {
    width: '100%',
    padding: '20px',
    fontSize: '24px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '15px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  playerInfo: {
    display: 'flex',
    gap: '20px',
  },
  playerCard: {
    background: 'rgba(255,255,255,0.2)',
    padding: '15px',
    borderRadius: '15px',
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    color: 'white',
    transition: 'all 0.3s',
  },
  activePlayer: {
    background: 'rgba(255,255,255,0.4)',
    border: '3px solid white',
    transform: 'scale(1.05)'
  },
  playerEmoji: {
    fontSize: '40px',
  },
  playerName: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  score: {
    fontSize: '16px',
  },
  missedTurns: {
    fontSize: '12px',
    opacity: 0.8,
  },
  timer: {
    fontSize: '36px',
    color: 'white',
    fontWeight: 'bold',
  },
  gameArea: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '20px',
  },
  playArea: {
    background: 'white',
    borderRadius: '20px',
    padding: '30px',
    minHeight: '400px',
    transition: 'opacity 0.3s'
  },
  turnHeader: {
    margin: '0 0 15px 0',
    fontSize: '28px',
    color: '#667eea',
  },
  instructions: {
    background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    padding: '12px',
    borderRadius: '10px',
    marginBottom: '20px',
    fontSize: '15px',
    color: '#0d47a1',
    textAlign: 'center',
    fontWeight: '500',
  },
  boardContainer: {
    marginBottom: '20px',
    overflowX: 'visible',
    display: 'flex',
    justifyContent: 'center',
  },
  grid: {
    display: 'inline-block',
    border: '2px solid #667eea',
    borderRadius: '10px',
    padding: '5px',
    background: '#f8f9ff',
  },
  row: {
    display: 'flex',
  },
  cell: {
    width: '45px',
    height: '45px',
    border: '1px solid #ddd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: 'white',
    fontSize: '20px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    position: 'relative',
    color: 'black'
  },
  selectedCell: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: '2px solid #4c51bf',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.5)',
    transform: 'scale(1.05)',
  },
  cellNumber: {
    position: 'absolute',
    top: '2px',
    left: '4px',
    fontSize: '10px',
    background: 'rgba(255,255,255,0.3)',
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInput: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'white',
    outline: 'none',
    textTransform: 'uppercase',
  },
  wordDisplay: {
    background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%)',
    padding: '20px',
    borderRadius: '15px',
    marginTop: '20px',
    marginBottom: '20px',
    border: '3px solid #667eea',
  },
  formedWord: {
    fontSize: '24px',
    textAlign: 'center',
    color: '#333',
  },
  claimSection: {
    background: '#fff9e6',
    padding: '20px',
    borderRadius: '15px',
    border: '2px solid #ffc107',
    marginBottom: '15px',
  },
  resetBtn: {
    width: '100%',
    padding: '15px',
    fontSize: '18px',
    background: '#ff6b6b',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },
  chatArea: {
    background: 'white',
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '600px',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '15px',
    maxHeight: '350px',
    borderBottom: '1px solid #ccc',
    paddingBottom: '10px'
  },
  message: {
    padding: '8px',
    marginBottom: '5px',
    background: '#f0f0f0',
    color: 'black',
    borderRadius: '8px',
    fontSize: '15px',
  },
  time: {
    fontSize: '11px',
    color: '#888',
    marginRight: '5px'
  },
  emojiPicker: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: '5px',
    marginBottom: '10px',
  },
  chatEmojiBtn: {
    fontSize: '20px',
    padding: '5px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  chatInputArea: {
    display: 'flex',
    gap: '10px',
  },
  chatInputBox: {
    flex: 1,
    padding: '10px',
    borderRadius: '10px',
    border: '2px solid #ddd',
    color: 'black'
  },
  sendBtn: {
    padding: '10px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  scoreBoard: {
    display: 'flex',
    justifyContent: 'center',
    gap: '50px',
    marginBottom: '40px',
  },
  finalScore: {
    background: 'white',
    padding: '40px',
    borderRadius: '20px',
    textAlign: 'center',
    boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
  },
  bigEmoji: {
    fontSize: '80px',
  },
};
