# ♞ Chess Platform

A real-time multiplayer chess platform with spectator mode, AI analysis, and post-game review — built with React, Node.js, Socket.io, and MongoDB.

**Live demo → [chess-platform-tau.vercel.app](https://chess-platform-tau.vercel.app)**

---

## Features

### Multiplayer

- Create a room and share a 6-letter code with a friend
- Real-time move sync via WebSockets — no page refresh needed
- Server-authoritative move validation (cheating is impossible)
- Reconnection handling — rejoin your game after a disconnect
- Resign and rematch system with color swap

### Game Timers

- Four time controls: Bullet (1 min), Blitz (5 min), Rapid (10 min), Classic (30 min)
- Clocks run on the server — clients only display what the server sends
- Timeout detection with automatic game-over

### Spectator Mode

- Browse a live list of active games and watch any of them
- Board jumps instantly to the current position on join
- Live spectator count shown to both players
- Unlimited viewers per game

### AI Analysis (Stockfish)

- Evaluation bar updating after every move — spectators only during live play
- Best move arrow shown on the board (depth 15)
- Post-game accuracy report for both players and spectators
- Move classification: Best / Good / Inaccuracy / Mistake / Blunder

### Game Replay

- Step through every move after a game ends
- Eval bar and best move arrow update as you navigate
- Current move highlighted in the move history panel

### Persistence

- Every move saved to MongoDB in real time
- Games survive server restarts — state fully restored from database
- Full move history and game result stored for every completed game

---

## Tech Stack

| Layer       | Technology                       |
| ----------- | -------------------------------- |
| Frontend    | React 18, Vite                   |
| Real-time   | Socket.io                        |
| Backend     | Node.js, Express                 |
| Database    | MongoDB Atlas, Mongoose          |
| Chess logic | chess.js                         |
| AI engine   | Stockfish (WebAssembly)          |
| Deployment  | Vercel (client), Render (server) |

---

## Getting Started

### Prerequisites

- Node.js v18+
- A MongoDB Atlas account (free tier works)

### Installation

```bash
# Clone the repo
git clone https://github.com/AtharvaP555/chess-platform.git
cd chess-platform

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Environment Setup

Create `server/.env`:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chess
PORT=3001
```

### Run Locally

```bash
# Terminal 1 — server
cd server && npm run dev

# Terminal 2 — client
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in two browser tabs to play against yourself.

---

## Project Structure

```
chess-platform/
├── client/                  # React frontend
│   ├── public/
│   │   └── stockfish.js     # Stockfish WASM engine
│   └── src/
│       ├── components/
│       │   ├── Board.jsx
│       │   ├── Clock.jsx
│       │   ├── EvalBar.jsx
│       │   ├── BestMoveArrow.jsx
│       │   ├── AnalysisPanel.jsx
│       │   ├── ReplayControls.jsx
│       │   ├── SpectatorView.jsx
│       │   ├── ActiveGamesList.jsx
│       │   ├── Lobby.jsx
│       │   ├── WaitingRoom.jsx
│       │   ├── PlayerBar.jsx
│       │   ├── MoveHistory.jsx
│       │   ├── StatusCard.jsx
│       │   ├── Controls.jsx
│       │   └── ConnectionBanner.jsx
│       ├── hooks/
│       │   ├── useSocket.js
│       │   ├── useStockfish.js
│       │   ├── useReplay.js
│       │   └── useGameSession.js
│       └── App.jsx
└── server/
    ├── models/
    │   └── Game.js          # Mongoose schema
    ├── db.js                # MongoDB connection
    └── index.js             # Express + Socket.io server
```

---

## How It Works

### Move Flow

1. Player clicks a square → client emits `make_move` to server
2. Server validates the move using chess.js
3. If legal: server updates game state, saves to MongoDB, broadcasts to all sockets in the room
4. Both players and all spectators receive the new `game_state` simultaneously

### Timer

The server runs a `setInterval` per room that ticks every second, decrements the active player's clock, and emits `timer_update` to all clients. Clients only render — they never track time themselves.

### Spectator Analysis

Stockfish runs as a Web Worker in the browser via WebAssembly. When a new `game_state` arrives, the spectator's browser feeds the FEN to Stockfish at depth 15 and renders the result — no server involvement required.

### Reconnection

Player session (roomId + color) is stored in `localStorage`. On reconnect, the client emits `rejoin_room`. If the room is still in memory the server restores it immediately. If the server restarted, it fetches the game from MongoDB and rebuilds the room from the saved FEN and move history.

---

## Deployment

| Service  | Platform      | Notes                        |
| -------- | ------------- | ---------------------------- |
| Client   | Vercel        | Auto-deploys on push to main |
| Server   | Render        | Free tier, WebSocket support |
| Database | MongoDB Atlas | Free M0 cluster              |

---

## Roadmap

- [ ] ELO rating system
- [ ] Tournament mode
- [ ] In-game chat
- [ ] Daily puzzles
- [ ] Mobile app

---

## License

MIT
