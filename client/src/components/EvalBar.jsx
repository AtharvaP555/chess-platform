// Converts a centipawn evaluation to a white win percentage (0-100)
// Uses a sigmoid-like formula similar to what Lichess uses
function evalToPercent(evaluation, isMate, mateIn) {
  if (isMate) return mateIn > 0 ? 100 : 0
  // Clamp to ±15 pawns for display purposes
  const clamped = Math.max(-15, Math.min(15, evaluation))
  // Sigmoid: maps -15..+15 to 0..100 (white's perspective)
  return 50 + 50 * (2 / (1 + Math.exp(-0.4 * clamped)) - 1)
}

function formatEval(evaluation, isMate, mateIn) {
  if (isMate) return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`
  const sign = evaluation > 0 ? '+' : ''
  return `${sign}${evaluation.toFixed(1)}`
}

export default function EvalBar({ evaluation, isMate, mateIn, turn, loading }) {
  const whitePercent = loading ? 50 : evalToPercent(evaluation, isMate, mateIn)
  const blackPercent = 100 - whitePercent
  const evalLabel = loading ? '...' : formatEval(evaluation, isMate, mateIn)

  // Positive eval = white is better, negative = black is better
  const isWhiteBetter = evaluation >= 0 && !isMate || (isMate && mateIn > 0)

  return (
    <div className="eval-bar-wrap">
      <div className="eval-bar-label eval-bar-label-black">
        {!isWhiteBetter && !loading ? evalLabel : ''}
      </div>

      <div className="eval-bar">
        {/* Black's portion (top) */}
        <div
          className="eval-bar-black"
          style={{ height: `${blackPercent}%`, transition: loading ? 'none' : 'height 0.4s ease' }}
        />
        {/* White's portion (bottom) */}
        <div
          className="eval-bar-white"
          style={{ height: `${whitePercent}%`, transition: loading ? 'none' : 'height 0.4s ease' }}
        />
      </div>

      <div className="eval-bar-label eval-bar-label-white">
        {isWhiteBetter && !loading ? evalLabel : ''}
      </div>
    </div>
  )
}
