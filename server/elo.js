// Standard ELO implementation
// K-factor: 32 for first 30 games, 16 for established players

export function getKFactor(gamesPlayed) {
  return gamesPlayed < 30 ? 32 : 16
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

// result: 1 = win, 0.5 = draw, 0 = loss (from playerA's perspective)
export function calculateNewRatings(ratingA, ratingB, gamesA, gamesB, result) {
  const expectedA = expectedScore(ratingA, ratingB)
  const expectedB = expectedScore(ratingB, ratingA)
  const resultB = 1 - result

  const kA = getKFactor(gamesA)
  const kB = getKFactor(gamesB)

  const newRatingA = Math.round(ratingA + kA * (result  - expectedA))
  const newRatingB = Math.round(ratingB + kB * (resultB - expectedB))

  return {
    newRatingA,
    newRatingB,
    deltaA: newRatingA - ratingA,
    deltaB: newRatingB - ratingB,
  }
}
