import { useState } from "react";

export default function WaitingRoom({ roomId, color, onCancel }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
    }
  }

  return (
    <div className="waiting-room">
      <div className="lobby-hero">
        <h1>♞ CHESS</h1>
      </div>

      <div className="card waiting-card">
        <div className="waiting-spinner" />
        <h2>Waiting for opponent…</h2>
        <p>Share this code with your friend:</p>

        <div className="room-code-display" onClick={copyCode}>
          <span className="room-code">{roomId}</span>
          <span className="copy-hint">
            {copied ? "✓ Copied!" : "Click to copy"}
          </span>
        </div>

        <p className="color-badge">
          You are playing as{" "}
          <span className={`color-pill ${color}`}>{color}</span>
        </p>

        <button
          className="btn btn-secondary"
          onClick={onCancel}
          style={{ marginTop: 12 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
