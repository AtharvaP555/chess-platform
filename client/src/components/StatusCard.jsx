export default function StatusCard({
  turn,
  inCheck,
  gameOver,
  myColor,
  isMyTurn,
}) {
  let message = "";
  let sub = "";

  if (gameOver) {
    if (gameOver.winner) {
      message = gameOver.winner === myColor ? "You win!" : "You lose";
    } else {
      message = "Draw!";
    }
    sub = gameOver.reason;
  } else if (inCheck) {
    message = isMyTurn ? "You are in check!" : "Opponent is in check!";
    sub = isMyTurn ? "Your turn" : "Opponent's turn";
  } else {
    message = isMyTurn ? "Your turn" : "Opponent's turn";
    sub = `${turn === "w" ? "White" : "Black"} to move`;
  }

  const dotBg = gameOver ? "transparent" : turn === "w" ? "#ffffff" : "#222222";

  return (
    <div className="card">
      <h3 className="card-label">Status</h3>
      <div className="status-msg">{message}</div>
      <div className="turn-indicator">
        <span
          className="turn-dot"
          style={{ background: dotBg, border: "1px solid #888" }}
        />
        <span>{sub}</span>
      </div>
    </div>
  );
}
