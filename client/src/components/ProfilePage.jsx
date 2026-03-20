import { useState, useEffect } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

const TC_LABELS = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classic: 'Classic' }

export default function ProfilePage({ username, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${SERVER_URL}/auth/profile/${username}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load profile'); setLoading(false) })
  }, [username])

  if (loading) return (
    <div className="profile-overlay">
      <div className="card profile-card">
        <div className="analysis-loading">
          <div className="waiting-spinner" style={{ width: 20, height: 20 }} />
          <span>Loading profile…</span>
        </div>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="profile-overlay">
      <div className="card profile-card">
        <p style={{ color: 'var(--muted)' }}>{error ?? 'User not found'}</p>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  )

  const { user, recentGames } = data
  const total = user.wins + user.losses + user.draws

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="card profile-card" onClick={e => e.stopPropagation()}>
        <div className="profile-header">
          <div className="profile-avatar">
            {user.username[0].toUpperCase()}
          </div>
          <div>
            <h2 className="profile-username">{user.username}</h2>
            <p className="profile-since">
              Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button className="overlay-dismiss" onClick={onClose} style={{ color: '#ffffff', position: 'relative', top: 'auto', right: 'auto', marginLeft: 'auto' }}>&#x2715;</button>
        </div>

        {/* Win/loss record */}
        <div className="profile-record">
          <div className="profile-stat">
            <span className="profile-stat-num" style={{ color: '#2ecc71' }}>{user.wins}</span>
            <span className="profile-stat-label">Wins</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-num" style={{ color: '#e74c3c' }}>{user.losses}</span>
            <span className="profile-stat-label">Losses</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-num" style={{ color: 'var(--muted)' }}>{user.draws}</span>
            <span className="profile-stat-label">Draws</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-num">{total}</span>
            <span className="profile-stat-label">Total</span>
          </div>
        </div>

        {/* Ratings per time control */}
        <div className="profile-ratings">
          <h3 className="card-label" style={{ marginBottom: 10 }}>Ratings</h3>
          <div className="profile-ratings-grid">
            {Object.entries(user.ratings).map(([tc, rating]) => (
              <div key={tc} className="profile-rating-item">
                <span className="profile-rating-tc">{TC_LABELS[tc]}</span>
                <span className="profile-rating-val">{rating}</span>
                <span className="profile-rating-games">
                  {user.gamesPlayed[tc] ?? 0} games
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent games */}
        {recentGames?.length > 0 && (
          <div className="profile-recent">
            <h3 className="card-label" style={{ marginBottom: 10 }}>Recent Games</h3>
            <div className="profile-game-list">
              {recentGames.map(game => {
                const isWhite = game.playerNames?.white === user.username
                const myColor = isWhite ? 'white' : 'black'
                const won = game.winner === myColor
                const drew = game.winner === null
                const delta = game.ratingChanges?.[myColor]

                return (
                  <div key={game.roomId} className="profile-game-row">
                    <span className={`profile-game-result ${won ? 'win' : drew ? 'draw' : 'loss'}`}>
                      {won ? 'W' : drew ? 'D' : 'L'}
                    </span>
                    <span className="profile-game-opponent">
                      vs {isWhite ? game.playerNames.black : game.playerNames.white}
                    </span>
                    <span className="profile-game-tc">{TC_LABELS[game.timeControl]}</span>
                    <span className="profile-game-reason">{game.endReason}</span>
                    {delta !== null && delta !== undefined && (
                      <span className={`profile-game-delta ${delta >= 0 ? 'pos' : 'neg'}`}>
                        {delta >= 0 ? '+' : ''}{delta}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
