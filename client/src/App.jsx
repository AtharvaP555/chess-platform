import { useState, useCallback, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import Board from "./components/Board";
import PlayerBar from "./components/PlayerBar";
import StatusCard from "./components/StatusCard";
import MoveHistory from "./components/MoveHistory";
import Controls from "./components/Controls";
import "./index.css";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function App() {
  const chessRef = useRef(new Chess());
  const [boardState, setBoardState] = useState(() => chessRef.current.board());
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [history, setHistory] = useState([]);
  const [capturedByWhite, setCapturedByWhite] = useState([]); // white captured black pieces
  const [capturedByBlack, setCapturedByBlack] = useState([]); // black captured white pieces
  const [gameOver, setGameOver] = useState(null); // null | { winner, reason }
  const [inCheck, setInCheck] = useState(false);
  const [turn, setTurn] = useState("w");

  // Sync all derived state from chess engine after every move
  const syncState = useCallback(() => {
    const chess = chessRef.current;
    setBoardState(chess.board());
    setHistory(chess.history({ verbose: true }));
    setTurn(chess.turn());
    setInCheck(chess.inCheck());

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        setGameOver({
          winner: chess.turn() === "w" ? "Black" : "White",
          reason: "Checkmate",
        });
      } else if (chess.isStalemate()) {
        setGameOver({ winner: null, reason: "Stalemate" });
      } else if (chess.isThreefoldRepetition()) {
        setGameOver({ winner: null, reason: "Threefold repetition" });
      } else if (chess.isInsufficientMaterial()) {
        setGameOver({ winner: null, reason: "Insufficient material" });
      } else {
        setGameOver({ winner: null, reason: "50-move rule" });
      }
    }
  }, []);

  const handleSquareClick = useCallback(
    (key) => {
      const chess = chessRef.current;
      if (chess.isGameOver()) return;

      const f = FILES.indexOf(key[0]);
      const r = 8 - parseInt(key[1]);
      const piece = chess.board()[r][f];
      const currentTurn = chess.turn();

      if (selected) {
        if (legalTargets.includes(key)) {
          // Attempt the move
          try {
            const result = chess.move({
              from: selected,
              to: key,
              promotion: "q",
            });
            if (result) {
              setLastMove({ from: selected, to: key });
              if (result.captured) {
                if (result.color === "w") {
                  setCapturedByWhite((prev) => [...prev, result.captured]);
                } else {
                  setCapturedByBlack((prev) => [...prev, result.captured]);
                }
              }
              setSelected(null);
              setLegalTargets([]);
              syncState();
              return;
            }
          } catch {
            // invalid move, fall through
          }
        }

        // Clicked own piece — re-select
        if (piece && piece.color === currentTurn) {
          setSelected(key);
          setLegalTargets(
            chess.moves({ square: key, verbose: true }).map((m) => m.to),
          );
        } else {
          setSelected(null);
          setLegalTargets([]);
        }
      } else {
        // Nothing selected yet — select if own piece
        if (piece && piece.color === currentTurn) {
          setSelected(key);
          setLegalTargets(
            chess.moves({ square: key, verbose: true }).map((m) => m.to),
          );
        }
      }
    },
    [selected, legalTargets, syncState],
  );

  const handleUndo = useCallback(() => {
    const chess = chessRef.current;
    if (chess.history().length === 0) return;
    const undone = chess.undo();
    if (undone) {
      if (undone.captured) {
        if (undone.color === "w")
          setCapturedByWhite((prev) => prev.slice(0, -1));
        else setCapturedByBlack((prev) => prev.slice(0, -1));
      }
      const h = chess.history({ verbose: true });
      setLastMove(
        h.length > 0
          ? { from: h[h.length - 1].from, to: h[h.length - 1].to }
          : null,
      );
      setSelected(null);
      setLegalTargets([]);
      setGameOver(null);
      syncState();
    }
  }, [syncState]);

  const handleNewGame = useCallback(() => {
    chessRef.current = new Chess();
    setSelected(null);
    setLegalTargets([]);
    setLastMove(null);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setGameOver(null);
    syncState();
  }, [syncState]);

  return (
    <div className="app">
      <header className="header">
        <h1>♞ CHESS</h1>
        <span>PHASE 1 — LOCAL 2-PLAYER</span>
      </header>

      <main className="main">
        <div className="board-wrap">
          <PlayerBar
            color="black"
            isActive={turn === "b" && !gameOver}
            captured={capturedByBlack}
          />
          <Board
            boardState={boardState}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            inCheck={inCheck}
            turn={turn}
            gameOver={gameOver}
            onSquareClick={handleSquareClick}
            onNewGame={handleNewGame}
          />
          <PlayerBar
            color="white"
            isActive={turn === "w" && !gameOver}
            captured={capturedByWhite}
          />
        </div>

        <div className="side-panel">
          <StatusCard turn={turn} inCheck={inCheck} gameOver={gameOver} />
          <MoveHistory history={history} />
          <Controls onUndo={handleUndo} onNewGame={handleNewGame} />
        </div>
      </main>
    </div>
  );
}
