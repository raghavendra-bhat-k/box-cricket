import { formatOvers, calculateRR, calculateRequiredRR } from '../utils/scoring'

export default function MiniScorebar({
  match, score, innings, onUndo, onSwapStriker, onMenu, firstInningsScore
}) {
  const battingTeam = innings === 1 ? match.teamA.name : match.teamB.name
  const rr = calculateRR(score.runs, score.legalBalls)

  let target = null
  let rrr = null
  if (innings === 2 && firstInningsScore != null) {
    target = firstInningsScore + 1
    rrr = calculateRequiredRR(target, score.runs, score.legalBalls, match.totalOvers)
  }

  return (
    <div className="scorebar">
      <div className="scorebar-main">
        <span>{battingTeam}: {score.runs}/{score.wickets}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>({formatOvers(score.legalBalls)} ov)</span>
          <button className="menu-dots" onClick={onMenu} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
              <circle cx="10" cy="4" r="2" />
              <circle cx="10" cy="10" r="2" />
              <circle cx="10" cy="16" r="2" />
            </svg>
          </button>
        </div>
      </div>
      <div className="scorebar-sub">
        <span>RR: {rr}</span>
        {target && <span>Target: {target} | RRR: {rrr}</span>}
      </div>
      <div className="scorebar-actions">
        <button onClick={onUndo}>Undo</button>
        <button onClick={onSwapStriker}>Swap Striker</button>
      </div>
    </div>
  )
}
