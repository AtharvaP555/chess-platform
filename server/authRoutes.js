import express from 'express'
import jwt from 'jsonwebtoken'
import { User } from './models/User.js'
import { Game } from './models/Game.js'
import { authMiddleware } from './authMiddleware.js'

export const authRouter = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'chess_dev_secret'
const TOKEN_EXPIRY = '30d'

function makeToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
}

// ── Register ────────────────────────────────────────────────────────────────
authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3–20 characters' })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    const existing = await User.findOne({ username: new RegExp(`^${username}$`, 'i') })
    if (existing) return res.status(409).json({ error: 'Username already taken' })

    const user = await User.create({ username, password })
    const token = makeToken(user._id)

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        ratings: user.ratings,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        gamesPlayed: user.gamesPlayed,
      },
    })
  } catch (err) {
    console.error('[register]', err.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── Login ───────────────────────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  try {
    const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') })
    if (!user) return res.status(401).json({ error: 'Invalid username or password' })

    const valid = await user.comparePassword(password)
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' })

    const token = makeToken(user._id)

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        ratings: user.ratings,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        gamesPlayed: user.gamesPlayed,
      },
    })
  } catch (err) {
    console.error('[login]', err.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── Get own profile (requires auth) ─────────────────────────────────────────
authRouter.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Public profile ───────────────────────────────────────────────────────────
authRouter.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({
      username: new RegExp(`^${req.params.username}$`, 'i'),
    }).select('-password')

    if (!user) return res.status(404).json({ error: 'User not found' })

    // Last 10 completed games for this user
    const recentGames = await Game.find({
      $or: [{ 'playerIds.white': user._id }, { 'playerIds.black': user._id }],
      status: 'finished',
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('roomId timeControl winner endReason ratingChanges playerNames createdAt')

    res.json({ user, recentGames })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
