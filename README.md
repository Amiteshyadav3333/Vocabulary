# 🎮 Vocabulary Battle Game

A two-player vocabulary game built with Next.js where players compete by playing English words and claiming points.

## Game Rules

- **Setup**: Each player enters their name and chooses an emoji
- **Target Score**: Auto-calculated based on player names (minimum 50 points)
- **Turns**: 60 seconds per turn
- **Scoring**: Points = word length
- **Challenge System**: 
  - Opponent can challenge a word's meaning
  - If challenged player can't explain: opponent gets 2x points
  - If challenged player explains successfully: challenger loses word length points
- **Win Conditions**:
  - First to reach target score
  - Opponent misses 5 consecutive turns
- **Chat**: Live chat with emoji support

## Installation

```bash
npm install
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How to Play

1. Enter player names and select emojis
2. Click "Start Game"
3. Current player enters a word
4. Provide the meaning to claim points
5. Opponent can challenge if they doubt the meaning
6. Use chat to communicate during the game
7. First to target score wins!

# Vocabulary
