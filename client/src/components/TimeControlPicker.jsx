const TIME_CONTROLS = [
  { id: 'bullet',  label: 'Bullet',  sub: '1 min' },
  { id: 'blitz',   label: 'Blitz',   sub: '5 min' },
  { id: 'rapid',   label: 'Rapid',   sub: '10 min' },
  { id: 'classic', label: 'Classic', sub: '30 min' },
]

export default function TimeControlPicker({ value, onChange }) {
  return (
    <div className="tc-picker">
      {TIME_CONTROLS.map(tc => (
        <button
          key={tc.id}
          className={`tc-btn ${value === tc.id ? 'tc-btn-active' : ''}`}
          onClick={() => onChange(tc.id)}
        >
          <span className="tc-label">{tc.label}</span>
          <span className="tc-sub">{tc.sub}</span>
        </button>
      ))}
    </div>
  )
}
