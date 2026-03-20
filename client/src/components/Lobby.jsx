import { useState } from "react";
import TimeControlPicker from "./TimeControlPicker";
import ActiveGamesList from "./ActiveGamesList";

export default function Lobby({
  onCreateRoom,
  onJoinRoom,
  onWatchGame,
  connected,
}) {
  const [tab, setTab] = useState("play"); // 'play' | 'watch'
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeControl, setTimeControl] = useState("blitz");

  async function handleCreate() {
    setLoading(true);
    setError("");
    await onCreateRoom(timeControl);
    setLoading(false);
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter a valid room code");
      return;
    }
    setLoading(true);
    setError("");
    const err = await onJoinRoom(code);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <div className="lobby">
      <div className="lobby-hero">
        <h1>♞ CHESS</h1>
        <p className="lobby-subtitle">Real-time multiplayer</p>
      </div>

      {/* Tab switcher */}
      <div className="lobby-tabs">
        <button
          className={`lobby-tab ${tab === "play" ? "lobby-tab-active" : ""}`}
          onClick={() => setTab("play")}
        >
          Play
        </button>
        <button
          className={`lobby-tab ${tab === "watch" ? "lobby-tab-active" : ""}`}
          onClick={() => setTab("watch")}
        >
          Watch
        </button>
      </div>

      {tab === "play" && (
        <div className="lobby-cards">
          {/* Create */}
          <div className="card lobby-card">
            <div className="lobby-card-icon">⊕</div>
            <h2>New Game</h2>
            <p>Choose time control, then share the room code.</p>
            <TimeControlPicker value={timeControl} onChange={setTimeControl} />
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!connected || loading}
            >
              {loading ? "Creating…" : "Create Room"}
            </button>
          </div>

          {/* Join */}
          <div className="card lobby-card">
            <div className="lobby-card-icon">⊞</div>
            <h2>Join Game</h2>
            <p>Enter the 6-letter code your friend shared.</p>
            <input
              className="room-input"
              type="text"
              placeholder="ROOM CODE"
              value={joinCode}
              maxLength={6}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            {error && <span className="lobby-error">{error}</span>}
            <button
              className="btn btn-secondary"
              onClick={handleJoin}
              disabled={!connected || loading}
            >
              {loading ? "Joining…" : "Join Room"}
            </button>
          </div>
        </div>
      )}

      {tab === "watch" && (
        <div className="card watch-card">
          <h2>Active Games</h2>
          <p className="watch-subtitle">Updates every 3 seconds</p>
          <ActiveGamesList onWatch={onWatchGame} />
        </div>
      )}

      <div className="lobby-status">
        <span className={`conn-dot ${connected ? "online" : "offline"}`} />
        {connected ? "Connected to server" : "Connecting to server…"}
      </div>
    </div>
  );
}
