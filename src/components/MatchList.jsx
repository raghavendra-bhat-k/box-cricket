import { useState, useEffect } from 'react'
import { getAllMatches, getDayKey } from '../db'

function isToday(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export default function MatchList({ onResume, onView, onRematch, onExportMatch, onExportDay, onExportTournament }) {
  const [matches, setMatches] = useState([])

  useEffect(() => {
    getAllMatches().then(setMatches)
  }, [])

  if (matches.length === 0) {
    return <p style={{ textAlign: 'center', color: '#999', marginTop: 32 }}>No matches yet</p>
  }

  const dayKeys = [...new Set(matches.map(m => m.dayKey || getDayKey(m.date)))]
  const tournamentNames = [...new Set(matches.map(m => m.tournamentName).filter(Boolean))]

  return (
    <div style={{ marginTop: 20 }}>
      <div className="export-groups">
        {dayKeys.map(dayKey => (
          <button key={dayKey} className="btn btn-small btn-secondary" onClick={() => onExportDay?.(dayKey)}>
            Export {dayKey}
          </button>
        ))}
        {tournamentNames.map(name => (
          <button key={name} className="btn btn-small btn-secondary" onClick={() => onExportTournament?.(name)}>
            Export {name}
          </button>
        ))}
      </div>
      <h3 style={{ fontSize: 15, color: '#666', marginBottom: 10 }}>Recent Matches</h3>
      {matches.map(m => (
        <div key={m.id} className="card match-item">
          <div>
            <div className="teams">{m.teamA.name} vs {m.teamB.name}</div>
            {m.tournamentName && <div className="status">Tournament: {m.tournamentName}</div>}
            <div className={`status ${m.status}`}>
              {m.status === 'live' ? 'In Progress' : m.result || 'Completed'}
            </div>
            <div className="status">{new Date(m.date).toLocaleDateString()}</div>
          </div>
          <div className="match-actions">
            {m.status === 'live' && (
              <button className="btn btn-small btn-primary" onClick={() => onResume(m.id)}>
                Resume
              </button>
            )}
            {isToday(m.date) && (
              <button className="btn btn-small btn-secondary" onClick={() => onRematch(m)}>
                Rematch
              </button>
            )}
            <button className="btn btn-small btn-secondary" onClick={() => onView(m.id)}>
              View
            </button>
            <button className="btn btn-small btn-secondary" onClick={() => onExportMatch?.(m.id)}>
              Export
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
