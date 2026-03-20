import { useState, useEffect } from 'react'

const SERVER_URL = 'http://localhost:3001'

function formatTime(ms) {
  if (ms <= 0) return '0:00'
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

const TC_LABELS = {
  bullet: '1 min', blitz: '5 min', rapid: '10 min', classic: '30 min'
}

export default function ActiveGamesList({ onWatch }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchGames() {
      try {
        const res = await fetch(`${SERVER_URL}/games/active`)
        const data = await res.json()
        if (!cancelled) {
          setGames(data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    fetchGames()
    const interval = setInterval(fetchGames, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (loading) {
    return (
      <div className="active-games-empty">
        <div className="waiting-spinner" style={{ width: 20, height: 20 }} />
        <span>Loading games…</span>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="active-games-empty">
        <span>No active games right now.</span>
        <span className="active-games-hint">Create a game and invite a friend!</span>
      </div>
    )
  }

  return (
    <div className="active-games-list">
      {games.map(game => (
        <div key={game.roomId} className="active-game-row">
          <div className="active-game-info">
            <span className="active-game-room">{game.roomId}</span>
            <span className="active-game-meta">
              {TC_LABELS[game.timeControl] ?? game.timeControl}
              {' · '}
              {game.moveCount} move{game.moveCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="active-game-clocks">
            <span className="active-game-clock white-clock">
              ♔ {formatTime(game.timeWhite)}
            </span>
            <span className="active-game-clock black-clock">
              ♚ {formatTime(game.timeBlack)}
            </span>
          </div>
          <div className="active-game-right">
            {game.spectatorCount > 0 && (
              <span className="spectator-badge">
                👁 {game.spectatorCount}
              </span>
            )}
            <button
              className="btn btn-watch"
              onClick={() => onWatch(game.roomId)}
            >
              Watch
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
