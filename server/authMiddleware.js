import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'chess_dev_secret'

// Middleware — attaches req.userId if token is valid
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = header.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Socket middleware — verifies JWT attached to socket handshake
export function verifySocketToken(token) {
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded.userId
  } catch {
    return null
  }
}
