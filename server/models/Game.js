import mongoose from 'mongoose'

const GameSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Current board position as FEN string
  fen: {
    type: String,
    required: true,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },

  // Full move list in verbose format (from chess.js)
  moves: {
    type: Array,
    default: [],
  },

  // Time control identifier e.g. 'blitz'
  timeControl: {
    type: String,
    default: 'blitz',
  },

  // Remaining time in ms for each player
  timeWhite: { type: Number, required: true },
  timeBlack: { type: Number, required: true },

  // Game lifecycle
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting',
  },

  winner: {
    type: String,
    enum: ['white', 'black', null],
    default: null,
  },

  endReason: {
    type: String,  // 'checkmate' | 'stalemate' | 'timeout' | 'resignation' | 'draw'
    default: null,
  },

}, { timestamps: true }) // adds createdAt + updatedAt automatically

export const Game = mongoose.model('Game', GameSchema)
