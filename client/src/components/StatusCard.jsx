export default function StatusCard({ turn, inCheck, gameOver }) {
  let message = ''
  let subText = ''

  if (gameOver) {
    message = gameOver.winner ? `${gameOver.winner} wins!` : 'Draw!'
    subText = gameOver.reason
  } else if (inCheck) {
    message = `${turn === 'w' ? 'White' : 'Black'} is in check!`
    subText = `${turn === 'w' ? 'White' : 'Black'}'s turn`
  } else {
    message = `${turn === 'w' ? 'White' : 'Black'} to move`
    subText = `${turn === 'w' ? 'White' : 'Black'}'s turn`
  }

  const dotBg = gameOver ? 'transparent' : turn === 'w' ? '#ffffff' : '#222222'

  return (
    <div className="card">
      <h3 className="card-label">Status</h3>
      <div className="status-msg">{message}</div>
      <div className="turn-indicator">
        <span
          className="turn-dot"
          style={{ background: dotBg, border: '1px solid #888' }}
        />
        <span>{subText}</span>
      </div>
    </div>
  )
}
