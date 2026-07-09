import { useState } from 'react'

// Sub-toggles revealed when guided scoring (v2) is enabled.
const SUB_TOGGLES = [
  { key: 'toss', label: 'Toss selection', help: 'Ask who won the toss and chose to bat/bowl at match start.' },
  { key: 'openingBatsmen', label: 'Opening batsmen & bowler', help: 'Pick opening striker, non-striker and the first bowler before scoring.' },
  { key: 'forceBowlerEachOver', label: 'Force bowler each over', help: 'Require an explicit bowler selection at every over boundary.' },
  { key: 'detailedWicket', label: 'Detailed wicket flow', help: 'Capture how the batsman got out (and who, for run-outs) full-screen.' },
  { key: 'undoRedo', label: 'Undo & redo', help: 'Enable redo in addition to undo.' },
  { key: 'homeButton', label: 'Home button & back guard', help: 'Show a home control everywhere and stop the back button exiting the app.' },
  { key: 'auditLog', label: 'Debug audit log', help: 'Record every action so a match can be replayed for support. Never exported normally.' },
]

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-switch${checked ? ' on' : ''}${disabled ? ' disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <span className="toggle-knob" />
    </button>
  )
}

export default function Settings({ settings, onChange, onBack, onExportDebugLog }) {
  const [local, setLocal] = useState(settings)
  const [debugStatus, setDebugStatus] = useState('')

  function update(patch) {
    const next = { ...local, ...patch }
    setLocal(next)
    onChange(next)
  }

  async function handleExportDebug() {
    setDebugStatus('Preparing…')
    try {
      const result = await onExportDebugLog?.()
      if (!result || result.status === 'empty') {
        setDebugStatus('No guided matches with a debug log yet.')
      } else if (result.status === 'cancelled') {
        setDebugStatus('')
      } else {
        setDebugStatus(`Exported debug log for ${result.matchCount} match${result.matchCount !== 1 ? 'es' : ''}.`)
      }
    } catch {
      setDebugStatus('Could not export debug log.')
    }
  }

  const guided = local.guidedScoring

  return (
    <div className="container">
      <div className="header">
        <button className="back-btn" onClick={onBack}>&larr;</button>
        <h2>Settings</h2>
      </div>

      <div className="card settings-card">
        <div className="settings-row">
          <div className="settings-label">
            <strong>Guided Scoring (v2)</strong>
            <small>Full-screen, step-by-step scoring with toss, batsman/bowler prompts and more. New matches will use this experience.</small>
          </div>
          <Toggle checked={guided} onChange={val => update({ guidedScoring: val })} />
        </div>
      </div>

      {guided && (
        <div className="card settings-card">
          {SUB_TOGGLES.map(({ key, label, help }) => (
            <div className="settings-row" key={key}>
              <div className="settings-label">
                <strong>{label}</strong>
                <small>{help}</small>
              </div>
              <Toggle checked={local[key] !== false} onChange={val => update({ [key]: val })} />
            </div>
          ))}
        </div>
      )}

      {guided && (
        <div className="card settings-card">
          <div className="settings-row">
            <div className="settings-label">
              <strong>Export Debug Log</strong>
              <small>Support tool. Downloads the recorded audit trail so a developer can replay a match. Not a normal backup — never contains your match export.</small>
            </div>
            <button className="btn btn-small btn-secondary" onClick={handleExportDebug}>
              Export
            </button>
          </div>
          {debugStatus && <p className="settings-status">{debugStatus}</p>}
        </div>
      )}
    </div>
  )
}
