import { useState, useEffect, useCallback } from 'react'
import db, { getMatch, updateMatch, getBalls, addBall, removeLastBall, updateBall } from '../db'
import { calculateScore, getCurrentOver, ballDisplay, formatOvers } from '../utils/scoring'
import MiniScorebar from './MiniScorebar'

export default function Scoring({ matchId, onBack, onViewScorecard }) {
  const [match, setMatch] = useState(null)
  const [balls, setBalls] = useState([])
  const [innings, setInnings] = useState(1)
  const [striker, setStriker] = useState(0)
  const [nonStriker, setNonStriker] = useState(1)
  const [bowlerIdx, setBowlerIdx] = useState(0)
  const [sheet, setSheet] = useState(null) // 'wicket' | 'extras' | 'menu' | 'editBall' | 'addPlayer' | 'editNames'
  const [extraType, setExtraType] = useState(null)
  const [extraRuns, setExtraRuns] = useState(1)
  const [showInningsBreak, setShowInningsBreak] = useState(false)
  const [firstInningsScore, setFirstInningsScore] = useState(null)
  const [editingBall, setEditingBall] = useState(null)
  const [addPlayerTeam, setAddPlayerTeam] = useState(null) // 'A' | 'B'
  const [newPlayerName, setNewPlayerName] = useState('')
  const [editNames, setEditNames] = useState({ teamA: [], teamB: [] })

  const loadData = useCallback(async () => {
    const m = await getMatch(matchId)
    if (!m) return
    setMatch(m)
    const currentInnings = m.currentInnings || 1
    setInnings(currentInnings)
    const b = await getBalls(matchId, currentInnings)
    setBalls(b)

    if (currentInnings === 2) {
      const firstBalls = await getBalls(matchId, 1)
      const firstScore = calculateScore(firstBalls)
      setFirstInningsScore(firstScore.runs)
    }
  }, [matchId])

  useEffect(() => { loadData() }, [loadData])

  if (!match) return <div className="container">Loading...</div>

  const battingTeam = innings === 1 ? match.teamA : match.teamB
  const bowlingTeam = innings === 1 ? match.teamB : match.teamA

  function getPlayerName(team, index) {
    const t = team === 'bat' ? battingTeam : bowlingTeam
    return t.players?.[index] || `${team === 'bat' ? 'Bat' : 'Bowl'} ${index + 1}`
  }

  const score = calculateScore(balls)
  const currentOverBalls = getCurrentOver(balls)
  const totalBalls = match.totalOvers * 6

  // For all-out, use the batting team's actual player count (may differ from playersPerSide)
  const battingPlayerCount = battingTeam.players?.length > 0
    ? Math.max(battingTeam.players.length, match.playersPerSide)
    : match.playersPerSide
  const isAllOut = score.wickets >= battingPlayerCount - 1
  const isOversComplete = score.legalBalls >= totalBalls
  const isInningsOver = isAllOut || isOversComplete

  const targetChased = innings === 2 && firstInningsScore != null && score.runs > firstInningsScore

  // Custom rules
  const rules = match.rules || {}
  const runMapObj = rules.runMap || {}
  const disabledRunsSet = new Set(rules.disabledRuns || [])

  function getMappedRuns(tapValue) {
    return runMapObj[tapValue] !== undefined ? runMapObj[tapValue] : tapValue
  }

  // swapRuns = the original tap value (for strike rotation logic)
  // actualRuns = the mapped value (what gets recorded in the DB)
  async function recordBall({ runs = 0, swapRuns, isExtra = false, extraType: et = null, extraRuns: er = 0, isWicket = false, dismissalType = null }) {
    const ball = {
      matchId,
      innings,
      over: Math.floor(score.legalBalls / 6),
      ballInOver: score.legalBalls % 6,
      runs,
      isExtra,
      extraType: et,
      extraRuns: er,
      isWicket,
      dismissalType,
      batsmanIndex: striker,
      bowlerIndex: bowlerIdx,
    }

    await addBall(ball)

    // Use swapRuns (original tap value) for strike rotation, not mapped runs
    const runsForSwap = swapRuns !== undefined ? swapRuns : runs
    const totalSwapRuns = runsForSwap + er
    if (!isWicket && totalSwapRuns % 2 === 1) {
      setStriker(nonStriker)
      setNonStriker(striker)
    }

    if (isWicket) {
      const nextBatsman = Math.max(striker, nonStriker) + 1
      setStriker(nextBatsman)
    }

    const newLegalBalls = score.legalBalls + ((!isExtra || (et !== 'wide' && et !== 'noBall')) ? 1 : 0)
    if (newLegalBalls > 0 && newLegalBalls % 6 === 0 && newLegalBalls !== score.legalBalls) {
      if (!isWicket && totalSwapRuns % 2 === 1) {
        setStriker(s => {
          setNonStriker(s)
          return nonStriker
        })
      } else if (!isWicket) {
        setStriker(nonStriker)
        setNonStriker(striker)
      }
      setBowlerIdx(prev => prev + 1)
    }

    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)

    const newScore = calculateScore(updatedBalls)
    const newBattingCount = battingPlayerCount
    const newIsAllOut = newScore.wickets >= newBattingCount - 1
    const newIsOversComplete = newScore.legalBalls >= totalBalls
    const newTargetChased = innings === 2 && firstInningsScore != null && newScore.runs > firstInningsScore

    if (newIsAllOut || newIsOversComplete || newTargetChased) {
      if (innings === 1 && !newTargetChased) {
        setFirstInningsScore(newScore.runs)
        setShowInningsBreak(true)
      } else {
        await endMatch(newScore)
      }
    }
  }

  async function endMatch(finalScore) {
    let result
    if (innings === 1) {
      result = `${match.teamA.name} scored ${finalScore.runs}/${finalScore.wickets}`
    } else {
      const diff = finalScore.runs - firstInningsScore
      if (diff > 0) {
        const wicketsLeft = battingPlayerCount - 1 - finalScore.wickets
        result = `${match.teamB.name} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`
      } else if (diff === 0) {
        result = 'Match Tied'
      } else {
        result = `${match.teamA.name} won by ${-diff} run${-diff !== 1 ? 's' : ''}`
      }
    }
    await updateMatch(matchId, { status: 'completed', result })
    setMatch(prev => ({ ...prev, status: 'completed', result }))
  }

  async function handleUndo() {
    const removed = await removeLastBall(matchId, innings)
    if (removed) {
      const updatedBalls = await getBalls(matchId, innings)
      setBalls(updatedBalls)
    }
  }

  function swapStriker() {
    setStriker(nonStriker)
    setNonStriker(striker)
  }

  async function startSecondInnings() {
    await updateMatch(matchId, { currentInnings: 2 })
    setInnings(2)
    setStriker(0)
    setNonStriker(1)
    setBowlerIdx(0)
    setShowInningsBreak(false)
    const b = await getBalls(matchId, 2)
    setBalls(b)
    setMatch(prev => ({ ...prev, currentInnings: 2 }))
  }

  function handleRunTap(tapValue) {
    if (isInningsOver || targetChased || match.status === 'completed') return
    const actualRuns = getMappedRuns(tapValue)
    recordBall({ runs: actualRuns, swapRuns: tapValue })
  }

  function handleWicketSelect(dismissalType) {
    recordBall({ runs: 0, isWicket: true, dismissalType })
    setSheet(null)
  }

  function handleExtraConfirm() {
    const isLegalDelivery = extraType === 'bye' || extraType === 'legBye'
    recordBall({
      runs: isLegalDelivery ? extraRuns : 0,
      isExtra: true,
      extraType,
      extraRuns: isLegalDelivery ? 0 : extraRuns,
    })
    setSheet(null)
    setExtraType(null)
    setExtraRuns(1)
  }

  // --- Edit ball ---
  function openEditBall(ball) {
    setEditingBall({ ...ball })
    setSheet('editBall')
  }

  async function saveEditBall() {
    if (!editingBall) return
    const { id, ...changes } = editingBall
    await updateBall(id, changes)
    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    setEditingBall(null)
    setSheet(null)
  }

  // --- Add player ---
  async function handleAddPlayer() {
    if (!newPlayerName.trim()) return
    const teamKey = addPlayerTeam === 'A' ? 'teamA' : 'teamB'
    const team = match[teamKey]
    const updatedPlayers = [...(team.players || []), newPlayerName.trim()]
    await updateMatch(matchId, { [teamKey]: { ...team, players: updatedPlayers } })
    setMatch(prev => ({
      ...prev,
      [teamKey]: { ...prev[teamKey], players: updatedPlayers }
    }))
    setNewPlayerName('')
    setAddPlayerTeam(null)
    setSheet('menu')
  }

  // --- Edit player names ---
  function openEditNames() {
    setEditNames({
      teamA: [...(match.teamA.players || [])],
      teamB: [...(match.teamB.players || [])]
    })
    setSheet('editNames')
  }

  async function saveEditNames() {
    await updateMatch(matchId, {
      teamA: { ...match.teamA, players: editNames.teamA },
      teamB: { ...match.teamB, players: editNames.teamB }
    })
    setMatch(prev => ({
      ...prev,
      teamA: { ...prev.teamA, players: editNames.teamA },
      teamB: { ...prev.teamB, players: editNames.teamB }
    }))
    setSheet(null)
  }

  // Innings break screen
  if (showInningsBreak) {
    return (
      <div className="container innings-break">
        <h2>End of 1st Innings</h2>
        <p>{match.teamA.name}: {firstInningsScore} runs</p>
        <div className="target">Target: {firstInningsScore + 1}</div>
        <p>{match.teamB.name} need {firstInningsScore + 1} runs from {match.totalOvers} overs</p>
        <button className="btn btn-primary btn-large" style={{ marginTop: 20 }} onClick={startSecondInnings}>
          Start 2nd Innings
        </button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={onViewScorecard}>
          View Scorecard
        </button>
      </div>
    )
  }

  // Match completed screen
  if (match.status === 'completed') {
    return (
      <div className="container">
        <div className="result-banner">{match.result}</div>
        <button className="btn btn-primary" onClick={onViewScorecard}>View Full Scorecard</button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={onBack}>Home</button>
      </div>
    )
  }

  return (
    <div className="container scoring-screen">
      <MiniScorebar
        match={match}
        score={score}
        innings={innings}
        onUndo={handleUndo}
        onSwapStriker={swapStriker}
        onMenu={() => setSheet('menu')}
        firstInningsScore={firstInningsScore}
      />

      {/* Scoring grid — large buttons filling available space */}
      <div className="score-grid-large">
        {[0, 1, 2, 3].map(tap => {
          if (disabledRunsSet.has(tap)) return null
          const mapped = getMappedRuns(tap)
          const isMapped = mapped !== tap
          const label = isMapped ? `${tap}\u2192${mapped}` : String(tap)
          return <button key={tap} className={`score-btn-lg run${isMapped ? ' mapped' : ''}`} onClick={() => handleRunTap(tap)}>{label}</button>
        })}
        {[4, 6].map(tap => {
          if (disabledRunsSet.has(tap)) return null
          const mapped = getMappedRuns(tap)
          const isMapped = mapped !== tap
          const label = isMapped ? `${tap}\u2192${mapped}` : String(tap)
          return <button key={tap} className={`score-btn-lg boundary${isMapped ? ' mapped' : ''}`} onClick={() => handleRunTap(tap)}>{label}</button>
        })}
        <button className="score-btn-lg wicket" onClick={() => { if (!isInningsOver) setSheet('wicket') }}>W</button>
        <button className="score-btn-lg extra" onClick={() => { if (!isInningsOver) setSheet('extras') }}>EX</button>
      </div>

      {/* Current over — tappable for edit */}
      <div className="card">
        <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
          Over {Math.floor(score.legalBalls / 6) + (score.legalBalls % 6 > 0 ? 1 : 0)}
        </div>
        <div className="current-over">
          {currentOverBalls.map((b, i) => {
            let cls = 'ball-dot'
            if (b.isWicket) cls += ' wicket'
            else if (b.runs === 4 || b.runs === 6) cls += ' boundary'
            else if (b.isExtra) cls += ' extra'
            return <div key={i} className={cls} onClick={() => openEditBall(b)}>{ballDisplay(b)}</div>
          })}
          {currentOverBalls.length === 0 && <span style={{ color: '#999', fontSize: 13 }}>New over</span>}
        </div>
      </div>

      {/* Batsmen info */}
      <div className="card compact-info">
        <div className="player-info">
          <span className="name striker">*{getPlayerName('bat', striker)}</span>: {score.batsmen[striker]?.runs || 0} ({score.batsmen[striker]?.balls || 0})
        </div>
        <div className="player-info">
          <span className="name">{getPlayerName('bat', nonStriker)}</span>: {score.batsmen[nonStriker]?.runs || 0} ({score.batsmen[nonStriker]?.balls || 0})
        </div>
        <div className="player-info" style={{ marginTop: 4 }}>
          {getPlayerName('bowl', bowlerIdx)}: {score.bowlers[bowlerIdx] ? `${formatOvers(score.bowlers[bowlerIdx].balls)}-${score.bowlers[bowlerIdx].runs}-${score.bowlers[bowlerIdx].wickets}` : '0.0-0-0'}
        </div>
      </div>

      {/* Wicket bottom sheet */}
      {sheet === 'wicket' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Dismissal Type</h3>
            <div className="sheet-options">
              {['Bowled', 'Caught', 'Run Out', 'Stumped', 'LBW', 'Hit Wicket'].map(type => (
                <button key={type} className="sheet-option" onClick={() => handleWicketSelect(type.toLowerCase())}>
                  {type}
                </button>
              ))}
            </div>
            <button className="sheet-cancel" onClick={() => setSheet(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Extras bottom sheet */}
      {sheet === 'extras' && (
        <div className="bottom-sheet-overlay" onClick={() => { setSheet(null); setExtraType(null) }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Extra Type</h3>
            {!extraType ? (
              <div className="sheet-options">
                {[['Wide', 'wide'], ['No Ball', 'noBall'], ['Bye', 'bye'], ['Leg Bye', 'legBye']].map(([label, val]) => (
                  <button key={val} className="sheet-option" onClick={() => setExtraType(val)}>
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600 }}>
                  {extraType === 'wide' ? 'Wide' : extraType === 'noBall' ? 'No Ball' : extraType === 'bye' ? 'Bye' : 'Leg Bye'} — Runs:
                </p>
                <div className="extras-runs">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      className={extraRuns === n ? 'selected' : ''}
                      onClick={() => setExtraRuns(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={handleExtraConfirm}>
                  Confirm
                </button>
              </>
            )}
            <button className="sheet-cancel" onClick={() => { setSheet(null); setExtraType(null) }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Three-dot menu */}
      {sheet === 'menu' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Match Options</h3>
            <div className="menu-list">
              <button className="menu-item" onClick={() => { setAddPlayerTeam('A'); setSheet('addPlayer') }}>
                Add Player to {match.teamA.name}
              </button>
              <button className="menu-item" onClick={() => { setAddPlayerTeam('B'); setSheet('addPlayer') }}>
                Add Player to {match.teamB.name}
              </button>
              <button className="menu-item" onClick={openEditNames}>
                Edit Player Names
              </button>
              <button className="menu-item" onClick={() => { setSheet(null); onViewScorecard() }}>
                View Scorecard
              </button>
              <button className="menu-item" onClick={() => { setSheet(null); onBack() }}>
                Home
              </button>
            </div>
            <button className="sheet-cancel" onClick={() => setSheet(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Add player sheet */}
      {sheet === 'addPlayer' && (
        <div className="bottom-sheet-overlay" onClick={() => { setSheet('menu'); setNewPlayerName('') }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Add Player to {addPlayerTeam === 'A' ? match.teamA.name : match.teamB.name}</h3>
            <div className="form-group">
              <input
                type="text"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAddPlayer} disabled={!newPlayerName.trim()}>
              Add Player
            </button>
            <button className="sheet-cancel" onClick={() => { setSheet('menu'); setNewPlayerName('') }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit player names sheet */}
      {sheet === 'editNames' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet('menu')}>
          <div className="bottom-sheet edit-names-sheet" onClick={e => e.stopPropagation()}>
            <h3>Edit Player Names</h3>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              <label style={{ fontWeight: 600, fontSize: 14, color: '#666', display: 'block', marginBottom: 6 }}>
                {match.teamA.name}
              </label>
              {editNames.teamA.map((name, i) => (
                <input
                  key={`ea-${i}`}
                  type="text"
                  value={name}
                  onChange={e => {
                    const arr = [...editNames.teamA]
                    arr[i] = e.target.value
                    setEditNames(prev => ({ ...prev, teamA: arr }))
                  }}
                  placeholder={`Player ${i + 1}`}
                  style={{ width: '100%', padding: 10, border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 15, marginBottom: 6 }}
                />
              ))}
              <label style={{ fontWeight: 600, fontSize: 14, color: '#666', display: 'block', margin: '12px 0 6px' }}>
                {match.teamB.name}
              </label>
              {editNames.teamB.map((name, i) => (
                <input
                  key={`eb-${i}`}
                  type="text"
                  value={name}
                  onChange={e => {
                    const arr = [...editNames.teamB]
                    arr[i] = e.target.value
                    setEditNames(prev => ({ ...prev, teamB: arr }))
                  }}
                  placeholder={`Player ${i + 1}`}
                  style={{ width: '100%', padding: 10, border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 15, marginBottom: 6 }}
                />
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={saveEditNames}>
              Save Names
            </button>
            <button className="sheet-cancel" onClick={() => setSheet('menu')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit ball sheet */}
      {sheet === 'editBall' && editingBall && (
        <div className="bottom-sheet-overlay" onClick={() => { setSheet(null); setEditingBall(null) }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Edit Delivery</h3>
            <div className="edit-ball-section">
              <label>Runs</label>
              <div className="edit-ball-runs">
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <button
                    key={r}
                    className={`edit-run-btn ${editingBall.runs === r && !editingBall.isExtra && !editingBall.isWicket ? 'selected' : ''}`}
                    onClick={() => setEditingBall(prev => ({ ...prev, runs: r, isExtra: false, isWicket: false, extraType: null, extraRuns: 0, dismissalType: null }))}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="edit-ball-section">
              <label>Or mark as:</label>
              <div className="edit-ball-runs">
                <button
                  className={`edit-run-btn wicket-sel ${editingBall.isWicket ? 'selected' : ''}`}
                  onClick={() => setEditingBall(prev => ({ ...prev, isWicket: true, runs: 0, isExtra: false, dismissalType: prev.dismissalType || 'bowled' }))}
                >
                  W
                </button>
                <button
                  className={`edit-run-btn extra-sel ${editingBall.isExtra && editingBall.extraType === 'wide' ? 'selected' : ''}`}
                  onClick={() => setEditingBall(prev => ({ ...prev, isExtra: true, extraType: 'wide', isWicket: false, runs: 0, extraRuns: prev.extraRuns || 1 }))}
                >
                  Wd
                </button>
                <button
                  className={`edit-run-btn extra-sel ${editingBall.isExtra && editingBall.extraType === 'noBall' ? 'selected' : ''}`}
                  onClick={() => setEditingBall(prev => ({ ...prev, isExtra: true, extraType: 'noBall', isWicket: false, runs: 0, extraRuns: prev.extraRuns || 1 }))}
                >
                  Nb
                </button>
              </div>
            </div>
            {editingBall.isExtra && (
              <div className="edit-ball-section">
                <label>Extra runs</label>
                <div className="edit-ball-runs">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      className={`edit-run-btn ${editingBall.extraRuns === n ? 'selected' : ''}`}
                      onClick={() => setEditingBall(prev => ({ ...prev, extraRuns: n }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={saveEditBall}>
              Save Changes
            </button>
            <button className="sheet-cancel" onClick={() => { setSheet(null); setEditingBall(null) }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
