export default function ReplayControls({ currentMove, totalMoves, onFirst, onPrev, onNext, onLast }) {
  return (
    <div className="card replay-controls">
      <h3 className="card-label">Replay</h3>
      <div className="replay-buttons">
        <button
          className="replay-btn"
          onClick={onFirst}
          disabled={currentMove === 0}
          title="First move"
        >
          ⏮
        </button>
        <button
          className="replay-btn"
          onClick={onPrev}
          disabled={currentMove === 0}
          title="Previous move"
        >
          ◀
        </button>
        <span className="replay-counter">
          {currentMove} / {totalMoves}
        </span>
        <button
          className="replay-btn"
          onClick={onNext}
          disabled={currentMove === totalMoves}
          title="Next move"
        >
          ▶
        </button>
        <button
          className="replay-btn"
          onClick={onLast}
          disabled={currentMove === totalMoves}
          title="Last move"
        >
          ⏭
        </button>
      </div>
    </div>
  )
}
