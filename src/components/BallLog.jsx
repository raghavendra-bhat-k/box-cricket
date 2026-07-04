import { ballDisplay, formatOvers } from '../utils/scoring'

function getBatterName(team, index) {
  return team?.players?.[index] || `Bat ${index + 1}`
}

// Bowler identity: prefer the name frozen on the ball, then the bowling rotation
// slot, then the batting roster, so it survives export (which drops bowlerName)
// and never falls back to the wrong team's batting name.
function getBowlerName(ball, team) {
  if (ball.bowlerName) return ball.bowlerName
  const idx = ball.bowlerIndex
  return team?.bowlingOrder?.[idx] || team?.players?.[idx] || `Bowl ${idx + 1}`
}

function buildRows(balls, battingTeam, bowlingTeam) {
  let runs = 0
  let wickets = 0
  let legalBalls = 0
  let overStartRuns = 0
  let overStartWickets = 0
  const rows = []

  balls.forEach((ball, index) => {
    const isLegal = !ball.isExtra || (ball.extraType !== 'wide' && ball.extraType !== 'noBall')
    if (isLegal) legalBalls++
    runs += ball.runs + (ball.extraRuns || 0)
    if (ball.isWicket) wickets++

    rows.push({
      type: 'ball',
      key: ball.uid || ball.id || index,
      over: isLegal ? formatOvers(legalBalls) : `${Math.floor(legalBalls / 6)}.${legalBalls % 6}+`,
      display: ballDisplay(ball),
      score: `${runs}/${wickets}`,
      batter: ball.batsmanIndex != null ? getBatterName(battingTeam, ball.batsmanIndex) : '-',
      bowler: ball.bowlerIndex != null ? getBowlerName(ball, bowlingTeam) : '-',
    })

    // End-of-over summary line so a human can reconcile the score at each over.
    if (isLegal && legalBalls % 6 === 0) {
      const overNumber = legalBalls / 6
      rows.push({
        type: 'over',
        key: `over-${overNumber}`,
        overNumber,
        score: `${runs}/${wickets}`,
        runsInOver: runs - overStartRuns,
        wicketsInOver: wickets - overStartWickets,
        bowler: ball.bowlerIndex != null ? getBowlerName(ball, bowlingTeam) : '-',
      })
      overStartRuns = runs
      overStartWickets = wickets
    }
  })

  return rows
}

export default function BallLog({ match, inningsBalls }) {
  const sections = [
    {
      innings: 1,
      title: `${match.teamA.name} innings`,
      battingTeam: match.teamA,
      bowlingTeam: match.teamB,
      balls: inningsBalls[1] || [],
    },
    {
      innings: 2,
      title: `${match.teamB.name} innings`,
      battingTeam: match.teamB,
      bowlingTeam: match.teamA,
      balls: inningsBalls[2] || [],
    },
  ].filter(section => section.balls.length > 0)

  if (sections.length === 0) {
    return <p className="ball-log-empty">No deliveries recorded yet.</p>
  }

  return (
    <div className="ball-log">
      {sections.map(section => (
        <section key={section.innings} className="ball-log-section">
          <h3>{section.title}</h3>
          <div className="ball-log-table">
            <div className="ball-log-head">
              <span>Ball</span>
              <span>Event</span>
              <span>Score</span>
              <span>Batter</span>
              <span>Bowler</span>
            </div>
            {buildRows(section.balls, section.battingTeam, section.bowlingTeam).map(row => (
              row.type === 'over' ? (
                <div key={row.key} className="ball-log-over">
                  <span className="over-label">End of Over {row.overNumber}</span>
                  <span className="over-runs">
                    +{row.runsInOver} run{row.runsInOver !== 1 ? 's' : ''}
                    {row.wicketsInOver > 0 ? `, ${row.wicketsInOver} wkt${row.wicketsInOver !== 1 ? 's' : ''}` : ''}
                  </span>
                  <span className="over-bowler">{row.bowler}</span>
                  <span className="over-score">{row.score}</span>
                </div>
              ) : (
                <div key={row.key} className="ball-log-row">
                  <span>{row.over}</span>
                  <strong>{row.display}</strong>
                  <span>{row.score}</span>
                  <span>{row.batter}</span>
                  <span>{row.bowler}</span>
                </div>
              )
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
