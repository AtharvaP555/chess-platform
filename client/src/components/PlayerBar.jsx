import Clock from "./Clock";

const PIECE_SYMBOLS = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

export default function PlayerBar({
  color,
  isActive,
  captured,
  label,
  timeMs,
}) {
  return (
    <div className={`player-bar ${isActive ? "active-turn" : ""}`}>
      <div className="player-name">
        <span className={`color-dot ${color}`} />
        {label || (color === "white" ? "White" : "Black")}
      </div>
      <div className="captured-pieces">
        {captured.map((type, i) => (
          <span key={i}>{PIECE_SYMBOLS[type]}</span>
        ))}
      </div>
      {timeMs !== undefined && (
        <Clock timeMs={timeMs} isActive={isActive} color={color} />
      )}
    </div>
  );
}
