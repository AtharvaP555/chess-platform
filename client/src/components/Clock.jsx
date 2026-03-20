// Formats milliseconds → "MM:SS" or "0:SS.d" when under 10 seconds
function formatTime(ms) {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function urgencyClass(ms) {
  if (ms <= 10_000) return 'clock-urgent'
  if (ms <= 30_000) return 'clock-warning'
  return ''
}

export default function Clock({ timeMs, isActive, color }) {
  const label = formatTime(timeMs)
  const urgent = urgencyClass(timeMs)

  return (
    <div className={`clock ${isActive ? 'clock-active' : ''} ${urgent}`}>
      <span className="clock-time">{label}</span>
    </div>
  )
}
