import BestMoveArrow from "./BestMoveArrow";
import { useState, useEffect } from "react";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const WHITE_PIECES = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
};
const BLACK_PIECES = {
  K: "♚",
  Q: "♛",
  R: "♜",
  B: "♝",
  N: "♞",
  P: "♟",
};

function getSymbol(piece) {
  if (!piece) return null;
  const set = piece.color === "w" ? WHITE_PIECES : BLACK_PIECES;
  return set[piece.type.toUpperCase()];
}

function Square({
  rank,
  file,
  piece,
  isSelected,
  isLegal,
  isLastMove,
  isInCheck,
  onClick,
  flipped,
}) {
  const visualRank = flipped ? 7 - rank : rank;
  const visualFile = flipped ? 7 - file : file;
  const isLight = (rank + file) % 2 === 0;
  const key = FILES[file] + (8 - rank);
  const symbol = getSymbol(piece);
  const coordColor = isLight ? "#b58863" : "#f0d9b5";

  let bg = isLight ? "var(--light-sq)" : "var(--dark-sq)";
  if (isSelected) bg = "rgba(20,85,255,0.5)";
  else if (isInCheck) bg = "var(--check)";
  else if (isLastMove) bg = isLight ? "#5c3a1e" : "#3d2510";

  const showFile = flipped ? visualRank === 0 : visualRank === 7;
  const showRank = flipped ? visualFile === 0 : visualFile === 7;

  return (
    <div
      className="sq"
      style={{
        left: `${(visualFile / 8) * 100}%`,
        top: `${(visualRank / 8) * 100}%`,
        background: bg,
      }}
      onClick={() => onClick(key)}
    >
      {showRank && (
        <span className="coord rank" style={{ color: coordColor }}>
          {8 - rank}
        </span>
      )}
      {showFile && (
        <span className="coord file" style={{ color: coordColor }}>
          {FILES[file]}
        </span>
      )}
      {isLegal && <div className={piece ? "ring-hint" : "dot-hint"} />}
      {symbol && (
        <span
          className="piece"
          style={{ color: piece.color === "w" ? "#fff8f0" : "#f0a050" }}
        >
          {symbol}
        </span>
      )}
    </div>
  );
}

export default function Board({
  boardState,
  selected,
  legalTargets,
  lastMove,
  inCheck,
  turn,
  gameOver,
  flipped = false,
  onSquareClick,
  onNewGame,
  myColor,
  bestMoveSq = null, // ← NEW: from Stockfish, shown for spectators only
}) {
  const squares = [];

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const key = FILES[f] + (8 - r);
      const piece = boardState[r][f];
      const isKingInCheck =
        inCheck && piece && piece.type === "k" && piece.color === turn;

      squares.push(
        <Square
          key={key}
          rank={r}
          file={f}
          piece={piece}
          isSelected={selected === key}
          isLegal={legalTargets.includes(key)}
          isLastMove={
            lastMove && (key === lastMove.from || key === lastMove.to)
          }
          isInCheck={isKingInCheck}
          onClick={onSquareClick}
          flipped={flipped}
        />,
      );
    }
  }

  const isMyTurn = myColor
    ? (myColor === "white" && turn === "w") ||
      (myColor === "black" && turn === "b")
    : true;

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
  }, [gameOver]);

  return (
    <div className="board">
      {squares}

      {/* Best move arrow — only rendered when bestMoveSq is provided (spectators) */}
      {bestMoveSq && !gameOver && (
        <BestMoveArrow bestMoveSq={bestMoveSq} flipped={flipped} />
      )}

      {gameOver && !dismissed && (
        <div className="game-over-overlay">
          <button
            className="overlay-dismiss"
            onClick={() => setDismissed(true)}
          ></button>
          <h2>
            {gameOver.winner
              ? myColor === null
                ? `${gameOver.winner.charAt(0).toUpperCase() + gameOver.winner.slice(1)} wins!`
                : gameOver.winner === myColor
                  ? "🏆 You win!"
                  : "You lose"
              : "Draw!"}
          </h2>
          <p>{gameOver.reason}</p>
          <button onClick={onNewGame}>Rematch</button>
        </div>
      )}

      {!gameOver && !isMyTurn && myColor !== null && (
        <div className="waiting-overlay">
          <span>Waiting for opponent…</span>
        </div>
      )}
    </div>
  );
}
