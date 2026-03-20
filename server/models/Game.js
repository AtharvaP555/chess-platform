import mongoose from "mongoose";

const GameSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    fen: {
      type: String,
      required: true,
      default: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    },

    moves: { type: Array, default: [] },
    timeControl: { type: String, default: "blitz" },
    timeWhite: { type: Number, required: true },
    timeBlack: { type: Number, required: true },

    // ── Player identity ──────────────────────────────────────────────────
    // null = guest player
    playerIds: {
      white: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      black: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    playerNames: {
      white: { type: String, default: "Guest" },
      black: { type: String, default: "Guest" },
    },

    // ── Rating info ──────────────────────────────────────────────────────
    rated: { type: Boolean, default: false },
    ratingsBefore: {
      white: { type: Number, default: null },
      black: { type: Number, default: null },
    },
    ratingChanges: {
      white: { type: Number, default: null },
      black: { type: Number, default: null },
    },

    // ── Result ───────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting",
    },
    winner: {
      type: String,
      enum: ["white", "black", null],
      default: null,
    },
    endReason: { type: String, default: null },
  },
  { timestamps: true },
);

export const Game = mongoose.model("Game", GameSchema);
