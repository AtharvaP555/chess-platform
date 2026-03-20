const PIECE_SYMBOLS = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
}

// captured = array of piece type chars e.g. ['p','p','n']
// These are the OPPONENT's pieces that this player captured
export default function PlayerBar({ color, isActive, captured }) {
  const label = color === 'white' ? 'White' : 'Black'

  return (
    <div className={`player-bar ${isActive ? 'active-turn' : ''}`}>
      <div className="player-name">
        <span className={`color-dot ${color}`} />
        {label}
      </div>
      <div className="captured-pieces">
        {captured.map((type, i) => (
          <span key={i}>{PIECE_SYMBOLS[type]}</span>
        ))}
      </div>
    </div>
  )
}
