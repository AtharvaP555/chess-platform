import { useEffect, useRef } from "react";

export default function MoveHistory({ history, highlightIndex = null }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    // During replay scroll to highlighted move, otherwise scroll to bottom
    if (highlightIndex !== null) {
      const rows = listRef.current.querySelectorAll(".move-row");
      const targetRow = rows[Math.floor(highlightIndex / 2)];
      targetRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history, highlightIndex]);

  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push([history[i], history[i + 1] || null]);
  }

  return (
    <div className="card">
      <h3 className="card-label">Move History</h3>
      <div className="move-list" ref={listRef}>
        {pairs.length === 0 && <span className="no-moves">No moves yet</span>}
        {pairs.map((pair, i) => {
          const wIdx = i * 2; // 0-based move index for white
          const bIdx = i * 2 + 1; // 0-based move index for black

          // highlightIndex is 1-based (after move N, highlightIndex = N)
          // so move at position wIdx is highlighted when highlightIndex = wIdx + 1
          const wHighlight =
            highlightIndex !== null && highlightIndex === wIdx + 1;
          const bHighlight =
            highlightIndex !== null && highlightIndex === bIdx + 1;

          // "latest" styling only applies when not in replay mode
          const isLastPair = i === pairs.length - 1;
          const wLatest =
            highlightIndex === null && isLastPair && history.length % 2 === 1;
          const bLatest =
            highlightIndex === null && isLastPair && history.length % 2 === 0;

          return (
            <div key={i} className="move-row">
              <span className="move-num">{i + 1}.</span>
              <span
                className={`move-cell ${wHighlight ? "move-replay-highlight" : ""} ${wLatest ? "latest" : ""}`}
              >
                {pair[0].san}
              </span>
              {pair[1] && (
                <span
                  className={`move-cell ${bHighlight ? "move-replay-highlight" : ""} ${bLatest ? "latest" : ""}`}
                >
                  {pair[1].san}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
