import { useState } from 'react'

// A reusable selector for a batsman or bowler, used across the guided (v2) flows.
// Supports all three input styles the user asked for: tap a roster player, or
// type/enter a new name. `roster` is the list of known names (may contain blanks);
// `disabledIndexes` hides players already chosen (e.g. the other batsman).
// onSelect is called with { index, name } — a typed name resolves to the next
// free roster slot so it persists like any other player.
export default function PlayerPicker({ roster = [], disabledIndexes = [], defaultLabel = 'Player', onSelect }) {
  const [typed, setTyped] = useState('')

  const options = roster.map((name, index) => ({ index, name: name || `${defaultLabel} ${index + 1}` }))
    .filter(o => !disabledIndexes.includes(o.index))

  function addTyped() {
    const name = typed.trim()
    if (!name) return
    // Reuse an existing slot if the name already exists, else the next free index.
    const existing = roster.findIndex(n => (n || '').toLowerCase() === name.toLowerCase())
    const index = existing >= 0 ? existing : roster.length
    onSelect({ index, name })
    setTyped('')
  }

  return (
    <div className="player-picker">
      <div className="player-picker-list">
        {options.map(o => (
          <button key={o.index} className="player-option" onClick={() => onSelect({ index: o.index, name: roster[o.index] || '' })}>
            {o.name}
          </button>
        ))}
      </div>
      <div className="player-picker-add">
        <input
          type="text"
          placeholder="Or type a name…"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTyped() }}
        />
        <button className="btn btn-small btn-secondary" onClick={addTyped} disabled={!typed.trim()}>Add</button>
      </div>
    </div>
  )
}
