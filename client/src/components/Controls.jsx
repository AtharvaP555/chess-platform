export default function Controls({
  onResign,
  onRematch,
  onLeave,
  gameOver,
  rematchPending,
}) {
  return (
    <div className="card controls">
      {!gameOver ? (
        <button className="btn btn-danger" onClick={onResign}>
          ⚑ Resign
        </button>
      ) : (
        <button
          className="btn btn-primary"
          onClick={onRematch}
          disabled={rematchPending}
        >
          {rematchPending ? "Waiting for opponent…" : "↺ Rematch"}
        </button>
      )}
      <button className="btn btn-secondary" onClick={onLeave}>
        ← Leave Game
      </button>
    </div>
  );
}
