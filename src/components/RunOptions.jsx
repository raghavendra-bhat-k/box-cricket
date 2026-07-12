import { useState } from 'react'

const DEFAULT_OPTIONS = [0, 1, 2, 3, 4, 6]

// A run selector: the common values as buttons plus a "+" that reveals a numeric
// input for any other value (e.g. 5 off a no-ball, or overthrows). `value` is the
// current numeric selection; `onChange` receives the chosen number.
export default function RunOptions({ value, onChange, options = DEFAULT_OPTIONS }) {
  const valueIsCustom = value != null && !options.includes(value)
  const [showCustom, setShowCustom] = useState(valueIsCustom)

  return (
    <div className="extras-runs">
      {options.map(n => (
        <button
          key={n}
          className={!showCustom && value === n ? 'selected' : ''}
          onClick={() => { setShowCustom(false); onChange(n) }}
        >
          {n}
        </button>
      ))}
      <button
        className={showCustom ? 'selected' : ''}
        onClick={() => setShowCustom(true)}
        aria-label="Custom runs"
      >
        +
      </button>
      {showCustom && (
        <input
          className="run-custom-input"
          type="number"
          min="0"
          inputMode="numeric"
          aria-label="Custom run value"
          value={showCustom ? (value ?? 0) : ''}
          onChange={e => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
        />
      )}
    </div>
  )
}
