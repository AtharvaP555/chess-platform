import { useEffect, useState } from 'react'

export default function RatingChangeToast({ delta, timeControl }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(t)
  }, [])

  if (!visible || delta === null || delta === undefined) return null

  const isPos = delta >= 0

  return (
    <div className={`rating-toast ${isPos ? 'rating-toast-pos' : 'rating-toast-neg'}`}>
      <span className="rating-toast-label">{timeControl} rating</span>
      <span className="rating-toast-delta">
        {isPos ? '+' : ''}{delta}
      </span>
    </div>
  )
}
