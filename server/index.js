import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Chess } from "chess.js";
import { nanoid } from "nanoid";
import { connectDB } from "./db.js";
import { Game } from "./models/Game.js";

const app = express();
app.use((req, res, next) => {
  const allowed = [
    "http://localhost:5173",
    "https://your-app.vercel.app", // ← add this after you get it
  ];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  next();
});
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "https://your-app.vercel.app"],
    methods: ["GET", "POST"],
  },
});

// ─── Time controls ─────────────────────────────────────────────────────────
const TIME_CONTROLS = {
  bullet: { label: "1 min", ms: 1 * 60 * 1000 },
  blitz: { label: "5 min", ms: 5 * 60 * 1000 },
  rapid: { label: "10 min", ms: 10 * 60 * 1000 },
  classic: { label: "30 min", ms: 30 * 60 * 1000 },
};
const DEFAULT_TC = "blitz";

// ─── Room store ────────────────────────────────────────────────────────────
const rooms = {};

function createRoom(roomId, timeControl = DEFAULT_TC) {
  const tc = TIME_CONTROLS[timeControl] ?? TIME_CONTROLS[DEFAULT_TC];
  rooms[roomId] = {
    chess: new Chess(),
    players: { white: null, black: null },
    spectators: new Set(), // ← NEW: tracks spectator socket IDs
    status: "waiting",
    rematchVotes: new Set(),
    timeControl,
    timeWhite: tc.ms,
    timeBlack: tc.ms,
    turnStartedAt: null,
    timerInterval: null,
  };
  return rooms[roomId];
}

function getRoomForSocket(socketId) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (
      room.players.white === socketId ||
      room.players.black === socketId ||
      room.spectators.has(socketId)
    ) {
      return { roomId, room };
    }
  }
  return null;
}

function getColorForSocket(room, socketId) {
  if (room.players.white === socketId) return "white";
  if (room.players.black === socketId) return "black";
  return null;
}

// ─── DB helpers ────────────────────────────────────────────────────────────
async function dbCreateGame(roomId, timeControl) {
  const tc = TIME_CONTROLS[timeControl] ?? TIME_CONTROLS[DEFAULT_TC];
  try {
    await Game.create({
      roomId,
      timeControl,
      timeWhite: tc.ms,
      timeBlack: tc.ms,
      status: "waiting",
    });
  } catch (err) {
    console.error(`[db] Failed to create game ${roomId}:`, err.message);
  }
}

async function dbSaveMove(roomId, room) {
  try {
    await Game.findOneAndUpdate(
      { roomId },
      {
        fen: room.chess.fen(),
        moves: room.chess.history({ verbose: true }),
        timeWhite: room.timeWhite,
        timeBlack: room.timeBlack,
        status: room.status,
      },
    );
  } catch (err) {
    console.error(`[db] Failed to save move for ${roomId}:`, err.message);
  }
}

async function dbFinishGame(roomId, winner, endReason) {
  try {
    await Game.findOneAndUpdate(
      { roomId },
      { status: "finished", winner: winner ?? null, endReason },
    );
  } catch (err) {
    console.error(`[db] Failed to finish game ${roomId}:`, err.message);
  }
}

async function dbRestoreRoom(roomId) {
  try {
    const doc = await Game.findOne({ roomId });
    if (!doc || doc.status === "finished") return null;
    const chess = new Chess(doc.fen);
    rooms[roomId] = {
      chess,
      players: { white: null, black: null },
      spectators: new Set(),
      status: doc.status,
      rematchVotes: new Set(),
      timeControl: doc.timeControl,
      timeWhite: doc.timeWhite,
      timeBlack: doc.timeBlack,
      turnStartedAt: null,
      timerInterval: null,
    };
    console.log(`[db] Restored room ${roomId} from database`);
    return rooms[roomId];
  } catch (err) {
    console.error(`[db] Failed to restore room ${roomId}:`, err.message);
    return null;
  }
}

