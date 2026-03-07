import { useState, useEffect } from 'react'
import { getAllMatches } from '../db'

export default function MatchList({ onResume, onView }) {
  const [matches, setMatches] = useState([])

  useEffect(() => {
    getAllMatches().then(setMatches)
  }, [])

  if (matches.length === 0) {
    return <p style={{ textAlign: 'center', color: '#999', marginTop: 32 }}>No matches yet</p>
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 15, color: '#666', marginBottom: 10 }}>Recent Matches</h3>
      {matches.map(m => (
        <div key={m.id} className="card match-item">
          <div>
            <div className="teams">{m.teamA.name} vs {m.teamB.name}</div>
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
            <button className="btn btn-small btn-secondary" onClick={() => onView(m.id)}>
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
