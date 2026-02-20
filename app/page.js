'use client';
import { useState, useEffect, useRef } from 'react';

export default function Game() {
  const [mounted, setMounted] = useState(false);
  const [gameState, setGameState] = useState('setup');
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
  const [meaning, setMeaning] = useState('');
  const [showMeaningInput, setShowMeaningInput] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [board, setBoard] = useState(Array(10).fill(null).map(() => Array(10).fill('')));
  const timerRef = useRef(null);

  const emojis = ['😀', '😎', '🎮', '🚀', '⭐', '🔥', '💎', '🎯', '🏆', '👑', '🎨', '🌟', '💪', '🎭', '🦄', '🐉', '🌈', '⚡', '🎪', '🎸'];
  const chatEmojis = ['😊', '😂', '🤣', '😍', '🥳', '😱', '🤔', '👍', '👏', '🙌', '💯', '🔥', '❤️', '✨', '🎉', '😅', '😎', '🤩', '😜', '🤗'];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft <= 0) {
      handleTimeout();
    }
  }, [timeLeft, gameState]);

  const handleTimeout = () => {
    const newPlayers = [...players];
    newPlayers[currentPlayer].missedTurns++;
    if (newPlayers[currentPlayer].missedTurns >= 5) {
      setGameState('ended');
      addMessage(`${newPlayers[1 - currentPlayer].emoji} ${newPlayers[1 - currentPlayer].name} wins! Opponent missed 5 turns.`);
    } else {
      addMessage(`⏰ ${players[currentPlayer].emoji} ${players[currentPlayer].name} ran out of time!`);
      setPlayers(newPlayers);
      endTurn();
    }
  };

  const startGame = () => {
    if (players[0].name && players[1].name && targetScore > 0) {
      setGameState('playing');
      setTurnPhase('place_letter');
      addMessage(`🎮 Game started! First to ${Math.floor(targetScore / 2) + 1} points (more than half of ${targetScore}) wins!`);
    }
  };

  const endTurn = () => {
    setCurrentPlayer(prev => 1 - prev);
    setTimeLeft(60);
    setSelectedCells([]);
    setCurrentWord('');
    setTurnPhase('place_letter');
  };

  const handleCellClick = (row, col) => {
    const cellId = `${row}-${col}`;
    const cellContent = board[row][col];

    if (turnPhase === 'place_letter') {
      if (cellContent !== '') return;
      setSelectedCells([{ id: cellId, row, col }]);
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
      setSelectedCells(newSelected);

      const word = newSelected.map(c => board[c.row][c.col]).join('');
      setCurrentWord(word);
    }
  };

  const handleLetterInput = (row, col, letter) => {
    if (turnPhase !== 'place_letter') return;
    if (!letter.trim()) return;

    if (!/^[a-zA-Z]$/.test(letter)) {
      addMessage(`⚠️ Only English letters (A-Z) are allowed!`);
      return;
    }

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = letter.toUpperCase();
    setBoard(newBoard);

    setSelectedCells([]);
    setCurrentWord('');
    setTurnPhase('claim_word');
  };

  const claimWordPoints = () => {
    if (currentWord.length < 2) return;

    if (claimedWords.includes(currentWord)) {
      addMessage(`⚠️ The word "${currentWord}" has already been claimed!`);
      setSelectedCells([]);
      setCurrentWord('');
      return;
    }

    const points = currentWord.length;
    const newPlayers = [...players];
    newPlayers[currentPlayer].score += points;
    newPlayers[currentPlayer].missedTurns = 0;
    setPlayers(newPlayers);
    setClaimedWords(prev => [...prev, currentWord]);

    addMessage(`🌟 ${players[currentPlayer].emoji} ${players[currentPlayer].name} claimed "${currentWord}" (+${points} pts)`);

    const winThreshold = Math.floor(targetScore / 2) + 1;
    if (newPlayers[currentPlayer].score >= winThreshold) {
      setGameState('ended');
      addMessage(`🏆 ${players[currentPlayer].emoji} ${players[currentPlayer].name} wins!`);
      return;
    }

    endTurn();
  };



  const addMessage = (msg) => {
    setMessages(prev => [...prev, { text: msg, time: new Date().toLocaleTimeString() }]);
  };

  const sendChat = () => {
    if (chatInput.trim()) {
      addMessage(`${players[currentPlayer].emoji} ${players[currentPlayer].name}: ${chatInput}`);
      setChatInput('');
    }
  };

  if (!mounted) return null;

  if (gameState === 'setup') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title} className="titleResponsive">🎮 Vocabulary Battle</h1>
        <div style={styles.setupBox} className="setupBoxResponsive">
          {players.map((p, i) => (
            <div key={i} style={styles.playerSetup}>
              <h3>Player {i + 1}</h3>
              <input
                style={styles.input}
                placeholder="Enter name"
                value={p.name}
                onChange={(e) => {
                  const newPlayers = [...players];
                  newPlayers[i].name = e.target.value;
                  setPlayers(newPlayers);
                }}
              />
              <div style={styles.emojiGrid} className="emojiGridResponsive">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    style={{ ...styles.emojiBtn, ...(p.emoji === emoji ? styles.selectedEmoji : {}) }}
                    onClick={() => {
                      const newPlayers = [...players];
                      newPlayers[i].emoji = emoji;
                      setPlayers(newPlayers);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <label style={{ color: 'black', fontSize: '18px', fontWeight: 'bold' }}>Total Points (Decide in chat): </label>
            <input
              type="number"
              style={{ ...styles.input, width: '100px', display: 'inline-block', marginLeft: '10px', marginBottom: '0' }}
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
            />
          </div>
          <button style={styles.startBtn} onClick={startGame}>Start Game</button>
        </div>
      </div>
    );
  }

  if (gameState === 'ended') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>🏆 Game Over!</h1>
        <div style={styles.scoreBoard}>
          {players.map((p, i) => (
            <div key={i} style={styles.finalScore}>
              <span style={styles.bigEmoji}>{p.emoji}</span>
              <h2>{p.name}</h2>
              <h1>{p.score} pts</h1>
            </div>
          ))}
        </div>
        <button style={styles.startBtn} onClick={() => {
          setPlayers([
            { ...players[0], score: 0, missedTurns: 0 },
            { ...players[1], score: 0, missedTurns: 0 }
          ]);
          setGameState('setup');
          setMessages([]);
          setClaimedWords([]);
          setBoard(Array(10).fill(null).map(() => Array(10).fill('')));
        }}>New Game</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header} className="headerResponsive">
        <div style={styles.playerInfo} className="playerInfoResponsive">
          {players.map((p, i) => (
            <div key={i} style={{ ...styles.playerCard, ...(currentPlayer === i ? styles.activePlayer : {}) }}>
              <span style={styles.playerEmoji}>{p.emoji}</span>
              <div>
                <div style={styles.playerName}>{p.name}</div>
                <div style={styles.score}>{p.score} / {Math.floor(targetScore / 2) + 1} (to win)</div>
                <div style={styles.missedTurns}>Missed: {p.missedTurns}/5</div>
              </div>
            </div>
          ))}
        </div>
        <div style={styles.timer} className="timerResponsive">⏱️ {timeLeft}s</div>
      </div>

      <div style={styles.gameArea} className="gameAreaResponsive">
        <div style={styles.playArea}>
          <h2 style={styles.turnHeader}>
            {players[currentPlayer].emoji} {players[currentPlayer].name}&apos;s Turn
          </h2>
          <div style={styles.instructions}>
            {turnPhase === 'place_letter' ?
              "📝 Phase 1: Click an EMPTY box & type ONE letter!" :
              "🎯 Phase 2: Select adjacent letters (horizontally or vertically) to claim points!"
            }
          </div>

          <div>
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
                Word: <strong>{currentWord || '...'}</strong>
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
                onClick={() => {
                  setSelectedCells([]);
                }}
              >
                🔄 Reset Selection
              </button>
            )}
          </div>
        </div>

        <div style={styles.chatArea}>
          <h3>💬 Chat</h3>
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
              placeholder="Type message..."
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
  },
  playerSetup: {
    marginBottom: '30px',
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
  },
  activePlayer: {
    background: 'rgba(255,255,255,0.4)',
    border: '3px solid white',
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
  claimTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#f57c00',
    textAlign: 'center',
  },
  claimButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  claimBtn: {
    padding: '15px 20px',
    fontSize: '18px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 8px rgba(76, 175, 80, 0.3)',
    minWidth: '80px',
  },
  pointsBadge: {
    fontSize: '12px',
    marginTop: '5px',
    opacity: 0.9,
  },
  emptyState: {
    color: '#999',
    fontSize: '16px',
    fontStyle: 'italic',
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
  submitBtn: {
    padding: '15px 30px',
    fontSize: '18px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  wordDisplay: {
    background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%)',
    padding: '20px',
    borderRadius: '15px',
    marginTop: '20px',
    marginBottom: '20px',
    border: '3px solid #667eea',
    fontSize: '24px',
    textAlign: 'center',
    color: '#333',
  },
  meaningInput: {
    width: '100%',
    padding: '15px',
    fontSize: '16px',
    borderRadius: '10px',
    border: '2px solid #ddd',
    marginBottom: '15px',
    minHeight: '100px',
  },
  btnGroup: {
    display: 'flex',
    gap: '10px',
  },
  challengeBtn: {
    padding: '15px 30px',
    fontSize: '18px',
    background: '#ff6b6b',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  challengeBox: {
    background: '#fff3cd',
    padding: '20px',
    borderRadius: '15px',
  },
  yesBtn: {
    flex: 1,
    padding: '15px',
    fontSize: '18px',
    background: '#51cf66',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  noBtn: {
    flex: 1,
    padding: '15px',
    fontSize: '18px',
    background: '#ff6b6b',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
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
  },
  message: {
    padding: '8px',
    marginBottom: '5px',
    background: '#f0f0f0',
    borderRadius: '8px',
    fontSize: '14px',
  },
  time: {
    fontSize: '11px',
    color: '#666',
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
    marginBottom: '30px',
  },
  finalScore: {
    background: 'white',
    padding: '40px',
    borderRadius: '20px',
    textAlign: 'center',
  },
  bigEmoji: {
    fontSize: '80px',
  },
};
