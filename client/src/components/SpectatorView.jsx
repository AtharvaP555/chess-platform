import Board from './Board'
import Clock from './Clock'
import MoveHistory from './MoveHistory'

export default function SpectatorView({
  boardState,
  turn,
  history,
  inCheck,
  gameOver,
  lastMove,
  timeWhite,
  timeBlack,
  spectatorCount,
  roomId,
  onLeave,
}) {
  return (
    <div className="app">
      <header className="header">
        <h1>♞ CHESS</h1>
        <div className="header-right">
          <span className="spectating-badge">👁 Spectating</span>
          <span className="room-badge">Room: {roomId}</span>
          {spectatorCount > 1 && (
            <span className="room-badge">+{spectatorCount - 1} watching</span>
          )}
        </div>
      </header>

      <main className="main">
        <div className="board-wrap">
          {/* Black player bar */}
          <div className="player-bar">
            <div className="player-name">
              <span className="color-dot black" /> Black
            </div>
            <Clock timeMs={timeBlack} isActive={turn === 'b' && !gameOver} />
          </div>

          {/* Board — no click handler, no legal move hints */}
          <Board
            boardState={boardState}
            selected={null}
            legalTargets={[]}
            lastMove={lastMove}
            inCheck={inCheck}
            turn={turn}
            gameOver={gameOver}
            flipped={false}
            onSquareClick={() => {}}   // no-op
            onNewGame={() => {}}
            myColor={null}             // null = spectator, disables "you win/lose" text
          />

          {/* White player bar */}
          <div className="player-bar">
            <div className="player-name">
              <span className="color-dot white" /> White
            </div>
            <Clock timeMs={timeWhite} isActive={turn === 'w' && !gameOver} />
          </div>
        </div>

        <div className="side-panel">
          {/* Status */}
          <div className="card">
            <h3 className="card-label">Status</h3>
            {gameOver ? (
              <div className="status-msg">
                {gameOver.winner ? `${gameOver.winner} wins!` : 'Draw!'}
                <div className="turn-indicator" style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{gameOver.reason}</span>
                </div>
              </div>
            ) : (
              <div className="status-msg">
                {turn === 'w' ? 'White' : 'Black'} to move
              </div>
            )}
          </div>

          <MoveHistory history={history} />

          <div className="card controls">
            <button className="btn btn-secondary" onClick={onLeave}>
              ← Leave
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
