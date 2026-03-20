const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const PIECES = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
}

function getSymbol(piece) {
  if (!piece) return null
  return PIECES[(piece.color === 'w' ? 'w' : 'b') + piece.type.toUpperCase()]
}

function Square({ rank, file, piece, isSelected, isLegal, isLastMove, isInCheck, onClick }) {
  const isLight = (rank + file) % 2 === 0
  const key = FILES[file] + (8 - rank)
  const symbol = getSymbol(piece)
  const coordColor = isLight ? '#b58863' : '#f0d9b5'

  let bg = isLight ? 'var(--light-sq)' : 'var(--dark-sq)'
  if (isSelected) bg = 'rgba(20,85,255,0.5)'
  else if (isInCheck) bg = 'var(--check)'
  else if (isLastMove) bg = isLight ? '#cdd16f' : '#aaa23a'

  return (
    <div
      className="sq"
      style={{
        left: `${(file / 8) * 100}%`,
        top: `${(rank / 8) * 100}%`,
        background: bg,
      }}
      onClick={() => onClick(key)}
    >
      {/* Board coordinates */}
      {file === 7 && (
        <span className="coord rank" style={{ color: coordColor }}>
          {8 - rank}
        </span>
      )}
      {rank === 7 && (
        <span className="coord file" style={{ color: coordColor }}>
          {FILES[file]}
        </span>
      )}

      {/* Legal move hints */}
      {isLegal && (
        <div className={piece ? 'ring-hint' : 'dot-hint'} />
      )}

      {/* Piece */}
      {symbol && <span className="piece">{symbol}</span>}
    </div>
  )
}

export default function Board({
  boardState,
  selected,
  legalTargets,
  lastMove,
  inCheck,
  turn,
  gameOver,
  onSquareClick,
  onNewGame,
}) {
  const squares = []

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const key = FILES[f] + (8 - r)
      const piece = boardState[r][f]

      // Is this the king in check?
      const isKingInCheck =
        inCheck && piece && piece.type === 'k' && piece.color === turn

      squares.push(
        <Square
          key={key}
          rank={r}
          file={f}
          piece={piece}
          isSelected={selected === key}
          isLegal={legalTargets.includes(key)}
          isLastMove={lastMove && (key === lastMove.from || key === lastMove.to)}
          isInCheck={isKingInCheck}
          onClick={onSquareClick}
        />
      )
    }
  }

  return (
    <div className="board">
      {squares}
      {gameOver && (
        <div className="game-over-overlay">
          <h2>{gameOver.winner ? `${gameOver.winner} wins!` : 'Draw!'}</h2>
          <p>{gameOver.reason}</p>
          <button onClick={onNewGame}>New Game</button>
        </div>
      )}
    </div>
  )
}
