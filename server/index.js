import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Chess } from "chess.js";
import { nanoid } from "nanoid";
import { connectDB } from "./db.js";
import { Game } from "./models/Game.js";
import { User } from "./models/User.js";
import { authRouter } from "./authRoutes.js";
import { verifySocketToken } from "./authMiddleware.js";
import { calculateNewRatings } from "./elo.js";

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use("/auth", authRouter);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
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

function createRoom(roomId, timeControl = DEFAULT_TC, rated = false) {
  const tc = TIME_CONTROLS[timeControl] ?? TIME_CONTROLS[DEFAULT_TC];
  rooms[roomId] = {
    chess: new Chess(),
    players: { white: null, black: null },
    // Identity per seat — { userId, username, rating } or null for guest
    identities: { white: null, black: null },
    spectators: new Set(),
    status: "waiting",
    rematchVotes: new Set(),
    timeControl,
    rated,
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
async function dbCreateGame(roomId, room) {
  const tc = TIME_CONTROLS[room.timeControl] ?? TIME_CONTROLS[DEFAULT_TC];
  const white = room.identities.white;
  const black = room.identities.black;
  try {
    await Game.create({
      roomId,
      timeControl: room.timeControl,
      timeWhite: tc.ms,
      timeBlack: tc.ms,
      status: "waiting",
      rated: room.rated,
      playerIds: {
        white: white?.userId ?? null,
        black: black?.userId ?? null,
      },
      playerNames: {
        white: white?.username ?? "Guest",
        black: black?.username ?? "Guest",
      },
      ratingsBefore: {
        white: white?.rating ?? null,
        black: black?.rating ?? null,
      },
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

async function dbFinishGame(roomId, room, winner, endReason) {
  const ratingChanges = { white: null, black: null };

  // Apply ELO if rated and both players are registered
  if (room.rated) {
    const wi = room.identities.white;
    const bi = room.identities.black;

    if (wi?.userId && bi?.userId) {
      try {
        const [whiteUser, blackUser] = await Promise.all([
          User.findById(wi.userId),
          User.findById(bi.userId),
        ]);

        if (whiteUser && blackUser) {
          const tc = room.timeControl;
          const ratingW = whiteUser.ratings[tc] ?? 1200;
          const ratingB = blackUser.ratings[tc] ?? 1200;
          const gamesW = whiteUser.gamesPlayed[tc] ?? 0;
          const gamesB = blackUser.gamesPlayed[tc] ?? 0;

          // result from white's perspective: 1=white wins, 0=black wins, 0.5=draw
          const result = winner === "white" ? 1 : winner === "black" ? 0 : 0.5;

          const { newRatingA, newRatingB, deltaA, deltaB } =
            calculateNewRatings(ratingW, ratingB, gamesW, gamesB, result);

          ratingChanges.white = deltaA;
          ratingChanges.black = deltaB;

          // Update white user
          await User.findByIdAndUpdate(wi.userId, {
            [`ratings.${tc}`]: newRatingA,
            $inc: {
              [`gamesPlayed.${tc}`]: 1,
              wins: winner === "white" ? 1 : 0,
              losses: winner === "black" ? 1 : 0,
              draws: winner === null ? 1 : 0,
            },
          });

          // Update black user
          await User.findByIdAndUpdate(bi.userId, {
            [`ratings.${tc}`]: newRatingB,
            $inc: {
              [`gamesPlayed.${tc}`]: 1,
              wins: winner === "black" ? 1 : 0,
              losses: winner === "white" ? 1 : 0,
              draws: winner === null ? 1 : 0,
            },
          });

          console.log(
            `[elo] ${wi.username}: ${ratingW} → ${newRatingA} (${deltaA > 0 ? "+" : ""}${deltaA})`,
          );
          console.log(
            `[elo] ${bi.username}: ${ratingB} → ${newRatingB} (${deltaB > 0 ? "+" : ""}${deltaB})`,
          );
        }
      } catch (err) {
        console.error(`[elo] Failed to update ratings:`, err.message);
      }
    }
  }

  try {
    await Game.findOneAndUpdate(
      { roomId },
      {
        status: "finished",
        winner: winner ?? null,
        endReason,
        ratingChanges,
      },
    );
  } catch (err) {
    console.error(`[db] Failed to finish game ${roomId}:`, err.message);
  }

  return ratingChanges;
}

async function dbRestoreRoom(roomId) {
  try {
    const doc = await Game.findOne({ roomId });
    if (!doc || doc.status === "finished") return null;
    const chess = new Chess(doc.fen);
    rooms[roomId] = {
      chess,
      players: { white: null, black: null },
      identities: { white: null, black: null },
      spectators: new Set(),
      status: doc.status,
      rematchVotes: new Set(),
      timeControl: doc.timeControl,
      rated: doc.rated,
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
      const ratingChanges = await dbFinishGame(roomId, r, winner, "timeout");
      io.to(roomId).emit("game_over", {
        winner,
        reason: "timeout",
        ratingChanges,
      });
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
    // Include identity info so client can show names + ratings
    identities: {
      white: room.identities.white
        ? {
            username: room.identities.white.username,
            rating: room.identities.white.rating,
          }
        : null,
      black: room.identities.black
        ? {
            username: room.identities.black.username,
            rating: room.identities.black.rating,
          }
        : null,
    },
    rated: room.rated,
    spectatorCount: room.spectators.size,
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
  // Verify JWT from handshake auth (optional — guests have no token)
  const userId = verifySocketToken(socket.handshake.auth?.token);
  socket.userId = userId || null;
  console.log(
    `[connect] ${socket.id} (${userId ? "user:" + userId : "guest"})`,
  );

  socket.on("create_room", async (data, callback) => {
    if (typeof callback !== "function") return;
    const timeControl = data?.timeControl ?? DEFAULT_TC;
    const rated = data?.rated ?? false;
    const roomId = nanoid(6).toUpperCase();
    const room = createRoom(roomId, timeControl, rated);

    // Attach identity if logged in
    if (socket.userId) {
      try {
        const user = await User.findById(socket.userId).select(
          "username ratings",
        );
        if (user) {
          room.identities.white = {
            userId: user._id,
            username: user.username,
            rating: user.ratings[timeControl] ?? 1200,
          };
        }
      } catch (err) {
        console.error("[identity] failed to load user:", err.message);
      }
    }

    room.players.white = socket.id;
    socket.join(roomId);
    await dbCreateGame(roomId, room);
    console.log(
      `[create_room] ${socket.id} → room ${roomId} (${timeControl}, rated:${rated})`,
    );
    callback({ roomId, color: "white" });
  });

  socket.on("join_room", async (data, callback) => {
    if (typeof callback !== "function") return;
    const { roomId } = data;
    const room = rooms[roomId];
    if (!room) return callback({ error: "Room not found" });
    if (room.players.white && room.players.black)
      return callback({ error: "Room is full" });

    // Can't play rated game as guest if opponent is registered
    // (allow it — just won't affect ratings)

    const color = room.players.white ? "black" : "white";

    if (socket.userId) {
      try {
        const user = await User.findById(socket.userId).select(
          "username ratings",
        );
        if (user) {
          room.identities[color] = {
            userId: user._id,
            username: user.username,
            rating: user.ratings[room.timeControl] ?? 1200,
          };
        }
      } catch (err) {
        console.error("[identity] failed to load user:", err.message);
      }
    }

    room.players[color] = socket.id;
    room.status = "playing";
    socket.join(roomId);
    startTimer(roomId);

    // Update DB with player identities now that both are known
    try {
      await Game.findOneAndUpdate(
        { roomId },
        {
          status: "playing",
          "playerIds.black": room.identities.black?.userId ?? null,
          "playerNames.black": room.identities.black?.username ?? "Guest",
          "ratingsBefore.black": room.identities.black?.rating ?? null,
        },
      );
    } catch (err) {
      console.error("[db] failed to update player identity:", err.message);
    }

    console.log(`[join_room] ${socket.id} → room ${roomId} as ${color}`);
    callback({ color });
    io.to(roomId).emit("game_state", buildGameState(room, roomId));
  });

  socket.on("join_spectator", (data, callback) => {
    const { roomId } = data;
    const room = rooms[roomId];
    if (!room) return callback({ error: "Room not found" });
    if (room.status === "finished")
      return callback({ error: "Game has ended" });
    room.spectators.add(socket.id);
    socket.join(roomId);
    console.log(`[spectator] ${socket.id} watching room ${roomId}`);
    callback({ ok: true, spectatorCount: room.spectators.size });
    socket.emit("game_state", buildGameState(room, roomId));
    io.to(roomId).emit("spectator_count", { count: room.spectators.size });
  });

  socket.on("rejoin_room", async (data, callback) => {
    if (typeof callback !== "function") return;
    const { roomId, color } = data;
    let room = rooms[roomId];
    if (!room) room = await dbRestoreRoom(roomId);
    if (!room) return callback({ error: "Room expired" });

    if (socket.userId) {
      try {
        const user = await User.findById(socket.userId).select(
          "username ratings",
        );
        if (user) {
          room.identities[color] = {
            userId: user._id,
            username: user.username,
            rating: user.ratings[room.timeControl] ?? 1200,
          };
        }
      } catch (err) {
        /* non-fatal */
      }
    }

    room.players[color] = socket.id;
    socket.join(roomId);
    if (room.players.white && room.players.black && room.status === "playing") {
      startTimer(roomId);
    }
    callback({ ok: true });
    io.to(roomId).emit("game_state", buildGameState(room, roomId));
    io.to(roomId).emit("opponent_reconnected");
  });

  socket.on("make_move", async ({ roomId, from, to, promotion = "q" }) => {
    const room = rooms[roomId];
    if (!room || room.status !== "playing") return;
    const color = getColorForSocket(room, socket.id);
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
      const ratingChanges = await dbFinishGame(roomId, room, winner, endReason);
      io.to(roomId).emit("game_state", {
        ...buildGameState(room, roomId),
        ratingChanges,
      });
    } else {
      await dbSaveMove(roomId, room);
      io.to(roomId).emit("game_state", buildGameState(room, roomId));
    }
    console.log(`[make_move] room ${roomId}: ${result.san}`);
  });

  socket.on("resign", async ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const color = getColorForSocket(room, socket.id);
    if (!color) return;
    stopTimer(room);
    room.status = "finished";
    const winner = color === "white" ? "black" : "white";
    const ratingChanges = await dbFinishGame(
      roomId,
      room,
      winner,
      "resignation",
    );
    io.to(roomId).emit("game_over", {
      winner,
      reason: "resignation",
      ratingChanges,
    });
    console.log(`[resign] ${color} resigned in room ${roomId}`);
  });

  socket.on("vote_rematch", async ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
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
      const { white: wi, black: bi } = room.identities;
      room.identities.white = bi;
      room.identities.black = wi;

      const newRoomId = roomId + "R";
      await dbCreateGame(newRoomId, room);
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

  socket.on("disconnect", async () => {
    const result = getRoomForSocket(socket.id);
    if (!result) return;
    const { roomId, room } = result;
    const color = getColorForSocket(room, socket.id);

    if (!color) {
      room.spectators.delete(socket.id);
      io.to(roomId).emit("spectator_count", { count: room.spectators.size });
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
        console.log(`[cleanup] room ${roomId} removed`);
      }
    }, 30_000);
  });
});

// ─── REST ──────────────────────────────────────────────────────────────────
app.get("/games/active", (_, res) => {
  const active = Object.entries(rooms)
    .filter(([, r]) => r.status === "playing")
    .map(([roomId, r]) => ({
      roomId,
      timeControl: r.timeControl,
      rated: r.rated,
      moveCount: r.chess.history().length,
      spectatorCount: r.spectators.size,
      timeWhite: r.timeWhite,
      timeBlack: r.timeBlack,
      playerNames: {
        white: r.identities.white?.username ?? "Guest",
        black: r.identities.black?.username ?? "Guest",
      },
    }));
  res.json(active);
});

app.get("/games/recent", async (_, res) => {
  try {
    const games = await Game.find({ status: "finished" })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select(
        "roomId timeControl winner endReason playerNames ratingChanges createdAt",
      );
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
