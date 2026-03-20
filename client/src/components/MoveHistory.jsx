import { useEffect, useRef } from 'react'

export default function MoveHistory({ history }) {
  const listRef = useRef(null)

  // Auto-scroll to bottom when moves are added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [history])

  // Group moves into pairs: [[w_move, b_move], ...]
  const pairs = []
  for (let i = 0; i < history.length; i += 2) {
    pairs.push([history[i], history[i + 1] || null])
  }

  return (
    <div className="card">
      <h3 className="card-label">Move History</h3>
      <div className="move-list" ref={listRef}>
        {pairs.length === 0 && (
          <span className="no-moves">No moves yet</span>
        )}
        {pairs.map((pair, i) => {
          const isLastPair = i === pairs.length - 1
          const wIsLatest = isLastPair && history.length % 2 === 1
          const bIsLatest = isLastPair && history.length % 2 === 0

          return (
            <div key={i} className="move-row">
              <span className="move-num">{i + 1}.</span>
              <span className={`move-cell ${wIsLatest ? 'latest' : ''}`}>
                {pair[0].san}
              </span>
              {pair[1] && (
                <span className={`move-cell ${bIsLatest ? 'latest' : ''}`}>
                  {pair[1].san}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
