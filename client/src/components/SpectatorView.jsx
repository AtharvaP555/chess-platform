import { useState, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import Clock from "./Clock";
import MoveHistory from "./MoveHistory";
import EvalBar from "./EvalBar";
import AnalysisPanel from "./AnalysisPanel";
import { useStockfish } from "../hooks/useStockfish";
import { classifyMove, calcAccuracy } from "./AnalysisPanel";

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
  fen, // current FEN — needed to feed Stockfish
}) {
  const { ready, analyse, stop } = useStockfish({ depth: 15, enabled: true });

  const [evalData, setEvalData] = useState({
    evaluation: 0,
    isMate: false,
    mateIn: null,
  });
  const [evalLoading, setEvalLoading] = useState(true);
  const [bestMoveSq, setBestMoveSq] = useState(null);

  // Post-game analysis state
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Re-analyse whenever the FEN changes (new move played)
  useEffect(() => {
    if (!ready || !fen || gameOver) return;
    setEvalLoading(true);
    setBestMoveSq(null);

    analyse(fen).then((result) => {
      if (!result) return;
      setEvalData({
        evaluation: result.evaluation,
        isMate: result.isMate,
        mateIn: result.mateIn,
      });
      setBestMoveSq(result.bestMoveSq ?? null);
      setEvalLoading(false);
    });

    return () => stop();
  }, [fen, ready, gameOver]); // eslint-disable-line

  // Run full post-game analysis when game ends
  useEffect(() => {
    if (!gameOver || !ready || history.length === 0) return;
    setBestMoveSq(null);
    runPostGameAnalysis();
  }, [gameOver, ready]); // eslint-disable-line

  const runPostGameAnalysis = useCallback(async () => {
    setAnalysisLoading(true);

    const chess = new Chess();
    const evals = [];

    // Evaluate position before each move
    for (const move of history) {
      const fenBefore = chess.fen();
      const result = await analyse(fenBefore);
      // Evaluation is always from white's perspective
      evals.push(result ? result.evaluation * 100 : 0); // store in centipawns
      chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? "q",
      });
    }

    // Final position eval
    const finalResult = await analyse(chess.fen());
    evals.push(finalResult ? finalResult.evaluation * 100 : 0);

    // Classify each move
    const whiteMoves = [];
    const blackMoves = [];
    const annotatedMoves = [];

    for (let i = 0; i < history.length; i++) {
      const evalBefore = evals[i];
      const evalAfter = evals[i + 1];

      // From mover's perspective: positive = good for them
      const isWhite = history[i].color === "w";
      const loss = isWhite
        ? evalBefore - evalAfter // white wants eval to stay high
        : evalAfter - evalBefore; // black wants eval to stay low (more negative)

      const classification = classifyMove(0, loss); // loss relative to 0

      annotatedMoves.push({ san: history[i].san, classification });

      if (isWhite) whiteMoves.push(classification);
      else blackMoves.push(classification);
    }

    setAnalysisData({
      white: {
        accuracy: calcAccuracy(whiteMoves),
        classifications: whiteMoves,
      },
      black: {
        accuracy: calcAccuracy(blackMoves),
        classifications: blackMoves,
      },
      moves: annotatedMoves,
    });
    setAnalysisLoading(false);
  }, [analyse, history]);

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
        {/* Eval bar sits to the left of the board */}
        <div className="board-and-eval">
          <EvalBar
            evaluation={evalData.evaluation}
            isMate={evalData.isMate}
            mateIn={evalData.mateIn}
            turn={turn}
            loading={evalLoading && !gameOver}
          />

          <div className="board-wrap">
            <div className="player-bar">
              <div className="player-name">
                <span className="color-dot black" /> Black
              </div>
              <Clock timeMs={timeBlack} isActive={turn === "b" && !gameOver} />
            </div>

            <Board
              boardState={boardState}
              selected={null}
              legalTargets={[]}
              lastMove={lastMove}
              inCheck={inCheck}
              turn={turn}
              gameOver={gameOver}
              flipped={false}
              onSquareClick={() => {}}
              onNewGame={() => {}}
              myColor={null}
              bestMoveSq={!gameOver ? bestMoveSq : null}
            />

            <div className="player-bar">
              <div className="player-name">
                <span className="color-dot white" /> White
              </div>
              <Clock timeMs={timeWhite} isActive={turn === "w" && !gameOver} />
            </div>
          </div>
        </div>

        <div className="side-panel">
          {/* Status */}
          <div className="card">
            <h3 className="card-label">Status</h3>
            {gameOver ? (
              <div className="status-msg">
                {gameOver.winner
                  ? `${gameOver.winner.charAt(0).toUpperCase() + gameOver.winner.slice(1)} wins!`
                  : "Draw!"}
                <div className="turn-indicator" style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {gameOver.reason}
                  </span>
                </div>
              </div>
            ) : (
              <div className="status-msg">
                {turn === "w" ? "White" : "Black"} to move
                {!evalLoading && (
                  <span className="eval-inline">
                    {evalData.isMate
                      ? ` · M${Math.abs(evalData.mateIn)}`
                      : ` · ${evalData.evaluation > 0 ? "+" : ""}${evalData.evaluation.toFixed(1)}`}
                  </span>
                )}
              </div>
            )}
          </div>

          <MoveHistory history={history} />

          {/* Post-game analysis panel */}
          {(gameOver || analysisData) && (
            <AnalysisPanel
              analysisData={analysisData}
              loading={analysisLoading}
            />
          )}

          <div className="card controls">
            <button className="btn btn-secondary" onClick={onLeave}>
              ← Leave
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