// ─── Timer ─────────────────────────────────────────────────────────────────
function stopTimer(room) {
  if (room?.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function startTimer(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== "playing") return;
  stopTimer(room);
  room.turnStartedAt = Date.now();

  room.timerInterval = setInterval(async () => {
    const r = rooms[roomId];
    if (!r || r.status !== "playing") {
      clearInterval(r?.timerInterval);
      return;
    }

    if (r.chess.turn() === "w") r.timeWhite = Math.max(0, r.timeWhite - 1000);
    else r.timeBlack = Math.max(0, r.timeBlack - 1000);

    io.to(roomId).emit("timer_update", {
      timeWhite: r.timeWhite,
      timeBlack: r.timeBlack,
      turn: r.chess.turn(),
    });

    if (r.timeWhite === 0 || r.timeBlack === 0) {
      stopTimer(r);
      r.status = "finished";
      const winner = r.timeWhite === 0 ? "black" : "white";
      io.to(roomId).emit("game_over", { winner, reason: "timeout" });
      await dbFinishGame(roomId, winner, "timeout");
      console.log(`[timeout] room ${roomId}: ${winner} wins on time`);
    }
  }, 1000);
}

function recordMoveTime(room) {
  if (!room.turnStartedAt) return;
  const elapsed = Date.now() - room.turnStartedAt;
  if (room.chess.turn() === "b")
    room.timeWhite = Math.max(0, room.timeWhite - (elapsed % 1000));
  else room.timeBlack = Math.max(0, room.timeBlack - (elapsed % 1000));
  room.turnStartedAt = Date.now();
}

// ─── Game state builder ────────────────────────────────────────────────────
function buildGameState(room, roomId) {
  const chess = room.chess;
  return {
    roomId,
    fen: chess.fen(),
    turn: chess.turn(),
    history: chess.history({ verbose: true }),
    status: room.status,
    players: { white: !!room.players.white, black: !!room.players.black },
    spectatorCount: room.spectators.size, // ← NEW: so clients can show viewer count
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw:
      chess.isThreefoldRepetition() ||
      chess.isInsufficientMaterial() ||
      chess.isDraw(),
    isGameOver: chess.isGameOver(),
    winner: chess.isCheckmate()
      ? chess.turn() === "w"
        ? "black"
        : "white"
      : null,
    timeWhite: room.timeWhite,
    timeBlack: room.timeBlack,
    timeControl: room.timeControl,
  };
}

// ─── Socket handlers ───────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Create room ──────────────────────────────────────────────────────
  socket.on("create_room", async (data, callback) => {
    if (typeof callback !== "function")
      return console.error("[create_room] missing callback");
    const timeControl = data?.timeControl ?? DEFAULT_TC;
    const roomId = nanoid(6).toUpperCase();
    const room = createRoom(roomId, timeControl);
    room.players.white = socket.id;
    socket.join(roomId);
    await dbCreateGame(roomId, timeControl);
    console.log(`[create_room] ${socket.id} → room ${roomId} (${timeControl})`);
    callback({ roomId, color: "white" });
  });

  // ── Join room (as player) ────────────────────────────────────────────
  socket.on("join_room", async (data, callback) => {
    if (typeof callback !== "function")
      return console.error("[join_room] missing callback");
    const { roomId } = data;
    const room = rooms[roomId];

    if (!room) return callback({ error: "Room not found" });
    if (room.players.white && room.players.black)
      return callback({ error: "Room is full" });

    const color = room.players.white ? "black" : "white";
    room.players[color] = socket.id;
    room.status = "playing";
    socket.join(roomId);
    startTimer(roomId);

    try {
      await Game.findOneAndUpdate({ roomId }, { status: "playing" });
    } catch (err) {
      console.error(`[db] status update failed:`, err.message);
    }

    console.log(`[join_room] ${socket.id} → room ${roomId} as ${color}`);
    callback({ color });
    io.to(roomId).emit("game_state", buildGameState(room, roomId));
  });

  // ── Join as spectator ────────────────────────────────────────────────
  socket.on("join_spectator", (data, callback) => {
    const { roomId } = data;
    const room = rooms[roomId];

    if (!room) return callback({ error: "Room not found" });
    if (room.status === "finished")
      return callback({ error: "Game has ended" });

    room.spectators.add(socket.id);
    socket.join(roomId);

    console.log(
      `[spectator] ${socket.id} watching room ${roomId} (${room.spectators.size} viewers)`,
    );

    // Send current game state immediately so board jumps to current position
    callback({ ok: true, spectatorCount: room.spectators.size });
    socket.emit("game_state", buildGameState(room, roomId));

    // Tell players someone joined to watch
    io.to(roomId).emit("spectator_count", { count: room.spectators.size });
  });

  // ── Rejoin room ──────────────────────────────────────────────────────
  socket.on("rejoin_room", async (data, callback) => {
    if (typeof callback !== "function")
      return console.error("[rejoin_room] missing callback");
    const { roomId, color } = data;

    let room = rooms[roomId];
    if (!room) {
      console.log(
        `[rejoin_room] Room ${roomId} not in memory — restoring from DB`,
      );
      room = await dbRestoreRoom(roomId);
    }

    if (!room) return callback({ error: "Room expired" });

    room.players[color] = socket.id;
    socket.join(roomId);

    if (room.players.white && room.players.black && room.status === "playing") {
      startTimer(roomId);
    }

    console.log(`[rejoin_room] ${socket.id} → room ${roomId} as ${color}`);
    callback({ ok: true });
    io.to(roomId).emit("game_state", buildGameState(room, roomId));
    io.to(roomId).emit("opponent_reconnected");
  });

  // ── Make move ────────────────────────────────────────────────────────
  socket.on("make_move", async ({ roomId, from, to, promotion = "q" }) => {
    const room = rooms[roomId];
    if (!room || room.status !== "playing") return;

    const color = getColorForSocket(room, socket.id);
    // Spectators are silently ignored — they have no color
    if (!color) return;

    const chess = room.chess;
    if (color !== (chess.turn() === "w" ? "white" : "black")) {
      socket.emit("move_error", { message: "Not your turn" });
      return;
    }

    let result;
    try {
      result = chess.move({ from, to, promotion });
    } catch {
      result = null;
    }

    if (!result) {
      socket.emit("move_error", { message: "Illegal move" });
      return;
    }

    recordMoveTime(room);

    if (chess.isGameOver()) {
      stopTimer(room);
      room.status = "finished";
      const winner = chess.isCheckmate()
        ? chess.turn() === "w"
          ? "black"
          : "white"
        : null;
      const endReason = chess.isCheckmate()
        ? "checkmate"
        : chess.isStalemate()
          ? "stalemate"
          : "draw";
      await dbFinishGame(roomId, winner, endReason);
    } else {
      await dbSaveMove(roomId, room);
    }

    console.log(`[make_move] room ${roomId}: ${result.san}`);
    io.to(roomId).emit("game_state", buildGameState(room, roomId));
  });

  // ── Resign ───────────────────────────────────────────────────────────
  socket.on("resign", async ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const color = getColorForSocket(room, socket.id);
    if (!color) return;
    stopTimer(room);
    room.status = "finished";
    const winner = color === "white" ? "black" : "white";
    io.to(roomId).emit("game_over", { winner, reason: "resignation" });
    await dbFinishGame(roomId, winner, "resignation");
    console.log(`[resign] ${color} resigned in room ${roomId}`);
  });

  // ── Rematch ──────────────────────────────────────────────────────────
  socket.on("vote_rematch", async ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    // Only players can vote for rematch, not spectators
    if (!getColorForSocket(room, socket.id)) return;

    room.rematchVotes.add(socket.id);

    if (room.rematchVotes.size >= 2) {
      stopTimer(room);
      const tc = TIME_CONTROLS[room.timeControl] ?? TIME_CONTROLS[DEFAULT_TC];
      room.chess = new Chess();
      room.status = "playing";
      room.rematchVotes.clear();
      room.timeWhite = tc.ms;
      room.timeBlack = tc.ms;
      room.turnStartedAt = null;
      const { white, black } = room.players;
      room.players.white = black;
      room.players.black = white;
      // Spectators stay in the room automatically — they're in the socket.io room

      const newRoomId = roomId + "R";
      await dbCreateGame(newRoomId, room.timeControl);
      await Game.findOneAndUpdate({ roomId: newRoomId }, { status: "playing" });

      startTimer(roomId);
      io.to(roomId).emit("rematch_start", {
        colors: {
          [room.players.white]: "white",
          [room.players.black]: "black",
        },
      });
      io.to(roomId).emit("game_state", buildGameState(room, roomId));
    } else {
      io.to(roomId).emit("rematch_requested", { by: socket.id });
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    const result = getRoomForSocket(socket.id);
    if (!result) return;
    const { roomId, room } = result;
    const color = getColorForSocket(room, socket.id);

    // Handle spectator leaving cleanly
    if (!color) {
      room.spectators.delete(socket.id);
      io.to(roomId).emit("spectator_count", { count: room.spectators.size });
      console.log(
        `[spectator left] ${socket.id} left room ${roomId} (${room.spectators.size} remaining)`,
      );
      return;
    }

    console.log(`[disconnect] ${socket.id} (${color}) left room ${roomId}`);
    stopTimer(room);
    await dbSaveMove(roomId, room);
    io.to(roomId).emit("opponent_disconnected", { color });

    setTimeout(() => {
      const r = rooms[roomId];
      if (!r) return;
      const stillGone =
        color === "white"
          ? r.players.white === socket.id
          : r.players.black === socket.id;
      if (stillGone) {
        delete rooms[roomId];
        console.log(`[cleanup] room ${roomId} removed from memory`);
      }
    }, 30_000);
  });
});

// ─── REST endpoints ────────────────────────────────────────────────────────

// Active games list — used by the spectator lobby
app.get("/games/active", (_, res) => {
  const active = Object.entries(rooms)
    .filter(([, room]) => room.status === "playing")
    .map(([roomId, room]) => ({
      roomId,
      timeControl: room.timeControl,
      moveCount: room.chess.history().length,
      spectatorCount: room.spectators.size,
      timeWhite: room.timeWhite,
      timeBlack: room.timeBlack,
    }));
  res.json(active);
});

app.get("/games/recent", async (_, res) => {
  try {
    const games = await Game.find({ status: "finished" })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select("roomId timeControl winner endReason createdAt updatedAt");
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/games/:roomId", async (req, res) => {
  try {
    const game = await Game.findOne({ roomId: req.params.roomId });
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) =>
  res.json({ ok: true, rooms: Object.keys(rooms).length }),
);

// ─── Boot ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
connectDB().then(() => {
  httpServer.listen(PORT, () =>
    console.log(`Chess server running on http://localhost:${PORT}`),
  );
});
