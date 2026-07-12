import Icon from './Icon'

// A full-screen overlay used for each guided (v2) step. It deliberately covers
// the entire viewport so the current action must be completed before the scoring
// screen is shown again. `step`/`total` render a small progress hint when a
// sequence of steps is being presented. `onHome`, when provided, renders a Home
// escape so the user is never trapped on a full-screen step.
export default function FlowOverlay({ title, subtitle, step, total, children, onBack, onHome }) {
  return (
    <div className="flow-overlay">
      <div className="flow-overlay-inner">
        <div className="flow-overlay-head">
          {onBack && <button className="flow-back" onClick={onBack} aria-label="Back">&larr;</button>}
          <div className="flow-heading">
            <h2>{title}</h2>
            {subtitle && <p className="flow-subtitle">{subtitle}</p>}
          </div>
          {total > 1 && <span className="flow-progress">{step}/{total}</span>}
          {onHome && (
            <button className="flow-home" onClick={onHome} aria-label="Home" title="Home">
              <Icon name="home" size={20} label="Home" />
            </button>
          )}
        </div>
        <div className="flow-overlay-body">{children}</div>
      </div>
    </div>
  )
}
