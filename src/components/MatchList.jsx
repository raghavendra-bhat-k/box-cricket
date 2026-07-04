import { useState, useEffect } from 'react'
import { getAllMatches, getDayKey } from '../db'
import Icon from './Icon'

function isToday(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function formatGroupDate(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function makeGroups(matches) {
  const byKey = new Map()
  for (const match of matches) {
    const dayKey = match.dayKey || getDayKey(match.date)
    const isTournament = Boolean(match.tournamentName)
    const key = isTournament ? `tournament:${match.tournamentName}` : `day:${dayKey}`
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        type: isTournament ? 'tournament' : 'day',
        exportValue: isTournament ? match.tournamentName : dayKey,
        title: isTournament ? match.tournamentName : formatGroupDate(dayKey),
        subtitle: isTournament ? 'Tournament' : 'Match day',
        dayKey,
        matches: [],
        latestTime: 0,
      })
    }
    const group = byKey.get(key)
    group.matches.push(match)
    group.latestTime = Math.max(group.latestTime, new Date(match.date).getTime())
  }
  return [...byKey.values()].sort((a, b) => b.latestTime - a.latestTime)
}

export default function MatchList({
  onResume,
  onView,
  onRematch,
  onExportMatch,
  onExportDay,
  onExportTournament,
  onImportFile,
  onDeleteMatch,
  onDeleteDay,
  onDeleteTournament,
}) {
  const [matches, setMatches] = useState([])
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    getAllMatches().then(loaded => {
      setMatches(loaded)
      const groups = makeGroups(loaded)
      const todayKey = getDayKey(new Date().toISOString())
      const defaultGroup = groups.find(group => group.dayKey === todayKey) || groups[0]
      setExpanded(defaultGroup ? { [defaultGroup.key]: true } : {})
    })
  }, [])

  async function handleDeleteMatch(match) {
    if (!window.confirm(`Delete ${match.teamA.name} vs ${match.teamB.name}? This also deletes its deliveries.`)) return
    await onDeleteMatch?.(match.id)
    setMatches(current => current.filter(m => m.id !== match.id))
  }

  async function handleDeleteGroup(group) {
    const label = group.type === 'tournament' ? group.title : formatGroupDate(group.exportValue)
    if (!window.confirm(`Delete all matches in ${label}? This also deletes their deliveries.`)) return
    if (group.type === 'tournament') {
      await onDeleteTournament?.(group.exportValue)
    } else {
      await onDeleteDay?.(group.exportValue)
    }
    setMatches(current => current.filter(match => {
      if (group.type === 'tournament') return match.tournamentName !== group.exportValue
      return (match.dayKey || getDayKey(match.date)) !== group.exportValue
    }))
  }

  if (matches.length === 0) {
    return (
      <div className="empty-library">
        <p>No matches yet</p>
        <label className="btn btn-secondary import-btn">
          <Icon name="upload" /> Import Sync File
          <input type="file" accept=".json,.boxcricket.json,application/json" onChange={onImportFile} hidden />
        </label>
      </div>
    )
  }

  const groups = makeGroups(matches)

  return (
    <div className="match-library">
      <h3>Match Library</h3>
      {groups.map(group => {
        const isExpanded = Boolean(expanded[group.key])
        return (
          <section key={group.key} className="match-group">
            <div className="match-group-header">
              <button
                className="group-toggle"
                onClick={() => setExpanded(prev => ({ ...prev, [group.key]: !isExpanded }))}
                aria-expanded={isExpanded}
              >
                <Icon name="chevron" className={`chevron${isExpanded ? ' expanded' : ''}`} />
                <span>
                  <strong>{group.title}</strong>
                  <small>{group.subtitle} - {group.matches.length} match{group.matches.length !== 1 ? 'es' : ''}</small>
                </span>
              </button>
              <div className="group-actions">
                <label className="btn btn-small btn-secondary">
                  <Icon name="upload" /> Import
                  <input type="file" accept=".json,.boxcricket.json,application/json" onChange={onImportFile} hidden />
                </label>
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => group.type === 'tournament' ? onExportTournament?.(group.exportValue) : onExportDay?.(group.exportValue)}
                >
                  <Icon name="download" /> Export
                </button>
                <button className="btn btn-small btn-danger" onClick={() => handleDeleteGroup(group)}>
                  <Icon name="trash" /> Delete
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="match-group-body">
                {group.matches.map(m => (
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
                          <Icon name="play" /> Resume
                        </button>
                      )}
                      {isToday(m.date) && (
                        <button className="btn btn-small btn-secondary" onClick={() => onRematch(m)}>
                          <Icon name="refresh" /> Rematch
                        </button>
                      )}
                      <button className="btn btn-small btn-secondary" onClick={() => onView(m.id)}>
                        <Icon name="eye" /> View
                      </button>
                      <button className="btn btn-small btn-secondary" onClick={() => onExportMatch?.(m.id)}>
                        <Icon name="download" /> Export
                      </button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDeleteMatch(m)}>
                        <Icon name="trash" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
