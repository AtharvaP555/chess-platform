// Draws an SVG arrow from one square to another overlaid on the board.
// squareSize is passed as a percentage (100/8 = 12.5%)

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function squareToCoords(sq, flipped) {
  const file = FILES.indexOf(sq[0])
  const rank = parseInt(sq[1]) - 1  // 0-indexed from bottom

  const visualFile = flipped ? 7 - file : file
  const visualRank = flipped ? rank : 7 - rank  // flip rank: rank 8 is top (row 0)

  // Center of the square as percentage
  const x = (visualFile + 0.5) * (100 / 8)
  const y = (visualRank + 0.5) * (100 / 8)
  return { x, y }
}

export default function BestMoveArrow({ bestMoveSq, flipped = false }) {
  if (!bestMoveSq || bestMoveSq.length < 4) return null

  const from = bestMoveSq.slice(0, 2)
  const to = bestMoveSq.slice(2, 4)

  const start = squareToCoords(from, flipped)
  const end = squareToCoords(to, flipped)

  // Shorten the line slightly so it doesn't overlap the arrowhead badly
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const shortenBy = 3.5  // percentage units
  const ux = dx / len
  const uy = dy / len

  const x1 = start.x + ux * 1.5
  const y1 = start.y + uy * 1.5
  const x2 = end.x - ux * shortenBy
  const y2 = end.y - uy * shortenBy

  return (
    <svg
      className="best-move-arrow"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="bm-arrow"
          viewBox="0 0 10 10"
          refX="5" refY="5"
          markerWidth="4" markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill="rgba(50,200,100,0.9)" />
        </marker>
      </defs>
      <line
        x1={x1} y1={y1}
        x2={x2} y2={y2}
        stroke="rgba(50,200,100,0.75)"
        strokeWidth="2.5"
        strokeLinecap="round"
        markerEnd="url(#bm-arrow)"
      />
    </svg>
  )
}
