import { useState, useEffect, useCallback } from 'react'
import { getMatch, updateMatch, getBalls, addBall, removeLastBall, updateBall } from '../db'
import { calculateScore, getCurrentOver, ballDisplay, formatOvers, restoreStateFromBalls } from '../utils/scoring'
import MiniScorebar from './MiniScorebar'
import BallLog from './BallLog'
import Icon from './Icon'
import DragList from './DragList'

export default function Scoring({ matchId, onBack, onViewScorecard, onShareSync }) {
  const [match, setMatch] = useState(null)
  const [balls, setBalls] = useState([])
  const [innings, setInnings] = useState(1)
  const [striker, setStriker] = useState(0)
  const [nonStriker, setNonStriker] = useState(1)
  const [bowlerIdx, setBowlerIdx] = useState(0)
  const [sheet, setSheet] = useState(null) // 'wicket' | 'extras' | 'menu' | 'editBall' | 'addPlayer' | 'editNames' | 'changeTeamSizes' | 'changeOvers' | 'removePlayer' | 'bowlerSelect' | 'nextBatsman'
  const [pendingWicketNextStriker, setPendingWicketNextStriker] = useState(null) // new striker index after wicket
  const [pendingBowlerIdx, setPendingBowlerIdx] = useState(null)
  const [editBowlerName, setEditBowlerName] = useState('')
  const [bowlerSearch, setBowlerSearch] = useState('')
  const [bowlerChangePending, setBowlerChangePending] = useState(false)
  const [extraType, setExtraType] = useState(null)
  const [extraRuns, setExtraRuns] = useState(1)
  const [noBallBatsmanRuns, setNoBallBatsmanRuns] = useState(0)
  const [customExtraInput, setCustomExtraInput] = useState(false)
  const [wicketDismissalType, setWicketDismissalType] = useState(null)
  const [wicketRuns, setWicketRuns] = useState(0)
  const [customWicketInput, setCustomWicketInput] = useState(false)
  const [showInningsBreak, setShowInningsBreak] = useState(false)
  const [inningsEndReason, setInningsEndReason] = useState(null)
  const [firstInningsScore, setFirstInningsScore] = useState(null)
  const [editingBall, setEditingBall] = useState(null)
  const [editBallCustom, setEditBallCustom] = useState(false)
  const [editBallCustomExtras, setEditBallCustomExtras] = useState(false)
  const [addPlayerTeam, setAddPlayerTeam] = useState(null) // 'A' | 'B'
  const [newPlayerName, setNewPlayerName] = useState('')
  const [editNames, setEditNames] = useState({ teamA: [], teamB: [] })
  const [teamSizesInput, setTeamSizesInput] = useState({ teamASize: 0, teamBSize: 0 })
  const [oversInput, setOversInput] = useState(0)
  const [removePlayerTeam, setRemovePlayerTeam] = useState('A')
  const [allInningsBalls, setAllInningsBalls] = useState({ 1: [], 2: [] })

  function updateBallsState(inningsNumber, updatedBalls) {
    setAllInningsBalls(prev => ({ ...prev, [inningsNumber]: updatedBalls }))
    if (inningsNumber === innings) setBalls(updatedBalls)
  }

  const loadData = useCallback(async () => {
    const m = await getMatch(matchId)
    if (!m) return
    setMatch(m)
    const currentInnings = m.currentInnings || 1
    setInnings(currentInnings)
    const b = await getBalls(matchId, currentInnings)
    setBalls(b)
    setAllInningsBalls(prev => ({ ...prev, [currentInnings]: b }))

    // Restore player positions from ball history
    if (b.length > 0) {
      const restored = restoreStateFromBalls(b)
      setStriker(restored.striker)
      setNonStriker(restored.nonStriker)
      setBowlerIdx(restored.bowlerIdx)
    }

    if (currentInnings === 2) {
      const firstBalls = await getBalls(matchId, 1)
      setAllInningsBalls(prev => ({ ...prev, 1: firstBalls }))
      const firstScore = calculateScore(firstBalls)
      setFirstInningsScore(firstScore.runs)
    }

    // Detect if 1st innings was complete but break wasn't shown yet
    if (currentInnings === 1 && b.length > 0) {
      const s = calculateScore(b)
      const tASize = m.teamASize ?? m.playersPerSide
      const battingCount = Math.max(m.teamA.players?.length || 0, tASize)
      const allOut = s.wickets >= battingCount - 1
      const oversComplete = s.legalBalls >= m.totalOvers * 6
      if (allOut || oversComplete) {
        setFirstInningsScore(s.runs)
        setInningsEndReason(allOut ? 'all-out' : 'overs-complete')
        setShowInningsBreak(true)
      }
    }
  }, [matchId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData() }, [loadData])

  if (!match) return <div className="container">Loading...</div>

  const battingTeam = innings === 1 ? match.teamA : match.teamB
  const bowlingTeam = innings === 1 ? match.teamB : match.teamA

  function getPlayerName(team, index) {
    if (team === 'bat') {
      return battingTeam.players?.[index] || `Bat ${index + 1}`
    }
    // For bowlers: prefer bowlingOrder (separate bowling rotation) over players
    const bowlingOrder = bowlingTeam.bowlingOrder
    if (bowlingOrder && bowlingOrder[index]) return bowlingOrder[index]
    return bowlingTeam.players?.[index] || `Bowl ${index + 1}`
  }

  const score = calculateScore(balls)
  const currentOverBalls = getCurrentOver(balls)
  const totalBalls = match.totalOvers * 6

  // Per-team sizes with fallback to playersPerSide for backward compat
  const teamASize = match.teamASize ?? match.playersPerSide
  const teamBSize = match.teamBSize ?? match.playersPerSide
  const currentTeamSize = innings === 1 ? teamASize : teamBSize
  const battingPlayerCount = Math.max(battingTeam.players?.length || 0, currentTeamSize)
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
    setBowlerChangePending(false) // clear banner when new ball is recorded
    const ball = {
      matchId,
      innings,
      over: Math.floor(score.legalBalls / 6),
      ballInOver: score.legalBalls % 6,
      runs,
      tapRuns: swapRuns !== undefined ? swapRuns : runs,
      isExtra,
      extraType: et,
      extraRuns: er,
      isWicket,
      dismissalType,
      batsmanIndex: striker,
      bowlerIndex: bowlerIdx,
      bowlerName: getPlayerName('bowl', bowlerIdx),
    }

    await addBall(ball)

    // Compute new positions with local variables to avoid stale closure bugs
    let newStriker = striker
    let newNonStriker = nonStriker
    let newBowlerIdx = bowlerIdx

    const physicalRuns = swapRuns !== undefined ? swapRuns : runs
    const runsForRotation = (isExtra && et === 'wide')
      ? 0  // wide: penalty never rotates strike
      : (isExtra && et === 'noBall')
        ? physicalRuns  // no-ball: batsman runs only, no penalty
        : physicalRuns + er

    if (!isWicket && runsForRotation % 2 === 1) {
      ;[newStriker, newNonStriker] = [newNonStriker, newStriker]
    }

    const autoNextStriker = Math.max(newStriker, newNonStriker) + 1
    if (isWicket) {
      newStriker = autoNextStriker
    }

    const isLegal = !isExtra || (et !== 'wide' && et !== 'noBall')
    const newLegalBalls = score.legalBalls + (isLegal ? 1 : 0)
    let overJustEnded = false
    if (newLegalBalls > 0 && newLegalBalls % 6 === 0 && isLegal) {
      if (!isWicket) {
        ;[newStriker, newNonStriker] = [newNonStriker, newStriker]
      }
      newBowlerIdx++
      overJustEnded = true
    }

    setStriker(newStriker)
    setNonStriker(newNonStriker)
    setBowlerIdx(newBowlerIdx)

    const updatedBalls = await getBalls(matchId, innings)
    updateBallsState(innings, updatedBalls)

    const newScore = calculateScore(updatedBalls)
    const newBattingCount = battingPlayerCount
    const newIsAllOut = newScore.wickets >= newBattingCount - 1
    const newIsOversComplete = newScore.legalBalls >= totalBalls
    const newTargetChased = innings === 2 && firstInningsScore != null && newScore.runs > firstInningsScore

    if (newIsAllOut || newIsOversComplete || newTargetChased) {
      if (innings === 1 && !newTargetChased) {
        setFirstInningsScore(newScore.runs)
        setInningsEndReason(newIsAllOut ? 'all-out' : 'overs-complete')
        setShowInningsBreak(true)
      } else {
        await endMatch(newScore)
      }
    } else if (isWicket && !newIsAllOut) {
      // Show "Who's next?" picker if batting team has named players beyond auto-next index
      const namedPlayers = battingTeam.players || []
      if (namedPlayers.length > autoNextStriker) {
        setPendingWicketNextStriker(autoNextStriker)
        setSheet('nextBatsman')
      }
    } else if (overJustEnded) {
      // Non-blocking: show a banner to remind scorer to change bowler
      setBowlerChangePending(true)
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
      updateBallsState(innings, updatedBalls)
      recalculateState(updatedBalls)
    }
  }

  function recalculateState(updatedBalls) {
    if (updatedBalls.length > 0) {
      const restored = restoreStateFromBalls(updatedBalls)
      setStriker(restored.striker)
      setNonStriker(restored.nonStriker)
      setBowlerIdx(restored.bowlerIdx)
    } else {
      setStriker(0)
      setNonStriker(1)
      setBowlerIdx(0)
    }
  }

  function swapStriker() {
    setStriker(nonStriker)
    setNonStriker(striker)
  }

  function openBowlerSelect() {
    setPendingBowlerIdx(bowlerIdx)
    setBowlerSearch('')
    setSheet('bowlerSelect')
  }

  function selectBowler(idx) {
    setBowlerIdx(idx)
    setSheet(null)
    setPendingBowlerIdx(null)
  }

  async function saveBowlerName() {
    const name = editBowlerName.trim()
    if (!name) return
    const bowlingTeamKey = innings === 1 ? 'teamB' : 'teamA'
    const team = match[bowlingTeamKey]
    const idx = pendingBowlerIdx ?? bowlerIdx
    const bowlingOrder = [...(team.bowlingOrder || team.players || [])]
    while (bowlingOrder.length <= idx) bowlingOrder.push('')
    bowlingOrder[idx] = name
    await updateMatch(matchId, { [bowlingTeamKey]: { ...team, bowlingOrder } })
    setMatch(prev => ({ ...prev, [bowlingTeamKey]: { ...prev[bowlingTeamKey], bowlingOrder } }))
    setEditBowlerName('')
  }

  async function saveBowlingOrder(newOrder) {
    const bowlingTeamKey = innings === 1 ? 'teamB' : 'teamA'
    const team = match[bowlingTeamKey]
    await updateMatch(matchId, { [bowlingTeamKey]: { ...team, bowlingOrder: newOrder } })
    setMatch(prev => ({ ...prev, [bowlingTeamKey]: { ...prev[bowlingTeamKey], bowlingOrder: newOrder } }))
  }

  async function selectBowlerByName(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    const bowlingTeamKey = innings === 1 ? 'teamB' : 'teamA'
    const team = match[bowlingTeamKey]
    const idx = pendingBowlerIdx ?? bowlerIdx
    const bowlingOrder = [...(team.bowlingOrder || team.players || [])]
    while (bowlingOrder.length <= idx) bowlingOrder.push('')
    bowlingOrder[idx] = trimmed
    await updateMatch(matchId, { [bowlingTeamKey]: { ...team, bowlingOrder } })
    setMatch(prev => ({ ...prev, [bowlingTeamKey]: { ...prev[bowlingTeamKey], bowlingOrder } }))
    setBowlerIdx(idx)
    setSheet(null)
    setPendingBowlerIdx(null)
    setBowlerSearch('')
    setEditBowlerName('')
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
    setAllInningsBalls(prev => ({ ...prev, 2: b }))
    setMatch(prev => ({ ...prev, currentInnings: 2 }))
  }

  function handleRunTap(tapValue) {
    if (isInningsOver || targetChased || match.status === 'completed') return
    const actualRuns = getMappedRuns(tapValue)
    recordBall({ runs: actualRuns, swapRuns: tapValue })
  }

  function handleWicketSelectType(dismissalType) {
    setWicketDismissalType(dismissalType)
    setWicketRuns(0)
  }

  function handleWicketConfirm() {
    recordBall({ runs: wicketRuns, isWicket: true, dismissalType: wicketDismissalType })
    setSheet(null)
    setWicketDismissalType(null)
    setWicketRuns(0)
    setCustomWicketInput(false)
  }

  function handleExtraConfirm() {
    const isLegalDelivery = extraType === 'bye' || extraType === 'legBye'
    const isNoBall = extraType === 'noBall'

    let ballRuns, extraRunsVal, swapRunsVal
    if (isNoBall) {
      ballRuns = getMappedRuns(noBallBatsmanRuns)
      extraRunsVal = 1
      swapRunsVal = noBallBatsmanRuns
    } else if (isLegalDelivery) {
      ballRuns = extraRuns
      extraRunsVal = 0
      swapRunsVal = undefined
    } else {
      // wide
      ballRuns = 0
      extraRunsVal = extraRuns
      swapRunsVal = undefined
    }

    recordBall({
      runs: ballRuns,
      swapRuns: swapRunsVal,
      isExtra: true,
      extraType,
      extraRuns: extraRunsVal,
    })
    setSheet(null)
    setExtraType(null)
    setExtraRuns(1)
    setNoBallBatsmanRuns(0)
    setCustomExtraInput(false)
  }

  // --- Edit ball ---
  function openEditBall(ball) {
    setEditingBall({ ...ball })
    setEditBallCustom(![0, 1, 2, 3, 4, 6].includes(ball.runs) && !ball.isExtra && !ball.isWicket)
    setEditBallCustomExtras(ball.isExtra && ![1, 2, 3, 4, 6].includes(ball.extraRuns))
    setSheet('editBall')
  }

  async function saveEditBall() {
    if (!editingBall) return
    const { id, ...changes } = editingBall
    await updateBall(id, changes)
    const updatedBalls = await getBalls(matchId, innings)
    updateBallsState(innings, updatedBalls)
    recalculateState(updatedBalls)
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
  function ensureSlots(players, size) {
    const arr = [...(players || [])]
    while (arr.length < size) arr.push('')
    return arr
  }

  function openEditNames() {
    const aSize = match.teamASize ?? match.playersPerSide
    const bSize = match.teamBSize ?? match.playersPerSide
    setEditNames({
      teamA: ensureSlots(match.teamA.players, aSize),
      teamB: ensureSlots(match.teamB.players, bSize)
    })
    setSheet('editNames')
  }

  function movePlayer(team, fromIdx, toIdx) {
    setEditNames(prev => {
      const arr = [...prev[team]]
      const [removed] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, removed)
      return { ...prev, [team]: arr }
    })
  }

  async function saveEditNames() {
    const cleanA = editNames.teamA.map(n => n.trim())
    const cleanB = editNames.teamB.map(n => n.trim())
    await updateMatch(matchId, {
      teamA: { ...match.teamA, players: cleanA },
      teamB: { ...match.teamB, players: cleanB }
    })
    setMatch(prev => ({
      ...prev,
      teamA: { ...prev.teamA, players: cleanA },
      teamB: { ...prev.teamB, players: cleanB }
    }))
    setSheet(null)
  }

  // --- Change team sizes ---
  function openChangeTeamSizes() {
    setTeamSizesInput({
      teamASize: match.teamASize ?? match.playersPerSide,
      teamBSize: match.teamBSize ?? match.playersPerSide
    })
    setSheet('changeTeamSizes')
  }

  async function saveTeamSizes() {
    const minA = innings === 1 ? score.wickets + 2 : 1
    const minB = innings === 2 ? score.wickets + 2 : 1
    const safeA = Math.max(teamSizesInput.teamASize, minA)
    const safeB = Math.max(teamSizesInput.teamBSize, minB)
    await updateMatch(matchId, { teamASize: safeA, teamBSize: safeB })
    setMatch(prev => ({ ...prev, teamASize: safeA, teamBSize: safeB }))
    setSheet(null)
  }

  // --- Change overs ---
  function openChangeOvers() {
    setOversInput(match.totalOvers)
    setSheet('changeOvers')
  }

  async function saveOvers() {
    const minOvers = Math.ceil(score.legalBalls / 6)
    const safeOvers = Math.max(oversInput, minOvers)
    await updateMatch(matchId, { totalOvers: safeOvers })
    setMatch(prev => ({ ...prev, totalOvers: safeOvers }))
    setSheet(null)
  }

  // --- Remove player ---
  async function handleRemovePlayer(teamKey, index) {
    const team = match[teamKey]
    const updatedPlayers = [...(team.players || [])]
    updatedPlayers.splice(index, 1)
    await updateMatch(matchId, { [teamKey]: { ...team, players: updatedPlayers } })
    setMatch(prev => ({
      ...prev,
      [teamKey]: { ...prev[teamKey], players: updatedPlayers }
    }))
  }

  // Innings break screen
  if (showInningsBreak) {
    const reasonText = inningsEndReason === 'all-out'
      ? `All batsmen out`
      : `${match.totalOvers} overs completed`
    return (
      <div className="container innings-break">
        <h2>End of 1st Innings</h2>
        <div className="innings-end-reason">{reasonText}</div>
        <p>{match.teamA.name}: {firstInningsScore} runs</p>
        <div className="target">Target: {firstInningsScore + 1}</div>
        <p>{match.teamB.name} need {firstInningsScore + 1} runs from {match.totalOvers} overs</p>
        <button className="btn btn-primary btn-large" style={{ marginTop: 20 }} onClick={startSecondInnings}>
          Start 2nd Innings
        </button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => setShowInningsBreak(false)}>
          ← Continue in 1st Innings
        </button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={onViewScorecard}>
          View Scorecard
        </button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => setSheet('ballLog')}>
          <Icon name="list" /> Ball by Ball
        </button>
        {sheet === 'ballLog' && (
          <div className="bottom-sheet-overlay" onClick={() => setSheet(null)}>
            <div className="bottom-sheet import-sheet" onClick={e => e.stopPropagation()}>
              <h3>Ball by Ball</h3>
              <BallLog match={match} inningsBalls={{ ...allInningsBalls, [innings]: balls }} />
              <button className="sheet-cancel" onClick={() => setSheet(null)}>Close</button>
            </div>
          </div>
        )}
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

      {/* Innings complete banner — shown when innings is over but user chose to stay */}
      {isInningsOver && innings === 1 && !targetChased && (
        <button className="innings-complete-banner" onClick={() => setShowInningsBreak(true)}>
          1st innings complete ({inningsEndReason === 'all-out' ? 'all out' : `${match.totalOvers} overs done`}) — Tap to start 2nd innings →
        </button>
      )}

      {/* Non-blocking bowler change reminder — disappears on next ball */}
      {bowlerChangePending && !isInningsOver && (
        <div className="bowler-change-banner">
          <span>Over done — <strong>{getPlayerName('bowl', bowlerIdx)}</strong> bowling next</span>
          <button onClick={() => { openBowlerSelect() }}>Change</button>
          <button className="dismiss-x" onClick={() => setBowlerChangePending(false)}>✕</button>
        </div>
      )}

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
          <span className="name" style={{ cursor: 'pointer', textDecoration: 'underline dotted', color: 'var(--green-dark)' }} onClick={openBowlerSelect}>
            {getPlayerName('bowl', bowlerIdx)}
          </span>: {score.bowlers[bowlerIdx] ? `${formatOvers(score.bowlers[bowlerIdx].balls)}-${score.bowlers[bowlerIdx].runs}-${score.bowlers[bowlerIdx].wickets}` : '0.0-0-0'}
        </div>
      </div>

      {/* Wicket bottom sheet */}
      {sheet === 'wicket' && (
        <div className="bottom-sheet-overlay" onClick={() => { setSheet(null); setWicketDismissalType(null); setWicketRuns(0); setCustomWicketInput(false) }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Wicket</h3>
            {!wicketDismissalType ? (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Dismissal Type</p>
                <div className="sheet-options">
                  {['Bowled', 'Caught', 'Run Out', 'Stumped', 'LBW', 'Hit Wicket'].map(type => (
                    <button key={type} className="sheet-option" onClick={() => handleWicketSelectType(type.toLowerCase())}>
                      {type}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>
                  {wicketDismissalType.replace(/\b\w/g, c => c.toUpperCase())} — Runs scored:
                </p>
                <div className="extras-runs">
                  {[0, 1, 2, 3, 4, 6].map(n => (
                    <button
                      key={n}
                      className={`${wicketRuns === n && !customWicketInput ? 'selected' : ''}`}
                      onClick={() => { setWicketRuns(n); setCustomWicketInput(false) }}
                    >
                      {n}
                    </button>
                  ))}
                  {!customWicketInput ? (
                    <button onClick={() => { setCustomWicketInput(true); setWicketRuns(5) }}>+</button>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      className="custom-number-input"
                      value={wicketRuns}
                      onChange={e => setWicketRuns(Math.max(0, parseInt(e.target.value) || 0))}
                      autoFocus
                    />
                  )}
                </div>
                <button className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={handleWicketConfirm}>
                  Confirm
                </button>
              </>
            )}
            <button className="sheet-cancel" onClick={() => { setSheet(null); setWicketDismissalType(null); setWicketRuns(0); setCustomWicketInput(false) }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Extras bottom sheet */}
      {sheet === 'extras' && (
        <div className="bottom-sheet-overlay" onClick={() => { setSheet(null); setExtraType(null); setNoBallBatsmanRuns(0); setCustomExtraInput(false) }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Extra Type</h3>
            {!extraType ? (
              <div className="sheet-options">
                {[['Wide', 'wide'], ['No Ball', 'noBall'], ['Bye', 'bye'], ['Leg Bye', 'legBye']].map(([label, val]) => (
                  <button key={val} className="sheet-option" onClick={() => { setExtraType(val); setNoBallBatsmanRuns(0); setCustomExtraInput(false) }}>
                    {label}
                  </button>
                ))}
              </div>
            ) : extraType === 'noBall' ? (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600 }}>
                  No Ball — Batsman runs (0 = just penalty):
                </p>
                <div className="extras-runs">
                  {[0, 1, 2, 4, 6].map(n => (
                    <button
                      key={n}
                      className={`${noBallBatsmanRuns === n && !customExtraInput ? 'selected' : ''}`}
                      onClick={() => { setNoBallBatsmanRuns(n); setCustomExtraInput(false) }}
                    >
                      {n}
                    </button>
                  ))}
                  {!customExtraInput ? (
                    <button onClick={() => { setCustomExtraInput(true); setNoBallBatsmanRuns(3) }}>+</button>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      className="custom-number-input"
                      value={noBallBatsmanRuns}
                      onChange={e => setNoBallBatsmanRuns(Math.max(0, parseInt(e.target.value) || 0))}
                      autoFocus
                    />
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 8 }}>
                  Total: {getMappedRuns(noBallBatsmanRuns) + 1} runs (1 penalty + {getMappedRuns(noBallBatsmanRuns)} batsman)
                </p>
                <button className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={handleExtraConfirm}>
                  Confirm
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600 }}>
                  {extraType === 'wide' ? 'Wide' : extraType === 'bye' ? 'Bye' : 'Leg Bye'} — Runs:
                </p>
                <div className="extras-runs">
                  {[1, 2, 3, 4, 6].map(n => (
                    <button
                      key={n}
                      className={`${extraRuns === n && !customExtraInput ? 'selected' : ''}`}
                      onClick={() => { setExtraRuns(n); setCustomExtraInput(false) }}
                    >
                      {n}
                    </button>
                  ))}
                  {!customExtraInput ? (
                    <button onClick={() => { setCustomExtraInput(true); setExtraRuns(7) }}>+</button>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      className="custom-number-input"
                      value={extraRuns}
                      onChange={e => setExtraRuns(Math.max(1, parseInt(e.target.value) || 1))}
                      autoFocus
                    />
                  )}
                </div>
                <button className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={handleExtraConfirm}>
                  Confirm
                </button>
              </>
            )}
            <button className="sheet-cancel" onClick={() => { setSheet(null); setExtraType(null); setNoBallBatsmanRuns(0); setCustomExtraInput(false) }}>Cancel</button>
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
              <button className="menu-item" onClick={() => { setSheet(null); openBowlerSelect() }}>
                Change Bowler
              </button>
              <button className="menu-item" onClick={openEditNames}>
                Edit Player Names
              </button>
              <button className="menu-item" onClick={() => { setRemovePlayerTeam('A'); setSheet('removePlayer') }}>
                Remove Player
              </button>
              <button className="menu-item" onClick={openChangeTeamSizes}>
                Change Team Sizes
              </button>
              <button className="menu-item" onClick={openChangeOvers}>
                Change Overs
              </button>
              <button className="menu-item" onClick={() => { setSheet(null); onViewScorecard() }}>
                View Scorecard
              </button>
              <button className="menu-item" onClick={() => setSheet('ballLog')}>
                Ball by Ball
              </button>
              <button className="menu-item" onClick={() => { setSheet(null); onShareSync?.() }}>
                Share Match Sync File
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
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
              Hold ☰ and drag to reorder batting lineup
            </p>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              <label style={{ fontWeight: 600, fontSize: 14, color: '#666', display: 'block', marginBottom: 6 }}>
                {match.teamA.name}
              </label>
              <DragList
                items={editNames.teamA}
                onChange={newOrder => setEditNames(prev => ({ ...prev, teamA: newOrder }))}
                renderItem={(name, i) => (
                  <input
                    type="text"
                    value={name}
                    onChange={e => {
                      const arr = [...editNames.teamA]
                      arr[i] = e.target.value
                      setEditNames(prev => ({ ...prev, teamA: arr }))
                    }}
                    placeholder={`Player ${i + 1}`}
                    style={{ flex: 1, padding: 10, border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 15, minWidth: 0 }}
                  />
                )}
              />
              <label style={{ fontWeight: 600, fontSize: 14, color: '#666', display: 'block', margin: '12px 0 6px' }}>
                {match.teamB.name}
              </label>
              <DragList
                items={editNames.teamB}
                onChange={newOrder => setEditNames(prev => ({ ...prev, teamB: newOrder }))}
                renderItem={(name, i) => (
                  <input
                    type="text"
                    value={name}
                    onChange={e => {
                      const arr = [...editNames.teamB]
                      arr[i] = e.target.value
                      setEditNames(prev => ({ ...prev, teamB: arr }))
                    }}
                    placeholder={`Player ${i + 1}`}
                    style={{ flex: 1, padding: 10, border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 15, minWidth: 0 }}
                  />
                )}
              />
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
                    className={`edit-run-btn ${editingBall.runs === r && !editBallCustom ? 'selected' : ''}`}
                    onClick={() => { setEditBallCustom(false); setEditingBall(prev => ({ ...prev, runs: r, isExtra: false, extraType: null, extraRuns: 0 })) }}
                  >
                    {r}
                  </button>
                ))}
                {!editBallCustom ? (
                  <button className="edit-run-btn" onClick={() => { setEditBallCustom(true); setEditingBall(prev => ({ ...prev, runs: 5, isExtra: false, extraType: null, extraRuns: 0 })) }}>+</button>
                ) : (
                  <input
                    type="number"
                    min="0"
                    className="custom-number-input"
                    value={editingBall.runs}
                    onChange={e => setEditingBall(prev => ({ ...prev, runs: Math.max(0, parseInt(e.target.value) || 0) }))}
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="edit-ball-section">
              <label>Also mark as:</label>
              <div className="edit-ball-runs">
                <button
                  className={`edit-run-btn wicket-sel ${editingBall.isWicket ? 'selected' : ''}`}
                  onClick={() => setEditingBall(prev => ({ ...prev, isWicket: !prev.isWicket, isExtra: prev.isWicket ? prev.isExtra : false, dismissalType: prev.isWicket ? null : (prev.dismissalType || 'run out') }))}
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
            {editingBall.isWicket && (
              <div className="edit-ball-section">
                <label>Dismissal type</label>
                <div className="edit-ball-runs">
                  {['Bowled', 'Caught', 'Run Out', 'Stumped', 'LBW', 'Hit Wicket'].map(type => (
                    <button
                      key={type}
                      className={`edit-run-btn ${editingBall.dismissalType === type.toLowerCase() ? 'selected' : ''}`}
                      onClick={() => setEditingBall(prev => ({ ...prev, dismissalType: type.toLowerCase() }))}
                      style={{ width: 'auto', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {editingBall.isExtra && (
              <div className="edit-ball-section">
                <label>Extra runs</label>
                <div className="edit-ball-runs">
                  {[1, 2, 3, 4, 6].map(n => (
                    <button
                      key={n}
                      className={`edit-run-btn ${editingBall.extraRuns === n && !editBallCustomExtras ? 'selected' : ''}`}
                      onClick={() => { setEditBallCustomExtras(false); setEditingBall(prev => ({ ...prev, extraRuns: n })) }}
                    >
                      {n}
                    </button>
                  ))}
                  {!editBallCustomExtras ? (
                    <button className="edit-run-btn" onClick={() => { setEditBallCustomExtras(true); setEditingBall(prev => ({ ...prev, extraRuns: 7 })) }}>+</button>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      className="custom-number-input"
                      value={editingBall.extraRuns}
                      onChange={e => setEditingBall(prev => ({ ...prev, extraRuns: Math.max(1, parseInt(e.target.value) || 1) }))}
                      autoFocus
                    />
                  )}
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

      {/* Change team sizes sheet */}
      {sheet === 'changeTeamSizes' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet('menu')}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Change Team Sizes</h3>
            <div className="form-group">
              <label>{match.teamA.name} players</label>
              <input
                type="number"
                min={innings === 1 ? score.wickets + 2 : 1}
                value={teamSizesInput.teamASize}
                onChange={e => setTeamSizesInput(prev => ({ ...prev, teamASize: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              {innings === 1 && <small style={{ color: '#999', fontSize: 12 }}>Min: {score.wickets + 2} (wickets + 2)</small>}
            </div>
            <div className="form-group">
              <label>{match.teamB.name} players</label>
              <input
                type="number"
                min={innings === 2 ? score.wickets + 2 : 1}
                value={teamSizesInput.teamBSize}
                onChange={e => setTeamSizesInput(prev => ({ ...prev, teamBSize: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              {innings === 2 && <small style={{ color: '#999', fontSize: 12 }}>Min: {score.wickets + 2} (wickets + 2)</small>}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveTeamSizes}>
              Save
            </button>
            <button className="sheet-cancel" onClick={() => setSheet('menu')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Change overs sheet */}
      {sheet === 'changeOvers' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet('menu')}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Change Overs</h3>
            <div className="form-group">
              <label>Total Overs</label>
              <input
                type="number"
                min={Math.ceil(score.legalBalls / 6)}
                value={oversInput}
                onChange={e => setOversInput(Math.max(1, parseInt(e.target.value) || 1))}
              />
              {score.legalBalls > 0 && <small style={{ color: '#999', fontSize: 12 }}>Min: {Math.ceil(score.legalBalls / 6)} (already bowled)</small>}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveOvers}>
              Save
            </button>
            <button className="sheet-cancel" onClick={() => setSheet('menu')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Remove player sheet */}
      {sheet === 'removePlayer' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet('menu')}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Remove Player</h3>
            <div className="extras-runs" style={{ marginBottom: 14 }}>
              <button className={removePlayerTeam === 'A' ? 'selected' : ''} onClick={() => setRemovePlayerTeam('A')}>{match.teamA.name}</button>
              <button className={removePlayerTeam === 'B' ? 'selected' : ''} onClick={() => setRemovePlayerTeam('B')}>{match.teamB.name}</button>
            </div>
            <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {(removePlayerTeam === 'A' ? match.teamA : match.teamB).players?.map((name, i) => (
                <div key={i} className="remove-player-row">
                  <span>{name || `Player ${i + 1}`}</span>
                  <button className="btn btn-danger btn-small" onClick={() => handleRemovePlayer(removePlayerTeam === 'A' ? 'teamA' : 'teamB', i)}>
                    Remove
                  </button>
                </div>
              ))}
              {(!((removePlayerTeam === 'A' ? match.teamA : match.teamB).players?.length)) && (
                <p style={{ color: '#999', fontSize: 14 }}>No named players</p>
              )}
            </div>
            <button className="sheet-cancel" onClick={() => setSheet('menu')}>Back</button>
          </div>
        </div>
      )}

      {sheet === 'ballLog' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet(null)}>
          <div className="bottom-sheet import-sheet" onClick={e => e.stopPropagation()}>
            <h3>Ball by Ball</h3>
            <BallLog match={match} inningsBalls={{ ...allInningsBalls, [innings]: balls }} />
            <button className="sheet-cancel" onClick={() => setSheet(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Bowler selection sheet */}
      {sheet === 'bowlerSelect' && (() => {
        const allPlayers = bowlingTeam.players || []
        const currentBowlName = getPlayerName('bowl', pendingBowlerIdx ?? bowlerIdx)
        const query = bowlerSearch.trim().toLowerCase()
        // Suggestions: team player roster filtered by search query
        const suggestions = allPlayers.filter(p => p && p.toLowerCase().includes(query))
        // If the typed text doesn't exactly match any player, offer it as a custom entry
        const exactMatch = allPlayers.some(p => p?.toLowerCase() === query)
        const showCustom = query.length > 0 && !exactMatch
        // Bowling rotation (for drag reorder)
        const bowlOrder = bowlingTeam.bowlingOrder?.length
          ? bowlingTeam.bowlingOrder
          : allPlayers.length ? [...allPlayers] : []
        return (
          <div className="bottom-sheet-overlay" onClick={() => { setSheet(null); setPendingBowlerIdx(null); setBowlerSearch('') }}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
              <h3>Who's bowling?</h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10 }}>
                {bowlingTeam.name} — Over {Math.floor(score.legalBalls / 6) + 1}
                {currentBowlName && <span style={{ marginLeft: 6, color: 'var(--green-dark)' }}>· Current: {currentBowlName}</span>}
              </p>

              {/* Search input — type to filter team players */}
              <input
                type="text"
                value={bowlerSearch}
                onChange={e => setBowlerSearch(e.target.value)}
                placeholder="Search player name…"
                autoFocus
                style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--green-mid)', borderRadius: 8, fontSize: 15, marginBottom: 8 }}
              />

              {/* Filtered player list */}
              <div style={{ maxHeight: '32vh', overflowY: 'auto' }}>
                {(query ? suggestions : allPlayers.filter(Boolean)).map((name, i) => (
                  <button
                    key={i}
                    className="menu-item"
                    style={{ fontWeight: name === currentBowlName ? 700 : 500, color: name === currentBowlName ? 'var(--green-dark)' : 'var(--text)' }}
                    onClick={() => selectBowlerByName(name)}
                  >
                    {name}
                    {name === currentBowlName && ' ✓'}
                  </button>
                ))}
                {/* Custom name not in roster */}
                {showCustom && (
                  <button className="menu-item" style={{ color: 'var(--green-mid)' }} onClick={() => selectBowlerByName(bowlerSearch)}>
                    + Use "{bowlerSearch}"
                  </button>
                )}
                {/* Empty state */}
                {allPlayers.filter(Boolean).length === 0 && !query && (
                  <p style={{ color: 'var(--text-light)', fontSize: 13, padding: '8px 0' }}>
                    No players added — type a name above to add one
                  </p>
                )}
                {query && suggestions.length === 0 && !showCustom && (
                  <p style={{ color: 'var(--text-light)', fontSize: 13, padding: '8px 0' }}>No match</p>
                )}
              </div>

              {/* Bowling rotation reorder — collapsed by default */}
              {bowlOrder.length > 0 && (
                <details style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <summary style={{ fontSize: 13, color: 'var(--text-light)', cursor: 'pointer', userSelect: 'none' }}>
                    Reorder bowling rotation (drag ☰)
                  </summary>
                  <div style={{ marginTop: 8, maxHeight: '25vh', overflowY: 'auto' }}>
                    <DragList
                      items={bowlOrder}
                      onChange={saveBowlingOrder}
                      renderItem={(name, i) => (
                        <button
                          className="menu-item drag-list-btn"
                          style={{ fontWeight: i === (pendingBowlerIdx ?? bowlerIdx) ? 700 : 500, color: i === (pendingBowlerIdx ?? bowlerIdx) ? 'var(--green-dark)' : 'var(--text)' }}
                          onClick={() => selectBowler(i)}
                        >
                          {name || `Bowl ${i + 1}`}
                          {i === (pendingBowlerIdx ?? bowlerIdx) && ' ✓'}
                        </button>
                      )}
                    />
                  </div>
                </details>
              )}

              <button className="sheet-cancel" style={{ marginTop: 12 }} onClick={() => { setSheet(null); setPendingBowlerIdx(null); setBowlerSearch(''); setEditBowlerName('') }}>
                Keep Current Bowler
              </button>
            </div>
          </div>
        )
      })()}

      {/* Who's in next? — shown after a wicket when named batting players remain */}
      {sheet === 'nextBatsman' && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Who's batting next?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>
              {battingTeam.name} — select the incoming batsman
            </p>
            <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
              {(battingTeam.players || []).map((name, i) => {
                const alreadyBatted = score.batsmen[i] !== undefined
                const atCrease = i === striker || i === nonStriker
                if (alreadyBatted || atCrease) return null
                return (
                  <button
                    key={i}
                    className="menu-item"
                    style={{ fontWeight: i === pendingWicketNextStriker ? 700 : 500, color: i === pendingWicketNextStriker ? 'var(--green-dark)' : 'var(--text)' }}
                    onClick={() => {
                      setStriker(i)
                      setPendingWicketNextStriker(null)
                      setSheet(null)
                    }}
                  >
                    {name || `Bat ${i + 1}`}
                    {i === pendingWicketNextStriker && ' (auto)'}
                  </button>
                )
              })}
            </div>
            <button
              className="sheet-cancel"
              onClick={() => {
                setStriker(pendingWicketNextStriker)
                setPendingWicketNextStriker(null)
                setSheet(null)
              }}
            >
              Use Next in Order ({getPlayerName('bat', pendingWicketNextStriker)})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
