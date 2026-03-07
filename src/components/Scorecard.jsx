import { useState, useEffect } from 'react'
import { getMatch, getBalls } from '../db'
import { calculateScore, formatOvers } from '../utils/scoring'

export default function Scorecard({ matchId, onBack, onResume }) {
  const [match, setMatch] = useState(null)
  const [innings1, setInnings1] = useState(null)
  const [innings2, setInnings2] = useState(null)

  useEffect(() => {
    async function load() {
      const m = await getMatch(matchId)
      setMatch(m)

      const b1 = await getBalls(matchId, 1)
      setInnings1(calculateScore(b1))

      if (m.currentInnings >= 2) {
        const b2 = await getBalls(matchId, 2)
        setInnings2(calculateScore(b2))
      }
    }
    load()
  }, [matchId])

  if (!match || !innings1) return <div className="container">Loading...</div>

  function getPlayerName(team, index, role) {
    const t = team === 'A' ? match.teamA : match.teamB
    return t.players?.[index] || `${role} ${index + 1}`
  }

  function generateShareText() {
    let text = `${match.teamA.name} vs ${match.teamB.name}\n`
    text += `${'─'.repeat(28)}\n\n`

    function inningsText(score, teamName, team, battingTeam, bowlingTeam) {
      let t = `*${teamName}: ${score.runs}/${score.wickets}* (${formatOvers(score.legalBalls)} ov)\n\n`
      const batsmenEntries = Object.entries(score.batsmen).sort(([a], [b]) => Number(a) - Number(b))
      for (const [idx, bat] of batsmenEntries) {
        const name = getPlayerName(battingTeam, Number(idx), 'Bat')
        t += `${name}: ${bat.runs}(${bat.balls}) ${bat.howOut !== 'not out' ? bat.howOut : '*'}\n`
      }
      t += `\nExtras: ${score.extras.wides + score.extras.noBalls + score.extras.byes + score.extras.legByes}\n`

      const bowlerEntries = Object.entries(score.bowlers).sort(([a], [b]) => Number(a) - Number(b))
      if (bowlerEntries.length > 0) {
        t += `\nBowling:\n`
        for (const [idx, bowl] of bowlerEntries) {
          const name = getPlayerName(bowlingTeam, Number(idx), 'Bowl')
          t += `${name}: ${formatOvers(bowl.balls)}-${bowl.runs}-${bowl.wickets}\n`
        }
      }
      return t
    }

    text += inningsText(innings1, match.teamA.name, 'A', 'A', 'B')
    if (innings2) {
      text += `\n${'─'.repeat(28)}\n\n`
      text += inningsText(innings2, match.teamB.name, 'B', 'B', 'A')
    }
    if (match.result) {
      text += `\n${'─'.repeat(28)}\n*${match.result}*`
    }
    return text
  }

  function shareWhatsApp() {
    const text = generateShareText()
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  function copyToClipboard(text) {
    // Fallback for non-secure contexts (HTTP over local IP)
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      alert('Scorecard copied to clipboard!')
    } catch {
      alert('Could not copy. Try sharing via WhatsApp instead.')
    }
    document.body.removeChild(textarea)
  }

  function shareGeneric() {
    const text = generateShareText()
    if (navigator.share) {
      navigator.share({ title: `${match.teamA.name} vs ${match.teamB.name}`, text }).catch(() => {})
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => alert('Scorecard copied to clipboard!'),
        () => copyToClipboard(text)
      )
    } else {
      copyToClipboard(text)
    }
  }

  function renderInnings(score, teamName, battingTeam, bowlingTeam) {
    const batsmenEntries = Object.entries(score.batsmen).sort(([a], [b]) => Number(a) - Number(b))
    const bowlerEntries = Object.entries(score.bowlers).sort(([a], [b]) => Number(a) - Number(b))

    return (
      <div className="scorecard-section">
        <h3>{teamName} - {score.runs}/{score.wickets} ({formatOvers(score.legalBalls)} ov)</h3>

        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Batsman</th>
              <th>How Out</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
            </tr>
          </thead>
          <tbody>
            {batsmenEntries.map(([idx, bat]) => (
              <tr key={idx}>
                <td>{getPlayerName(battingTeam, Number(idx), 'Bat')}</td>
                <td>{bat.howOut}</td>
                <td><strong>{bat.runs}</strong></td>
                <td>{bat.balls}</td>
                <td>{bat.fours}</td>
                <td>{bat.sixes}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>R</th>
              <th>W</th>
              <th>Econ</th>
            </tr>
          </thead>
          <tbody>
            {bowlerEntries.map(([idx, bowl]) => {
              const overs = bowl.balls / 6
              const econ = overs > 0 ? (bowl.runs / overs).toFixed(1) : '-'
              return (
                <tr key={idx}>
                  <td>{getPlayerName(bowlingTeam, Number(idx), 'Bowl')}</td>
                  <td>{formatOvers(bowl.balls)}</td>
                  <td>{bowl.runs}</td>
                  <td><strong>{bowl.wickets}</strong></td>
                  <td>{econ}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ fontSize: 13, color: '#666' }}>
          Extras: {score.extras.wides + score.extras.noBalls + score.extras.byes + score.extras.legByes}
          {' '}(W {score.extras.wides}, NB {score.extras.noBalls}, B {score.extras.byes}, LB {score.extras.legByes})
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-btn" onClick={onBack}>&larr;</button>
        <h2>Scorecard</h2>
      </div>

      {match.result && <div className="result-banner">{match.result}</div>}

      {renderInnings(innings1, match.teamA.name, 'A', 'B')}
      {innings2 && renderInnings(innings2, match.teamB.name, 'B', 'A')}

      <div className="share-buttons">
        <button className="btn btn-whatsapp" onClick={shareWhatsApp}>
          Share on WhatsApp
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={shareGeneric}>
          Copy / Share
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {match.status === 'live' && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onResume}>Resume</button>
        )}
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onBack}>Home</button>
      </div>
    </div>
  )
}
