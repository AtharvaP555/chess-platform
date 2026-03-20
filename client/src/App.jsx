import { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import { useSocket } from "./hooks/useSocket";
import { useGameSession } from "./hooks/useGameSession";
import Board from "./components/Board";
import PlayerBar from "./components/PlayerBar";
import StatusCard from "./components/StatusCard";
import MoveHistory from "./components/MoveHistory";
import Controls from "./components/Controls";
import Lobby from "./components/Lobby";
import WaitingRoom from "./components/WaitingRoom";
import ConnectionBanner from "./components/ConnectionBanner";
import "./index.css";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const DEFAULT_TIME = 5 * 60 * 1000; // 5 min fallback

export default function App() {
  const { socket, connected, emit, on } = useSocket();
  const { session, saveSession, clearSession } = useGameSession();

  // ── Screen ────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState("lobby");
  const [roomId, setRoomId] = useState(null);
  const [myColor, setMyColor] = useState(null);

  // ── Game state ────────────────────────────────────────────────────────
  const chessRef = useRef(new Chess());
  const [boardState, setBoardState] = useState(() => chessRef.current.board());
  const [turn, setTurn] = useState("w");
  const [history, setHistory] = useState([]);
  const [inCheck, setInCheck] = useState(false);
  const [gameOver, setGameOver] = useState(null);

  // ── Timer state ───────────────────────────────────────────────────────
  const [timeWhite, setTimeWhite] = useState(DEFAULT_TIME);
  const [timeBlack, setTimeBlack] = useState(DEFAULT_TIME);

  // ── Board interaction ─────────────────────────────────────────────────
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [capturedByWhite, setCapturedByWhite] = useState([]);
  const [capturedByBlack, setCapturedByBlack] = useState([]);

  // ── Connection / UI ───────────────────────────────────────────────────
  const [banner, setBanner] = useState(null);
  const [rematchPending, setRematchPending] = useState(false);

  // ── Apply server game_state ───────────────────────────────────────────
  const applyGameState = useCallback((state) => {
    const chess = new Chess(state.fen);
    chessRef.current = chess;
    setBoardState(chess.board());
    setTurn(state.turn);
    setHistory(state.history);
    setInCheck(state.isCheck);

    // Timer
    if (state.timeWhite !== undefined) setTimeWhite(state.timeWhite);
    if (state.timeBlack !== undefined) setTimeBlack(state.timeBlack);

    // Recalculate captures from history
    const capW = [],
      capB = [];
    for (const move of state.history) {
      if (move.captured) {
        if (move.color === "w") capW.push(move.captured);
        else capB.push(move.captured);
      }
    }
    setCapturedByWhite(capW);
    setCapturedByBlack(capB);

    const h = state.history;
    setLastMove(
      h.length > 0
        ? { from: h[h.length - 1].from, to: h[h.length - 1].to }
        : null,
    );

    if (state.isGameOver) {
      if (state.isCheckmate)
        setGameOver({ winner: state.winner, reason: "Checkmate" });
      else if (state.isStalemate)
        setGameOver({ winner: null, reason: "Stalemate" });
      else setGameOver({ winner: null, reason: "Draw" });
    } else {
      setGameOver(null);
    }

    setSelected(null);
    setLegalTargets([]);

    // Transition from waiting to playing when both players joined
    if (state.players.white && state.players.black) {
      setScreen((s) => (s === "waiting" ? "playing" : s));
    }
  }, []);

  // ── Socket listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      on("game_state", applyGameState),

      // Live timer ticks from server
      on("timer_update", ({ timeWhite: tw, timeBlack: tb }) => {
        setTimeWhite(tw);
        setTimeBlack(tb);
      }),

      on("game_over", ({ winner, reason }) => {
        setGameOver({ winner, reason });
      }),

      on("opponent_disconnected", () => {
        setBanner("Opponent disconnected. Waiting 30s…");
      }),

      on("opponent_reconnected", () => {
        setBanner("Opponent reconnected!");
        setTimeout(() => setBanner(null), 3000);
      }),

      on("rematch_requested", () => {
        setRematchPending(true);
        setBanner("Opponent wants a rematch!");
      }),

      on("rematch_start", () => {
        setRematchPending(false);
        setBanner(null);
        setGameOver(null);
        setSelected(null);
        setLegalTargets([]);
      }),
    ];
    return () => offs.forEach((off) => off?.());
  }, [on, applyGameState]);

  // ── Rejoin on reconnect ───────────────────────────────────────────────
  useEffect(() => {
    if (!connected || !session) return;
    socket.current.emit(
      "rejoin_room",
      { roomId: session.roomId, color: session.color },
      (res) => {
        if (res.error) {
          clearSession();
          return;
        }
        setRoomId(session.roomId);
        setMyColor(session.color);
        setScreen("playing");
        setBanner("Reconnected!");
        setTimeout(() => setBanner(null), 3000);
      },
    );
  }, [connected]); // eslint-disable-line

  // ── Lobby actions ─────────────────────────────────────────────────────
  const handleCreateRoom = useCallback(
    (timeControl) => {
      return new Promise((resolve) => {
        socket.current.emit(
          "create_room",
          { timeControl },
          ({ roomId: id, color }) => {
            setRoomId(id);
            setMyColor(color);
            saveSession(id, color);
            setScreen("waiting");
            resolve();
          },
        );
      });
    },
    [socket, saveSession],
  );

  const handleJoinRoom = useCallback(
    (code) => {
      return new Promise((resolve) => {
        socket.current.emit("join_room", { roomId: code }, (res) => {
          if (res.error) {
            resolve(res.error);
            return;
          }
          setRoomId(code);
          setMyColor(res.color);
          saveSession(code, res.color);
          setScreen("playing");
          resolve(null);
        });
      });
    },
    [socket, saveSession],
  );

  // ── Square click ──────────────────────────────────────────────────────
  const handleSquareClick = useCallback(
    (key) => {
      if (gameOver) return;
      const isMyTurn =
        (myColor === "white" && turn === "w") ||
        (myColor === "black" && turn === "b");
      if (!isMyTurn) return;

      const chess = chessRef.current;
      const f = FILES.indexOf(key[0]);
      const r = 8 - parseInt(key[1]);
      const piece = chess.board()[r][f];
      const currentTurn = chess.turn();

      if (selected) {
        if (legalTargets.includes(key)) {
          emit("make_move", {
            roomId,
            from: selected,
            to: key,
            promotion: "q",
          });
          setSelected(null);
          setLegalTargets([]);
          return;
        }
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
        if (piece && piece.color === currentTurn) {
          setSelected(key);
          setLegalTargets(
            chess.moves({ square: key, verbose: true }).map((m) => m.to),
          );
        }
      }
    },
    [selected, legalTargets, turn, myColor, roomId, emit, gameOver],
  );

  // ── Controls ──────────────────────────────────────────────────────────
  const handleResign = useCallback(
    () => emit("resign", { roomId }),
    [emit, roomId],
  );
  const handleRematch = useCallback(() => {
    emit("vote_rematch", { roomId });
    setBanner("Rematch requested…");
  }, [emit, roomId]);

  const handleLeave = useCallback(() => {
    clearSession();
    setScreen("lobby");
    setRoomId(null);
    setMyColor(null);
    setGameOver(null);
    setSelected(null);
    setLegalTargets([]);
    setLastMove(null);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    chessRef.current = new Chess();
    setBoardState(chessRef.current.board());
    setTurn("w");
    setHistory([]);
    setTimeWhite(DEFAULT_TIME);
    setTimeBlack(DEFAULT_TIME);
  }, [clearSession]);

  // ── Render ────────────────────────────────────────────────────────────
  if (screen === "lobby") {
    return (
      <div className="app">
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          connected={connected}
        />
      </div>
    );
  }

  if (screen === "waiting") {
    return (
      <div className="app">
        <WaitingRoom roomId={roomId} color={myColor} onCancel={handleLeave} />
      </div>
    );
  }

  const isMyTurn =
    (myColor === "white" && turn === "w") ||
    (myColor === "black" && turn === "b");
  const opponentColor = myColor === "white" ? "black" : "white";
  const flipped = myColor === "black";

  return (
    <div className="app">
      <header className="header">
        <h1>♞ CHESS</h1>
        <div className="header-right">
          <span className="room-badge">Room: {roomId}</span>
          <span className={`conn-dot ${connected ? "online" : "offline"}`} />
        </div>
      </header>

      {banner && <ConnectionBanner message={banner} />}

      <main className="main">
        <div className="board-wrap">
          <PlayerBar
            color={opponentColor}
            isActive={!isMyTurn && !gameOver}
            captured={
              opponentColor === "white" ? capturedByWhite : capturedByBlack
            }
            label="Opponent"
            timeMs={opponentColor === "white" ? timeWhite : timeBlack}
          />
          <Board
            boardState={boardState}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            inCheck={inCheck}
            turn={turn}
            gameOver={gameOver}
            flipped={flipped}
            onSquareClick={handleSquareClick}
            onNewGame={handleRematch}
            myColor={myColor}
          />
          <PlayerBar
            color={myColor}
            isActive={isMyTurn && !gameOver}
            captured={myColor === "white" ? capturedByWhite : capturedByBlack}
            label="You"
            timeMs={myColor === "white" ? timeWhite : timeBlack}
          />
        </div>

        <div className="side-panel">
          <StatusCard
            turn={turn}
            inCheck={inCheck}
            gameOver={gameOver}
            myColor={myColor}
            isMyTurn={isMyTurn}
          />
          <MoveHistory history={history} />
          <Controls
            onResign={handleResign}
            onRematch={handleRematch}
            onLeave={handleLeave}
            gameOver={gameOver}
            rematchPending={rematchPending}
          />
        </div>
      </main>
    </div>
  );
}
