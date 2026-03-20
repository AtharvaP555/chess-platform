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
  identity,
  onProfileClick,
}) {
  // identity: { username, rating } | null (guest)
  const displayName =
    identity?.username ?? label ?? (color === "white" ? "White" : "Black");
  const rating = identity?.rating ?? null;

  return (
    <div className={`player-bar ${isActive ? "active-turn" : ""}`}>
      <div className="player-name">
        <span className={`color-dot ${color}`} />
        <span
          className={identity ? "player-username-link" : ""}
          onClick={
            identity && onProfileClick
              ? () => onProfileClick(identity.username)
              : undefined
          }
        >
          {displayName}
        </span>
        {rating !== null && <span className="player-rating">{rating}</span>}
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
