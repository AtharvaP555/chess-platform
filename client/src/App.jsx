import { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import { useSocket } from "./hooks/useSocket";
import { useGameSession } from "./hooks/useGameSession";
import { useReplay } from "./hooks/useReplay";
import { useStockfish } from "./hooks/useStockfish";
import Board from "./components/Board";
import PlayerBar from "./components/PlayerBar";
import StatusCard from "./components/StatusCard";
import MoveHistory from "./components/MoveHistory";
import Controls from "./components/Controls";
import Lobby from "./components/Lobby";
import WaitingRoom from "./components/WaitingRoom";
import ConnectionBanner from "./components/ConnectionBanner";
import SpectatorView from "./components/SpectatorView";
import EvalBar from "./components/EvalBar";
import ReplayControls from "./components/ReplayControls";
import AnalysisPanel from "./components/AnalysisPanel";
import { classifyMove, calcAccuracy } from "./components/AnalysisPanel";
import "./index.css";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const DEFAULT_TIME = 5 * 60 * 1000;
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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
  const [fen, setFen] = useState(STARTING_FEN);
  const [turn, setTurn] = useState("w");
  const [history, setHistory] = useState([]);
  const [inCheck, setInCheck] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [timeWhite, setTimeWhite] = useState(DEFAULT_TIME);
  const [timeBlack, setTimeBlack] = useState(DEFAULT_TIME);
  const [spectatorCount, setSpectatorCount] = useState(0);

  // ── Board interaction ─────────────────────────────────────────────────
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [capturedByWhite, setCapturedByWhite] = useState([]);
  const [capturedByBlack, setCapturedByBlack] = useState([]);

  // ── UI ────────────────────────────────────────────────────────────────
  const [banner, setBanner] = useState(null);
  const [rematchPending, setRematchPending] = useState(false);

  // ── Replay (active after game ends) ───────────────────────────────────
  const {
    isReplaying,
    currentIndex,
    snapshot,
    goFirst,
    goPrev,
    goNext,
    goLast,
  } = useReplay(history, !!gameOver);

  // ── Stockfish (only enabled post-game for players) ────────────────────
  const {
    ready: sfReady,
    analyse,
    stop: sfStop,
  } = useStockfish({
    depth: 15,
    enabled: !!gameOver && screen === "playing",
  });

  const [evalData, setEvalData] = useState({
    evaluation: 0,
    isMate: false,
    mateIn: null,
  });
  const [evalLoading, setEvalLoading] = useState(false);
  const [bestMoveSq, setBestMoveSq] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Analyse the position currently shown in replay
  const replayFen = isReplaying && snapshot ? snapshot.fen : fen;

  useEffect(() => {
    if (!gameOver || !sfReady || !replayFen) return;
    setEvalLoading(true);
    setBestMoveSq(null);
    analyse(replayFen).then((result) => {
      if (!result) return;
      setEvalData({
        evaluation: result.evaluation,
        isMate: result.isMate,
        mateIn: result.mateIn,
      });
      setBestMoveSq(result.bestMoveSq ?? null);
      setEvalLoading(false);
    });
    return () => sfStop();
  }, [replayFen, sfReady, gameOver]); // eslint-disable-line

  // Run full post-game analysis once when game ends
  useEffect(() => {
    if (!gameOver || !sfReady || history.length === 0 || analysisData) return;
    runPostGameAnalysis();
  }, [gameOver, sfReady]); // eslint-disable-line

  const runPostGameAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    const chess = new Chess();
    const evals = [];

    for (const move of history) {
      const result = await analyse(chess.fen());
      evals.push(result ? result.evaluation * 100 : 0);
      chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? "q",
      });
    }
    const finalResult = await analyse(chess.fen());
    evals.push(finalResult ? finalResult.evaluation * 100 : 0);

    const whiteMoves = [],
      blackMoves = [],
      annotatedMoves = [];

    for (let i = 0; i < history.length; i++) {
      const isWhite = history[i].color === "w";
      const loss = isWhite ? evals[i] - evals[i + 1] : evals[i + 1] - evals[i];
      const classification = classifyMove(0, loss);
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

  // ── Apply server game_state ───────────────────────────────────────────
  const applyGameState = useCallback((state) => {
    const chess = new Chess(state.fen);
    chessRef.current = chess;
    setBoardState(chess.board());
    setFen(chess.fen());
    setTurn(state.turn);
    setHistory(state.history);
    setInCheck(state.isCheck);
    if (state.timeWhite !== undefined) setTimeWhite(state.timeWhite);
    if (state.timeBlack !== undefined) setTimeBlack(state.timeBlack);
    if (state.spectatorCount !== undefined)
      setSpectatorCount(state.spectatorCount);

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

    if (state.players.white && state.players.black) {
      setScreen((s) => (s === "waiting" ? "playing" : s));
    }
  }, []);

  // ── Socket listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      on("game_state", applyGameState),
      on("timer_update", ({ timeWhite: tw, timeBlack: tb }) => {
        setTimeWhite(tw);
        setTimeBlack(tb);
      }),
      on("game_over", ({ winner, reason }) => {
        setGameOver({ winner, reason });
      }),
      on("spectator_count", ({ count }) => setSpectatorCount(count)),
      on("opponent_disconnected", () =>
        setBanner("Opponent disconnected. Waiting 30s…"),
      ),
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
        setAnalysisData(null);
        setBestMoveSq(null);
      }),
    ];
    return () => offs.forEach((off) => off?.());
  }, [on, applyGameState]);

  // ── Rejoin ────────────────────────────────────────────────────────────
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

  const handleWatchGame = useCallback(
    (roomIdToWatch) => {
      socket.current.emit(
        "join_spectator",
        { roomId: roomIdToWatch },
        (res) => {
          if (res.error) {
            alert(res.error);
            return;
          }
          setRoomId(roomIdToWatch);
          setMyColor(null);
          setSpectatorCount(res.spectatorCount);
          setScreen("spectating");
        },
      );
    },
    [socket],
  );

  // ── Square click ──────────────────────────────────────────────────────
  const handleSquareClick = useCallback(
    (key) => {
      // Disable interaction during replay or after game over
      if (gameOver || isReplaying) return;
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
    [
      selected,
      legalTargets,
      turn,
      myColor,
      roomId,
      emit,
      gameOver,
      isReplaying,
    ],
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

  const resetState = useCallback(() => {
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
    setFen(STARTING_FEN);
    setTurn("w");
    setHistory([]);
    setTimeWhite(DEFAULT_TIME);
    setTimeBlack(DEFAULT_TIME);
    setAnalysisData(null);
    setBestMoveSq(null);
    setEvalLoading(false);
  }, []);

  const handleLeave = useCallback(() => {
    clearSession();
    resetState();
  }, [clearSession, resetState]);
  const handleLeaveSpectator = useCallback(() => resetState(), [resetState]);

  // ── What to render on the board during replay vs live ─────────────────
  const displayBoardState =
    isReplaying && snapshot ? snapshot.boardState : boardState;
  const displayLastMove =
    isReplaying && snapshot ? snapshot.lastMove : lastMove;
  const displayInCheck = isReplaying && snapshot ? snapshot.inCheck : inCheck;
  const displayFen = isReplaying && snapshot ? snapshot.fen : fen;

  // ── Screens ───────────────────────────────────────────────────────────
  if (screen === "lobby") {
    return (
      <div className="app">
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onWatchGame={handleWatchGame}
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

  if (screen === "spectating") {
    return (
      <SpectatorView
        boardState={displayBoardState}
        turn={turn}
        history={history}
        inCheck={displayInCheck}
        gameOver={gameOver}
        lastMove={displayLastMove}
        timeWhite={timeWhite}
        timeBlack={timeBlack}
        spectatorCount={spectatorCount}
        roomId={roomId}
        onLeave={handleLeaveSpectator}
        fen={displayFen}
      />
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────
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
          {spectatorCount > 0 && (
            <span className="room-badge">👁 {spectatorCount} watching</span>
          )}
          <span className="room-badge">Room: {roomId}</span>
          <span className={`conn-dot ${connected ? "online" : "offline"}`} />
        </div>
      </header>

      {banner && <ConnectionBanner message={banner} />}

      <main className="main">
        <div className="board-and-eval">
          {/* Eval bar — only shown post-game */}
          {gameOver && (
            <EvalBar
              evaluation={evalData.evaluation}
              isMate={evalData.isMate}
              mateIn={evalData.mateIn}
              turn={isReplaying && snapshot ? snapshot.turn : turn}
              loading={evalLoading}
            />
          )}

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
              boardState={displayBoardState}
              selected={isReplaying ? null : selected}
              legalTargets={isReplaying ? [] : legalTargets}
              lastMove={displayLastMove}
              inCheck={displayInCheck}
              turn={turn}
              gameOver={gameOver}
              flipped={flipped}
              onSquareClick={handleSquareClick}
              onNewGame={handleRematch}
              myColor={myColor}
              bestMoveSq={gameOver ? bestMoveSq : null}
            />
            <PlayerBar
              color={myColor}
              isActive={isMyTurn && !gameOver}
              captured={myColor === "white" ? capturedByWhite : capturedByBlack}
              label="You"
              timeMs={myColor === "white" ? timeWhite : timeBlack}
            />
          </div>
        </div>

        <div className="side-panel">
          <StatusCard
            turn={turn}
            inCheck={inCheck}
            gameOver={gameOver}
            myColor={myColor}
            isMyTurn={isMyTurn}
          />

          <MoveHistory
            history={history}
            highlightIndex={isReplaying ? currentIndex : null}
          />

          {/* Replay controls — shown after game ends */}
          {gameOver && (
            <ReplayControls
              currentMove={currentIndex}
              totalMoves={history.length}
              onFirst={goFirst}
              onPrev={goPrev}
              onNext={goNext}
              onLast={goLast}
            />
          )}

          {/* Analysis panel — shown after game ends */}
          {gameOver && (
            <AnalysisPanel
              analysisData={analysisData}
              loading={analysisLoading}
            />
          )}

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
