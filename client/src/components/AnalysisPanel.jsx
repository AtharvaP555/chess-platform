// Classification thresholds (centipawn loss vs best move)
// These match roughly what Lichess and Chess.com use
const CLASSIFICATIONS = [
  { label: 'Best',     maxLoss: 10,   color: '#5dade2', symbol: '★' },
  { label: 'Good',     maxLoss: 25,   color: '#2ecc71', symbol: '✓' },
  { label: 'Inaccuracy', maxLoss: 50, color: '#f39c12', symbol: '?!' },
  { label: 'Mistake',  maxLoss: 100,  color: '#e67e22', symbol: '?' },
  { label: 'Blunder',  maxLoss: Infinity, color: '#e74c3c', symbol: '??' },
]

export function classifyMove(evalBefore, evalAfter) {
  // Both evals from white's perspective in centipawns
  const loss = evalBefore - evalAfter
  const absloss = Math.abs(loss)
  for (const c of CLASSIFICATIONS) {
    if (absloss <= c.maxLoss) return c
  }
  return CLASSIFICATIONS[CLASSIFICATIONS.length - 1]
}

export function calcAccuracy(classifications) {
  if (!classifications.length) return 100
  const weights = { Best: 100, Good: 85, Inaccuracy: 60, Mistake: 30, Blunder: 0 }
  const total = classifications.reduce((sum, c) => sum + (weights[c.label] ?? 0), 0)
  return Math.round(total / classifications.length)
}

export default function AnalysisPanel({ analysisData, loading }) {
  if (loading) {
    return (
      <div className="card analysis-panel">
        <h3 className="card-label">Analysis</h3>
        <div className="analysis-loading">
          <div className="waiting-spinner" style={{ width: 18, height: 18 }} />
          <span>Analysing game…</span>
        </div>
      </div>
    )
  }

  if (!analysisData) return null

  const { white, black, moves } = analysisData

  return (
    <div className="card analysis-panel">
      <h3 className="card-label">Analysis</h3>

      {/* Accuracy scores */}
      <div className="accuracy-row">
        <div className="accuracy-item">
          <span className="accuracy-color-dot white" />
          <span className="accuracy-label">White</span>
          <span className="accuracy-score">{white.accuracy}%</span>
        </div>
        <div className="accuracy-divider" />
        <div className="accuracy-item">
          <span className="accuracy-color-dot black" />
          <span className="accuracy-label">Black</span>
          <span className="accuracy-score">{black.accuracy}%</span>
        </div>
      </div>

      {/* Classification breakdown */}
      <div className="classification-grid">
        {CLASSIFICATIONS.map(c => {
          const wCount = white.classifications.filter(x => x.label === c.label).length
          const bCount = black.classifications.filter(x => x.label === c.label).length
          if (wCount === 0 && bCount === 0) return null
          return (
            <div key={c.label} className="classification-row">
              <span className="class-symbol" style={{ color: c.color }}>{c.symbol}</span>
              <span className="class-label">{c.label}</span>
              <span className="class-count" style={{ color: c.color }}>{wCount}</span>
              <span className="class-sep">/</span>
              <span className="class-count" style={{ color: c.color }}>{bCount}</span>
            </div>
          )
        })}
      </div>

      {/* Per-move breakdown */}
      {moves && moves.length > 0 && (
        <div className="move-analysis-list">
          {moves.map((m, i) => (
            <div key={i} className="move-analysis-row">
              <span className="move-analysis-num">{Math.floor(i / 2) + 1}{i % 2 === 0 ? 'w' : 'b'}</span>
              <span className="move-analysis-san">{m.san}</span>
              <span
                className="move-analysis-class"
                style={{ color: m.classification.color }}
              >
                {m.classification.symbol} {m.classification.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
