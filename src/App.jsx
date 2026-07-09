import { useEffect, useState } from 'react'
import { deleteMatch, deleteMatchesByDay, deleteMatchesByTournament, getAllMatches, getMatch } from './db'
import MatchList from './components/MatchList'
import NewMatch from './components/NewMatch'
import Scoring from './components/Scoring'
import Scorecard from './components/Scorecard'
import Settings from './components/Settings'
import Icon from './components/Icon'
import { loadSettings, saveSettings } from './settings'
import { exportDebugLog } from './utils/debug'
import {
  applySyncImport,
  exportDayPayload,
  exportMatchPayload,
  exportTournamentPayload,
  getPayloadSummary,
  parseSyncPayload,
  shareOrDownloadPayload,
} from './utils/sync'

// Primary (--green-dark) colour per palette — drives the browser status bar.
const THEME_COLORS = {
  royal: '#991b1b',
  classic: '#1a472a',
  sky: '#075985',
  sunset: '#9a3412',
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return typeof localStorage?.getItem === 'function' ? localStorage.getItem('boxCricketTheme') || 'royal' : 'royal'
    } catch {
      return 'royal'
    }
  })
  const [screen, setScreen] = useState('home')
  const [matchId, setMatchId] = useState(null)
  const [matchVersion, setMatchVersion] = useState(1)
  const [rematchFrom, setRematchFrom] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [importState, setImportState] = useState(null)
  const [importError, setImportError] = useState('')
  const [importChoices, setImportChoices] = useState({})
  const [settings, setSettings] = useState(() => loadSettings())

  function updateSettings(next) {
    setSettings(next)
    saveSettings(next)
  }

  // Resolves which scoring experience a match should use, then routes to it.
  async function openScoring(id) {
    setMatchId(id)
    try {
      const match = await getMatch(id)
      setMatchVersion(match?.appVersion ?? 1)
    } catch {
      setMatchVersion(1)
    }
    setScreen('scoring')
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // Keep the browser/PWA status bar in sync with the palette's primary colour.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.royal)
    try {
      if (typeof localStorage?.setItem === 'function') localStorage.setItem('boxCricketTheme', theme)
    } catch {
      // Theme choice is cosmetic; ignore storage failures.
    }
  }, [theme])

  function goHome() {
    setScreen('home')
    setMatchId(null)
    setRematchFrom(null)
  }

  function startMatch(id) {
    setRematchFrom(null)
    setRefreshKey(k => k + 1)
    openScoring(id)
  }

  function viewScorecard(id) {
    setMatchId(id)
    setScreen('scorecard')
  }

  function resumeMatch(id) {
    openScoring(id)
  }

  function handleRematch(matchData) {
    setRematchFrom(matchData)
    setScreen('new')
  }

  async function sharePayload(payloadPromise) {
    try {
      await shareOrDownloadPayload(await payloadPromise)
    } catch (err) {
      alert(err.message || 'Could not create sync file.')
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const payload = parseSyncPayload(await file.text())
      const localMatches = await getAllMatches()
      const summary = getPayloadSummary(payload, localMatches)
      const choices = {}
      for (const match of payload.matches) {
        choices[match.syncId] = summary.conflicts.some(c => c.syncId === match.syncId) ? 'skip' : 'import'
      }
      setImportChoices(choices)
      setImportState({ payload, summary })
      setImportError('')
    } catch (err) {
      setImportError(err.message || 'Could not import sync file.')
      setImportState(null)
    }
  }

  async function confirmImport() {
    if (!importState) return
    try {
      await applySyncImport(importState.payload, importChoices)
      setImportState(null)
      setImportChoices({})
      setRefreshKey(k => k + 1)
      setScreen('home')
    } catch (err) {
      setImportError(err.message || 'Could not apply sync file.')
    }
  }

  if (screen === 'settings') {
    return <Settings settings={settings} onChange={updateSettings} onBack={goHome} onExportDebugLog={exportDebugLog} />
  }

  if (screen === 'new') {
    return <NewMatch onBack={goHome} onStart={startMatch} rematchFrom={rematchFrom} appVersion={settings.guidedScoring ? 2 : 1} />
  }

  if (screen === 'scoring') {
    // TODO(v2): route matchVersion === 2 to <ScoringV2> once it lands (Phase 3).
    // Until then a v2-tagged match still scores correctly in the v1 UI.
    return <Scoring matchId={matchId} appVersion={matchVersion} onBack={goHome} onViewScorecard={() => viewScorecard(matchId)} onShareSync={() => sharePayload(exportMatchPayload(matchId))} />
  }

  if (screen === 'scorecard') {
    return <Scorecard matchId={matchId} onBack={goHome} onResume={() => resumeMatch(matchId)} onShareSync={() => sharePayload(exportMatchPayload(matchId))} />
  }

  return (
    <div className="container">
      <div className="home-header">
        <div className="app-brand">
          <Icon name="logo" size={30} label="Box Cricket logo" />
          <h1 className="app-title">Box Cricket</h1>
        </div>
        <div className="home-header-actions">
          <div className="theme-picker">
            <label htmlFor="theme-select">Palette</label>
            <select id="theme-select" value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="royal">Red & Gold</option>
              <option value="classic">Classic Green</option>
              <option value="sky">Sky Blue</option>
              <option value="sunset">Sunset</option>
            </select>
          </div>
          <button className="settings-btn" onClick={() => setScreen('settings')} aria-label="Settings" title="Settings">
            <Icon name="settings" size={22} label="Settings" />
          </button>
        </div>
      </div>
      <button className="btn btn-primary btn-large" onClick={() => setScreen('new')}>
        <Icon name="plus" /> New Match
      </button>
      {importError && <div className="sync-error">{importError}</div>}
      <MatchList
        key={refreshKey}
        onResume={resumeMatch}
        onView={viewScorecard}
        onRematch={handleRematch}
        onExportMatch={id => sharePayload(exportMatchPayload(id))}
        onExportDay={dayKey => sharePayload(exportDayPayload(dayKey))}
        onExportTournament={name => sharePayload(exportTournamentPayload(name))}
        onImportFile={handleImportFile}
        onDeleteMatch={async id => {
          await deleteMatch(id)
          setRefreshKey(k => k + 1)
        }}
        onDeleteDay={async dayKey => {
          await deleteMatchesByDay(dayKey)
          setRefreshKey(k => k + 1)
        }}
        onDeleteTournament={async name => {
          await deleteMatchesByTournament(name)
          setRefreshKey(k => k + 1)
        }}
      />
      {importState && (
        <div className="bottom-sheet-overlay" onClick={() => setImportState(null)}>
          <div className="bottom-sheet import-sheet" onClick={e => e.stopPropagation()}>
            <h3>Import Sync File</h3>
            <p className="sync-meta">
              {importState.summary.matchCount} match{importState.summary.matchCount !== 1 ? 'es' : ''},
              {' '}{importState.summary.ballCount} deliveries
            </p>
            <p className="sync-meta">Days: {importState.summary.days.join(', ') || 'None'}</p>
            <p className="sync-meta">Tournaments: {importState.summary.tournaments.join(', ') || 'None'}</p>
            <p className="sync-meta">Exported: {new Date(importState.summary.exportedAt).toLocaleString()}</p>
            {importState.summary.conflicts.some(c => c.divergent) && (
              <div className="sync-warning">This file overlaps with local matches that may also have changed. Choose carefully.</div>
            )}
            <div className="import-match-list">
              {importState.payload.matches.map(match => {
                const conflict = importState.summary.conflicts.find(c => c.syncId === match.syncId)
                return (
                  <div key={match.syncId} className="import-match-row">
                    <div>
                      <strong>{match.teamA.name} vs {match.teamB.name}</strong>
                      <span>{match.status === 'live' ? 'In Progress' : match.result || 'Completed'}</span>
                      <span>Last ball: {importState.summary.lastSequences[match.syncId] != null ? importState.summary.lastSequences[match.syncId] + 1 : 0}</span>
                      {conflict && <span className="sync-warning-text">Already on this device</span>}
                    </div>
                    <select
                      value={importChoices[match.syncId] || (conflict ? 'skip' : 'import')}
                      onChange={e => setImportChoices(prev => ({ ...prev, [match.syncId]: e.target.value }))}
                    >
                      {!conflict && <option value="import">Import</option>}
                      {conflict && <option value="copy">Import Copy</option>}
                      {conflict && <option value="replace">Replace Existing</option>}
                      <option value="skip">Skip</option>
                    </select>
                  </div>
                )
              })}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={confirmImport}>
              Import Selected
            </button>
            <button className="sheet-cancel" onClick={() => setImportState(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
