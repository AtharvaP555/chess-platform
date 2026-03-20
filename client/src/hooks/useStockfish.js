import { useEffect, useRef, useCallback, useState } from 'react'

// Stockfish sends UCI output line by line.
// We wait for "bestmove" to know analysis is complete.
// "info depth N score cp X" lines give us the evaluation.

export function useStockfish({ depth = 15, enabled = true } = {}) {
  const workerRef = useRef(null)
  const resolveRef = useRef(null)  // resolves the current analysis promise
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled) return

    // Stockfish WASM is loaded from the public folder
    const worker = new Worker('/stockfish.js')
    workerRef.current = worker

    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data
      if (!line) return

      if (line === 'uciok') {
        worker.postMessage('isready')
        return
      }

      if (line === 'readyok') {
        setReady(true)
        return
      }

      // Parse "info depth N score cp X" or "info depth N score mate X"
      if (line.startsWith('info') && line.includes('score') && resolveRef.current) {
        const depthMatch = line.match(/depth (\d+)/)
        const cpMatch = line.match(/score cp (-?\d+)/)
        const mateMatch = line.match(/score mate (-?\d+)/)
        const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8])/)

        const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0

        if (currentDepth >= depth) {
          let evaluation = 0
          let isMate = false
          let mateIn = null

          if (mateMatch) {
            isMate = true
            mateIn = parseInt(mateMatch[1])
            evaluation = mateIn > 0 ? 9999 : -9999
          } else if (cpMatch) {
            evaluation = parseInt(cpMatch[1]) / 100  // centipawns → pawns
          }

          const bestMoveSq = pvMatch ? pvMatch[1] : null

          resolveRef.current({
            evaluation,
            isMate,
            mateIn,
            bestMoveSq,  // e.g. "e2e4" — we split to from/to later
            depth: currentDepth,
          })
          resolveRef.current = null
        }
      }

      // "bestmove" signals end of search — resolve if not already resolved
      if (line.startsWith('bestmove') && resolveRef.current) {
        const parts = line.split(' ')
        const move = parts[1] !== '(none)' ? parts[1] : null
        resolveRef.current({
          evaluation: 0,
          isMate: false,
          mateIn: null,
          bestMoveSq: move,
          depth,
        })
        resolveRef.current = null
      }
    }

    worker.postMessage('uci')

    return () => {
      worker.terminate()
      workerRef.current = null
      setReady(false)
    }
  }, [enabled, depth])

  // Analyse a position given as FEN string
  // Returns a promise that resolves with { evaluation, isMate, mateIn, bestMoveSq }
  const analyse = useCallback((fen) => {
    if (!workerRef.current || !ready) return Promise.resolve(null)

    return new Promise((resolve) => {
      resolveRef.current = resolve
      workerRef.current.postMessage('stop')
      workerRef.current.postMessage(`position fen ${fen}`)
      workerRef.current.postMessage(`go depth ${depth}`)
    })
  }, [ready, depth])

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop')
    resolveRef.current = null
  }, [])

  return { ready, analyse, stop }
}
