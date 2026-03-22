import { useState } from 'react'
import { createMatch } from '../db'

const DEFAULT_BUTTONS = [
  { tap: 0, label: '0', enabled: true },
  { tap: 1, label: '1', enabled: true },
  { tap: 2, label: '2', enabled: true },
  { tap: 3, label: '3', enabled: true },
  { tap: 4, label: '4', enabled: true },
  { tap: 6, label: '6', enabled: true },
]

export default function NewMatch({ onBack, onStart, rematchFrom }) {
  const prev = rematchFrom
  const [teamA, setTeamA] = useState(prev?.teamA?.name || '')
  const [teamB, setTeamB] = useState(prev?.teamB?.name || '')
  const [totalOvers, setTotalOvers] = useState(prev?.totalOvers || 6)
  const [playersPerSide, setPlayersPerSide] = useState(prev?.playersPerSide || 6)
  const [showPlayers, setShowPlayers] = useState(!!(prev?.teamA?.players?.length || prev?.teamB?.players?.length))
  const [teamAPlayers, setTeamAPlayers] = useState(prev?.teamA?.players || [])
  const [teamBPlayers, setTeamBPlayers] = useState(prev?.teamB?.players || [])
  const [showRules, setShowRules] = useState(!!(prev?.rules))
  const [runMap, setRunMap] = useState(prev?.rules?.runMap || {})
  const [disabledRuns, setDisabledRuns] = useState(
    prev?.rules?.disabledRuns ? Object.fromEntries(prev.rules.disabledRuns.map(r => [r, true])) : {}
  )

  function ensurePlayerSlots(count, existing) {
    const arr = [...existing]
    while (arr.length < count) arr.push('')
    return arr.slice(0, count)
  }

  function togglePlayerNames() {
    if (!showPlayers) {
      setTeamAPlayers(ensurePlayerSlots(playersPerSide, teamAPlayers))
      setTeamBPlayers(ensurePlayerSlots(playersPerSide, teamBPlayers))
    }
    setShowPlayers(!showPlayers)
  }

  function updatePlayer(team, index, value) {
    if (team === 'A') {
      const arr = [...teamAPlayers]
      arr[index] = value
      setTeamAPlayers(arr)
    } else {
      const arr = [...teamBPlayers]
      arr[index] = value
      setTeamBPlayers(arr)
    }
  }

  async function handleStart() {
    if (!teamA.trim() || !teamB.trim()) return

    // Build rules object only if customized
    let rules = null
    const hasRunMap = Object.keys(runMap).length > 0
    const hasDisabled = Object.values(disabledRuns).some(Boolean)
    if (hasRunMap || hasDisabled) {
      rules = {}
      if (hasRunMap) rules.runMap = runMap
      if (hasDisabled) rules.disabledRuns = Object.keys(disabledRuns).filter(k => disabledRuns[k]).map(Number)
    }

    const id = await createMatch({
      teamA: teamA.trim(),
      teamB: teamB.trim(),
      totalOvers,
      playersPerSide,
      teamAPlayers: teamAPlayers.map(p => p.trim()).filter(Boolean),
      teamBPlayers: teamBPlayers.map(p => p.trim()).filter(Boolean),
      rules,
    })
    onStart(id)
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-btn" onClick={onBack}>&larr;</button>
        <h2>New Match</h2>
      </div>

      <div className="form-group">
        <label>Team A (Batting First)</label>
        <input
          type="text"
          value={teamA}
          onChange={e => setTeamA(e.target.value)}
          placeholder="Team name"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label>Team B</label>
        <input
          type="text"
          value={teamB}
          onChange={e => setTeamB(e.target.value)}
          placeholder="Team name"
        />
      </div>

      <div className="form-group">
        <label>Overs per Innings</label>
        <input
          type="number"
          min="1"
          max="50"
          value={totalOvers}
          onChange={e => setTotalOvers(Number(e.target.value))}
        />
      </div>

      <div className="form-group">
        <label>Players per Side</label>
        <input
          type="number"
          min="2"
          max="11"
          value={playersPerSide}
          onChange={e => setPlayersPerSide(Number(e.target.value))}
        />
      </div>

      <button
        className="btn btn-secondary"
        style={{ width: '100%', marginBottom: 12 }}
        onClick={togglePlayerNames}
      >
        {showPlayers ? 'Hide Player Names' : 'Add Player Names (Optional)'}
      </button>

      {showPlayers && (
        <div className="player-names-section">
          <div className="form-group">
            <label>{teamA || 'Team A'} Players</label>
            {ensurePlayerSlots(playersPerSide, teamAPlayers).map((name, i) => (
              <input
                key={`a-${i}`}
                type="text"
                value={name}
                onChange={e => updatePlayer('A', i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                style={{ marginBottom: 6 }}
              />
            ))}
          </div>
          <div className="form-group">
            <label>{teamB || 'Team B'} Players</label>
            {ensurePlayerSlots(playersPerSide, teamBPlayers).map((name, i) => (
              <input
                key={`b-${i}`}
                type="text"
                value={name}
                onChange={e => updatePlayer('B', i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                style={{ marginBottom: 6 }}
              />
            ))}
          </div>
        </div>
      )}

      <button
        className="btn btn-secondary"
        style={{ width: '100%', marginBottom: 16 }}
        onClick={() => setShowRules(!showRules)}
      >
        {showRules ? 'Hide Custom Rules' : 'Custom Scoring Rules (Optional)'}
      </button>

      {showRules && (
        <div className="player-names-section" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
            Configure which run buttons are shown and override run values.
          </p>

          <table className="rules-table">
            <thead>
              <tr>
                <th>Button</th>
                <th>Enabled</th>
                <th>Records as</th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_BUTTONS.map(({ tap, label }) => (
                <tr key={tap}>
                  <td style={{ fontWeight: 700, fontSize: 16 }}>{label}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!disabledRuns[tap]}
                      onChange={e => setDisabledRuns(prev => ({ ...prev, [tap]: !e.target.checked }))}
                      style={{ width: 20, height: 20 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={runMap[tap] !== undefined ? runMap[tap] : tap}
                      onChange={e => {
                        const val = Number(e.target.value)
                        if (val === tap) {
                          setRunMap(prev => { const n = { ...prev }; delete n[tap]; return n })
                        } else {
                          setRunMap(prev => ({ ...prev, [tap]: val }))
                        }
                      }}
                      disabled={!!disabledRuns[tap]}
                      style={{ width: 60, padding: 6, border: '2px solid #e0e0e0', borderRadius: 6, fontSize: 15, textAlign: 'center' }}
                    />
                    {runMap[tap] !== undefined && (
                      <span style={{ fontSize: 12, color: '#e65100', marginLeft: 6 }}>
                        (tap {label} = {runMap[tap]} runs)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        className="btn btn-primary btn-large"
        onClick={handleStart}
        disabled={!teamA.trim() || !teamB.trim()}
      >
        Start Match
      </button>
    </div>
  )
}
