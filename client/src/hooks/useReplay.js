import { useState, useCallback, useEffect } from 'react'
import { Chess } from 'chess.js'

// Given the full move history, reconstructs board state at any move index.
// moveIndex 0 = starting position, moveIndex N = after move N.
export function useReplay(history, enabled) {
  const [moveIndex, setMoveIndex] = useState(null) // null = not in replay mode

  // When game ends, jump replay to final position
  useEffect(() => {
    if (enabled && history.length > 0) {
      setMoveIndex(history.length)
    }
  }, [enabled]) // eslint-disable-line

  // Build board state at a given move index
  const getBoardAtIndex = useCallback((index) => {
    const chess = new Chess()
    for (let i = 0; i < index; i++) {
      const m = history[i]
      chess.move({ from: m.from, to: m.to, promotion: m.promotion ?? 'q' })
    }
    return {
      boardState: chess.board(),
      fen: chess.fen(),
      turn: chess.turn(),
      lastMove: index > 0
        ? { from: history[index - 1].from, to: history[index - 1].to }
        : null,
      inCheck: chess.inCheck(),
    }
  }, [history])

  const goToMove = useCallback((index) => {
    const clamped = Math.max(0, Math.min(history.length, index))
    setMoveIndex(clamped)
  }, [history.length])

  const goFirst = useCallback(() => goToMove(0), [goToMove])
  const goPrev  = useCallback(() => goToMove((moveIndex ?? history.length) - 1), [goToMove, moveIndex, history.length])
  const goNext  = useCallback(() => goToMove((moveIndex ?? history.length) + 1), [goToMove, moveIndex, history.length])
  const goLast  = useCallback(() => goToMove(history.length), [goToMove, history.length])

  const isReplaying = moveIndex !== null
  const currentIndex = moveIndex ?? history.length
  const snapshot = isReplaying ? getBoardAtIndex(currentIndex) : null

  return {
    isReplaying,
    currentIndex,
    snapshot,
    goFirst,
    goPrev,
    goNext,
    goLast,
    goToMove,
  }
}
