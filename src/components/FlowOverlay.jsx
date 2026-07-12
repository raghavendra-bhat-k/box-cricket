// A full-screen overlay used for each guided (v2) step. It deliberately covers
// the entire viewport so the current action must be completed before the scoring
// screen is shown again. `step`/`total` render a small progress hint when a
// sequence of steps is being presented.
export default function FlowOverlay({ title, subtitle, step, total, children, onBack }) {
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
        </div>
        <div className="flow-overlay-body">{children}</div>
      </div>
    </div>
  )
}
