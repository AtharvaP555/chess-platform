export default function Controls({ onUndo, onNewGame }) {
  return (
    <div className="card controls">
      <button className="btn btn-secondary" onClick={onUndo}>
        ↩ Undo Last Move
      </button>
      <button className="btn btn-primary" onClick={onNewGame}>
        ✚ New Game
      </button>
    </div>
  )
}
