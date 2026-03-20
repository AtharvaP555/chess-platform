import { useState } from "react";
import TimeControlPicker from "./TimeControlPicker";

export default function Lobby({ onCreateRoom, onJoinRoom, connected }) {
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

      <div className="lobby-cards">
        {/* Create room */}
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

        {/* Join room */}
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

      <div className="lobby-status">
        <span className={`conn-dot ${connected ? "online" : "offline"}`} />
        {connected ? "Connected to server" : "Connecting to server…"}
      </div>
    </div>
  );
}
