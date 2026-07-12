import { useState, useEffect, useCallback } from 'react'
import { getMatch, updateMatch, getBalls, addBall, removeLastBall, updateBall, deleteBall, appendAudit } from '../db'
import { calculateScore, getCurrentOver, ballDisplay, formatOvers, restoreStateFromBalls, nextAvailableBatsman } from '../utils/scoring'
import { isFeatureEnabled } from '../settings'
import { needsBowlerAtBoundary, currentInPlayStep } from '../utils/matchFlow'
import MiniScorebar from './MiniScorebar'
import StartupFlow from './StartupFlow'
import FlowOverlay from './FlowOverlay'
import PlayerPicker from './PlayerPicker'
import RunOptions from './RunOptions'
import Icon from './Icon'

// ScoringV2 — the guided (v2) scoring experience.
//
// Phase 3 (this file) establishes a baseline that reaches parity with the v1
// scoring core (runs / extras / wickets / undo / over + innings + match
// transitions) while being far simpler: instead of mutating striker/bowler
// positions incrementally, it treats the ball log in the DB as the single
// source of truth and DERIVES all state from it via the pure helpers
// (calculateScore + restoreStateFromBalls) after every change.
//
// The guided full-screen flows (toss, opening batsmen/bowler, forced bowler per
// over, detailed wicket) and undo/redo layer on in later phases. Audit events
// are recorded here so a match is replayable from creation.
export default function ScoringV2({ matchId, settings = {}, onBack, onViewScorecard }) {
  const [match, setMatch] = useState(null)
  const [balls, setBalls] = useState([])
  const [innings, setInnings] = useState(1)
  const [striker, setStriker] = useState(0)
  const [nonStriker, setNonStriker] = useState(1)
  const [bowlerIdx, setBowlerIdx] = useState(0)
  const [firstInningsScore, setFirstInningsScore] = useState(null)
  const [showInningsBreak, setShowInningsBreak] = useState(false)
  const [inningsEndReason, setInningsEndReason] = useState(null)
  const [sheet, setSheet] = useState(null) // 'wicket' | 'extras' | 'menu'
  const [wicketDismissalType, setWicketDismissalType] = useState(null)
  const [wicketRuns, setWicketRuns] = useState(0)
  const [wicketOutBatsman, setWicketOutBatsman] = useState(null)
  const [extraType, setExtraType] = useState(null)
  const [extraRuns, setExtraRuns] = useState(1)
  const [noBallBatsmanRuns, setNoBallBatsmanRuns] = useState(0)
  // In-play guided (v2) flow state.
  const [wicketFlow, setWicketFlow] = useState(false) // full-screen wicket entry active
  const [pendingNewBatsman, setPendingNewBatsman] = useState(null) // { ballId, end, defaultIndex }
  const [bowlerAckOver, setBowlerAckOver] = useState(null) // over index whose bowler was confirmed
  const [redoStack, setRedoStack] = useState([]) // balls removed by undo, awaiting redo
  const [editingBall, setEditingBall] = useState(null) // ball being corrected
  const [editRuns, setEditRuns] = useState(0)
  const [editIsWicket, setEditIsWicket] = useState(false)
  const [editDismissal, setEditDismissal] = useState(null)

  const auditEnabled = settings.auditLog !== false
  const detailedWicket = isFeatureEnabled(settings, 'detailedWicket')
  const forceBowler = isFeatureEnabled(settings, 'forceBowlerEachOver')
  const undoRedo = isFeatureEnabled(settings, 'undoRedo')
  const homeButton = isFeatureEnabled(settings, 'homeButton')

  const record = useCallback(async (action, payload) => {
    if (auditEnabled) await appendAudit({ matchId, action, payload })
  }, [auditEnabled, matchId])

  const loadData = useCallback(async () => {
    const m = await getMatch(matchId)
    if (!m) return
    setMatch(m)
    const currentInnings = m.currentInnings || 1
    setInnings(currentInnings)
    const b = await getBalls(matchId, currentInnings)
    setBalls(b)

    if (b.length > 0) {
      const restored = restoreStateFromBalls(b)
      setStriker(restored.striker)
      setNonStriker(restored.nonStriker)
      setBowlerIdx(restored.bowlerIdx)
    } else if (m.openingSetup) {
      // Honour a chosen opening line-up (set by the Phase 4 flow) before any ball.
      setStriker(m.openingSetup.striker ?? 0)
      setNonStriker(m.openingSetup.nonStriker ?? 1)
      setBowlerIdx(m.openingSetup.bowlerIndex ?? 0)
    }

    if (currentInnings === 2) {
      const firstBalls = await getBalls(matchId, 1)
      setFirstInningsScore(calculateScore(firstBalls).runs)
    } else if (b.length > 0) {
      // On resume, detect a 1st innings that already finished so the break screen
      // and 2nd-innings target work (recordBall sets this during live play).
      const s = calculateScore(b)
      const tSize = (m.teamASize ?? m.playersPerSide)
      const battingCount = Math.max(m.teamA.players?.length || 0, tSize)
      if (s.wickets >= battingCount - 1 || s.legalBalls >= m.totalOvers * 6) {
        setFirstInningsScore(s.runs)
        setInningsEndReason(s.wickets >= battingCount - 1 ? 'all-out' : 'overs-complete')
      }
    }
  }, [matchId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData() }, [loadData])

  // Back-button guard: push a history entry so the browser/hardware back button
  // routes home instead of exiting the (installed) PWA. Gated by the home setting.
  useEffect(() => {
    if (!homeButton) return
    window.history.pushState({ boxCricketScoring: true }, '')
    const onPop = () => { onBack?.() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [homeButton, onBack])

  if (!match) return <div className="container">Loading...</div>

  // The toss decides which team bats first; default to team A (v1 convention).
  const battingFirst = match.toss?.battingFirst || 'A'
  const firstBatKey = battingFirst === 'B' ? 'teamB' : 'teamA'
  const secondBatKey = battingFirst === 'B' ? 'teamA' : 'teamB'
  const battingKey = innings === 1 ? firstBatKey : secondBatKey
  const bowlingKey = innings === 1 ? secondBatKey : firstBatKey
  const battingTeam = match[battingKey]
  const bowlingTeam = match[bowlingKey]

  function getPlayerName(team, index) {
    if (team === 'bat') return battingTeam.players?.[index] || `Bat ${index + 1}`
    const order = bowlingTeam.bowlingOrder
    if (order && order[index]) return order[index]
    return bowlingTeam.players?.[index] || `Bowl ${index + 1}`
  }

  const score = calculateScore(balls)
  const currentOverBalls = getCurrentOver(balls)
  const totalBalls = match.totalOvers * 6

  const currentTeamSize = (battingKey === 'teamA' ? match.teamASize : match.teamBSize) ?? match.playersPerSide
  const battingPlayerCount = Math.max(battingTeam.players?.length || 0, currentTeamSize)
  const isAllOut = score.wickets >= battingPlayerCount - 1
  const isOversComplete = score.legalBalls >= totalBalls
  const isInningsOver = isAllOut || isOversComplete
  const targetChased = innings === 2 && firstInningsScore != null && score.runs > firstInningsScore

  const rules = match.rules || {}
  const runMapObj = rules.runMap || {}
  const disabledRunsSet = new Set(rules.disabledRuns || [])
  const getMappedRuns = tap => (runMapObj[tap] !== undefined ? runMapObj[tap] : tap)

  async function endMatch(finalScore) {
    const firstBatName = match[firstBatKey].name
    const secondBatName = match[secondBatKey].name
    let result
    if (innings === 1) {
      result = `${firstBatName} scored ${finalScore.runs}/${finalScore.wickets}`
    } else {
      const diff = finalScore.runs - firstInningsScore
      if (diff > 0) {
        const wicketsLeft = battingPlayerCount - 1 - finalScore.wickets
        result = `${secondBatName} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`
      } else if (diff === 0) {
        result = 'Match Tied'
      } else {
        result = `${firstBatName} won by ${-diff} run${-diff !== 1 ? 's' : ''}`
      }
    }
    await updateMatch(matchId, { status: 'completed', result })
    await record('matchEnded', { result })
    setMatch(prev => ({ ...prev, status: 'completed', result }))
  }

  // swapRuns = the original tap value (for strike rotation); runs = the mapped value stored.
  async function recordBall({ runs = 0, swapRuns, isExtra = false, extraType: et = null, extraRuns: er = 0, isWicket = false, dismissalType = null, outBatsmanIndex = null }) {
    // The incoming batsman is the lowest roster index that is not out and not the
    // surviving batsman — NOT max(striker,nonStriker)+1, which skips gaps and picks
    // a non-existent player when batsmen came in out of order.
    const outIdx = isWicket ? (outBatsmanIndex ?? striker) : null
    const surviving = isWicket ? (outIdx === striker ? nonStriker : striker) : null
    const outSet = new Set(
      Object.entries(score.batsmen)
        .filter(([, b]) => b.howOut && b.howOut !== 'not out')
        .map(([i]) => Number(i))
    )
    if (isWicket) outSet.add(outIdx)
    const autoNext = isWicket ? nextAvailableBatsman(surviving, surviving, outSet) : null

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
      outBatsmanIndex: isWicket ? (outBatsmanIndex ?? striker) : undefined,
      // Stamp the default incoming batsman so replay/restore is exact; the guided
      // new-batsman step can override this.
      newBatsmanIndex: isWicket ? autoNext : undefined,
      bowlerIndex: bowlerIdx,
      bowlerName: getPlayerName('bowl', bowlerIdx),
    }
    setRedoStack([]) // a new forward action invalidates the redo history
    const ballId = await addBall(ball)
    await record(isWicket ? 'wicket' : 'ballAdded', { ball: { ...ball, id: ballId } })

    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    const restored = restoreStateFromBalls(updatedBalls)
    setStriker(restored.striker)
    setNonStriker(restored.nonStriker)
    setBowlerIdx(restored.bowlerIdx)

    const inningsOver = await maybeEndInnings(calculateScore(updatedBalls))
    // Which end the incoming batsman occupies after any strike rotation.
    const end = restored.striker === autoNext ? 'striker' : restored.nonStriker === autoNext ? 'nonStriker' : 'striker'
    return { ballId, isWicket, autoNext, end, inningsOver }
  }

  // Detects a completed innings/match from the current score and transitions to
  // the innings break or the completed screen. Returns whether the innings ended.
  async function maybeEndInnings(newScore) {
    const newIsAllOut = newScore.wickets >= battingPlayerCount - 1
    const newIsOversComplete = newScore.legalBalls >= totalBalls
    const newTargetChased = innings === 2 && firstInningsScore != null && newScore.runs > firstInningsScore
    const inningsOver = newIsAllOut || newIsOversComplete || newTargetChased
    if (inningsOver) {
      if (innings === 1 && !newTargetChased) {
        setFirstInningsScore(newScore.runs)
        setInningsEndReason(newIsAllOut ? 'all-out' : 'overs-complete')
        setShowInningsBreak(true)
      } else {
        await endMatch(newScore)
      }
    }
    return inningsOver
  }

  // Re-derives striker/non-striker/bowler from the ball log (the source of truth).
  function applyDerivedState(updatedBalls) {
    if (updatedBalls.length > 0) {
      const restored = restoreStateFromBalls(updatedBalls)
      setStriker(restored.striker)
      setNonStriker(restored.nonStriker)
      setBowlerIdx(restored.bowlerIdx)
    } else {
      setStriker(match.openingSetup?.striker ?? 0)
      setNonStriker(match.openingSetup?.nonStriker ?? 1)
      setBowlerIdx(match.openingSetup?.bowlerIndex ?? 0)
    }
  }

  async function handleUndo() {
    const removed = await removeLastBall(matchId, innings)
    if (!removed) return
    await record('undo', { ball: removed })
    // Keep the removed ball (with its stamped newBatsmanIndex etc.) so redo can
    // replay the exact step. Drop the auto-increment id so re-adding is clean.
    const { id, ...ballForRedo } = removed // eslint-disable-line no-unused-vars
    setRedoStack(prev => [...prev, ballForRedo])
    // Removing a ball may move us back across an over boundary — clear the bowler
    // acknowledgement so the forced-bowler prompt shows again if we re-cross it.
    setBowlerAckOver(null)
    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    applyDerivedState(updatedBalls)
  }

  async function handleRedo() {
    if (redoStack.length === 0) return
    const ball = redoStack[redoStack.length - 1]
    await addBall(ball)
    await record('redo', { ball })
    setRedoStack(prev => prev.slice(0, -1))
    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    applyDerivedState(updatedBalls)
    // Redoing a ball can re-complete the innings/match.
    await maybeEndInnings(calculateScore(updatedBalls))
  }

  function swapStriker() {
    setStriker(nonStriker)
    setNonStriker(striker)
  }

  // --- Edit / correct a recorded ball ---
  function openEditBall(ball) {
    setEditingBall(ball)
    // Wides are edited by their extra (penalty) runs; everything else by batsman runs.
    setEditRuns(ball.isExtra && ball.extraType === 'wide' ? (ball.extraRuns || 0) : (ball.runs || 0))
    setEditIsWicket(!!ball.isWicket)
    setEditDismissal(ball.dismissalType || null)
  }

  async function saveEditBall() {
    const b = editingBall
    const changes = (b.isExtra && b.extraType === 'wide')
      ? { extraRuns: editRuns }
      : { runs: editRuns, tapRuns: editRuns }
    changes.isWicket = editIsWicket
    if (editIsWicket) {
      // The batsman on strike for that delivery is the one dismissed. (Run-out of
      // the non-striker still needs delete + re-enter — the non-striker isn't on
      // the ball record.)
      changes.dismissalType = editDismissal || 'bowled'
      changes.outBatsmanIndex = b.batsmanIndex
      const outSet = new Set(
        Object.entries(score.batsmen).filter(([, x]) => x.howOut && x.howOut !== 'not out').map(([i]) => Number(i))
      )
      outSet.add(b.batsmanIndex)
      changes.newBatsmanIndex = nextAvailableBatsman(nonStriker, nonStriker, outSet)
    } else {
      changes.dismissalType = null
      changes.outBatsmanIndex = null
      changes.newBatsmanIndex = null
    }
    await updateBall(b.id, changes)
    await record('ballEdited', { ball: { ...b, ...changes } })
    setEditingBall(null)
    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    applyDerivedState(updatedBalls)
  }

  async function deleteEditBall() {
    const b = editingBall
    await deleteBall(b.id)
    await record('ballEdited', { ball: { ...b, deleted: true } })
    setEditingBall(null)
    setRedoStack([])
    // Deleting a ball may move us back across an over boundary — re-prompt the bowler.
    setBowlerAckOver(null)
    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    applyDerivedState(updatedBalls)
  }

  function handleRunTap(tap) {
    if (isInningsOver || targetChased || match.status === 'completed') return
    recordBall({ runs: getMappedRuns(tap), swapRuns: tap })
  }

  function handleWicketTap() {
    if (isInningsOver) return
    if (detailedWicket) setWicketFlow(true)
    else setSheet('wicket')
  }

  function selectWicketType(type) {
    setWicketDismissalType(type)
    setWicketRuns(0)
    setWicketOutBatsman(type === 'run out' ? striker : null)
  }

  async function confirmWicket() {
    const res = await recordBall({
      runs: wicketRuns,
      isWicket: true,
      dismissalType: wicketDismissalType,
      outBatsmanIndex: wicketDismissalType === 'run out' ? wicketOutBatsman : striker,
    })
    closeWicketEntry()
    // In the guided flow, prompt for the incoming batsman (default pre-selected).
    if (detailedWicket && res.isWicket && !res.inningsOver && res.autoNext != null && res.autoNext < battingPlayerCount) {
      setPendingNewBatsman({ ballId: res.ballId, end: res.end, defaultIndex: res.autoNext })
    }
  }

  function closeWicketEntry() {
    setSheet(null)
    setWicketFlow(false)
    setWicketDismissalType(null)
    setWicketRuns(0)
    setWicketOutBatsman(null)
  }

  // Guided new-batsman selection: override the default incoming batsman by index
  // or a typed name, then re-derive positions from the (updated) ball log.
  async function selectNewBatsman({ index, name }) {
    const { ballId, end } = pendingNewBatsman
    if (name) {
      const players = [...(battingTeam.players || [])]
      while (players.length <= index) players.push('')
      players[index] = name
      await updateMatch(matchId, { [battingKey]: { ...battingTeam, players } })
      setMatch(prev => ({ ...prev, [battingKey]: { ...prev[battingKey], players } }))
    }
    await updateBall(ballId, { newBatsmanIndex: index })
    await record('batsmanSelected', { index, end })
    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    const restored = restoreStateFromBalls(updatedBalls)
    setStriker(restored.striker)
    setNonStriker(restored.nonStriker)
    setBowlerIdx(restored.bowlerIdx)
    setPendingNewBatsman(null)
  }

  // Guided forced bowler selection at an over boundary.
  async function selectBowlerForOver({ index, name }) {
    if (name) {
      const base = bowlingTeam.bowlingOrder?.length ? bowlingTeam.bowlingOrder : (bowlingTeam.players || [])
      const order = [...base]
      while (order.length <= index) order.push('')
      order[index] = name
      await updateMatch(matchId, { [bowlingKey]: { ...bowlingTeam, bowlingOrder: order } })
      setMatch(prev => ({ ...prev, [bowlingKey]: { ...prev[bowlingKey], bowlingOrder: order } }))
    }
    setBowlerIdx(index)
    setBowlerAckOver(score.legalBalls / 6)
    await record('bowlerSelected', { index, over: score.legalBalls / 6 })
  }

  function confirmExtra() {
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
      ballRuns = 0
      extraRunsVal = extraRuns
      swapRunsVal = undefined
    }
    recordBall({ runs: ballRuns, swapRuns: swapRunsVal, isExtra: true, extraType, extraRuns: extraRunsVal })
    closeSheet()
  }

  function closeSheet() {
    setSheet(null)
    setWicketDismissalType(null)
    setWicketRuns(0)
    setWicketOutBatsman(null)
    setExtraType(null)
    setExtraRuns(1)
    setNoBallBatsmanRuns(0)
  }

  async function handleToss(toss) {
    await updateMatch(matchId, { toss })
    await record('tossSet', { toss })
    setMatch(prev => ({ ...prev, toss }))
  }

  async function handleOpenings({ openingSetup, names }) {
    // Write any typed-in names into the correct rosters (batting players /
    // bowling order), keyed off which team bats first.
    const bf = match.toss?.battingFirst || 'A'
    const batKey = bf === 'B' ? 'teamB' : 'teamA'
    const bowlKey = bf === 'B' ? 'teamA' : 'teamB'
    const updates = {}
    if (Object.keys(names.batting).length) {
      const players = [...(match[batKey].players || [])]
      for (const [i, nm] of Object.entries(names.batting)) {
        const idx = Number(i)
        while (players.length <= idx) players.push('')
        players[idx] = nm
      }
      updates[batKey] = { ...match[batKey], players }
    }
    if (Object.keys(names.bowling).length) {
      const base = match[bowlKey].bowlingOrder?.length ? match[bowlKey].bowlingOrder : (match[bowlKey].players || [])
      const order = [...base]
      for (const [i, nm] of Object.entries(names.bowling)) {
        const idx = Number(i)
        while (order.length <= idx) order.push('')
        order[idx] = nm
      }
      updates[bowlKey] = { ...match[bowlKey], bowlingOrder: order }
    }
    await updateMatch(matchId, { ...updates, openingSetup })
    await record('openingSet', { openingSetup })
    setMatch(prev => ({ ...prev, ...updates, openingSetup }))
    setStriker(openingSetup.striker)
    setNonStriker(openingSetup.nonStriker)
    setBowlerIdx(openingSetup.bowlerIndex)
  }

  async function startSecondInnings() {
    // Do all async work up front, then commit every piece of UI state in one
    // synchronous tick so React batches it into a single render. Otherwise an
    // await between setState calls produces an intermediate frame that shows the
    // 2nd-innings header while `balls` still holds the 1st innings.
    const firstBalls = await getBalls(matchId, 1)
    const firstScore = calculateScore(firstBalls).runs // correct even on resume
    const secondBalls = await getBalls(matchId, 2)
    await updateMatch(matchId, { currentInnings: 2 })
    await record('inningsBreak', { firstInningsScore: firstScore })
    setFirstInningsScore(firstScore)
    setInnings(2)
    setStriker(0)
    setNonStriker(1)
    setBowlerIdx(0)
    setBalls(secondBalls)
    setShowInningsBreak(false)
    setMatch(prev => ({ ...prev, currentInnings: 2 }))
  }

  // Guided pre-match steps (toss / opening batsmen / opening bowler) cover the
  // whole screen until complete. Only relevant at the very start of innings 1.
  const needToss = isFeatureEnabled(settings, 'toss') && !match.toss
  const needOpenings = isFeatureEnabled(settings, 'openingBatsmen') && !match.openingSetup
  if (match.status === 'live' && innings === 1 && balls.length === 0 && (needToss || needOpenings)) {
    return (
      <StartupFlow
        match={match}
        settings={{
          toss: isFeatureEnabled(settings, 'toss'),
          openingBatsmen: isFeatureEnabled(settings, 'openingBatsmen'),
        }}
        onToss={handleToss}
        onOpenings={handleOpenings}
        onHome={homeButton ? onBack : undefined}
      />
    )
  }

  if (showInningsBreak) {
    const reasonText = inningsEndReason === 'all-out' ? 'All batsmen out' : `${match.totalOvers} overs completed`
    return (
      <div className="container innings-break">
        <h2>End of 1st Innings</h2>
        <div className="innings-end-reason">{reasonText}</div>
        <p>{match[firstBatKey].name}: {firstInningsScore} runs</p>
        <div className="target">Target: {firstInningsScore + 1}</div>
        <p>{match[secondBatKey].name} need {firstInningsScore + 1} runs from {match.totalOvers} overs</p>
        <button className="btn btn-primary btn-large" style={{ marginTop: 20 }} onClick={startSecondInnings}>Start 2nd Innings</button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => setShowInningsBreak(false)}>← Continue in 1st Innings</button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={onViewScorecard}>View Scorecard</button>
        {homeButton && <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={onBack}>Home</button>}
      </div>
    )
  }

  if (match.status === 'completed') {
    return (
      <div className="container">
        <div className="result-banner">{match.result}</div>
        <button className="btn btn-primary" onClick={onViewScorecard}>View Full Scorecard</button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={onBack}>Home</button>
      </div>
    )
  }

  // ── Guided in-play full-screen steps (wicket → new batsman → new bowler) ──
  const needBowler = !isInningsOver && match.status !== 'completed' &&
    needsBowlerAtBoundary({ legalBalls: score.legalBalls, forceBowlerEachOver: forceBowler, ackOver: bowlerAckOver })
  const inPlayStep = currentInPlayStep({ wicketFlow, pendingNewBatsman, needBowler })
  const pad = (arr = [], n) => { const o = []; for (let i = 0; i < Math.max(arr.length, n); i++) o.push(arr[i] || ''); return o }

  if (inPlayStep === 'wicket') {
    return (
      <FlowOverlay title="Wicket" subtitle="How did the batsman get out?" onBack={closeWicketEntry} onHome={homeButton ? onBack : undefined}>
        {!wicketDismissalType ? (
          <div className="player-picker-list">
            {['Bowled', 'Caught', 'Run Out', 'Stumped', 'LBW', 'Hit Wicket'].map(type => (
              <button key={type} className="player-option" onClick={() => selectWicketType(type.toLowerCase())}>{type}</button>
            ))}
          </div>
        ) : (
          <>
            <p className="flow-label">{wicketDismissalType.replace(/\b\w/g, c => c.toUpperCase())} — runs scored</p>
            <RunOptions value={wicketRuns} onChange={setWicketRuns} />
            {wicketDismissalType === 'run out' && (
              <>
                <p className="flow-label">Who is out?</p>
                <div className="flow-options">
                  <button className={`flow-option${wicketOutBatsman === striker ? ' selected' : ''}`} onClick={() => setWicketOutBatsman(striker)}>{getPlayerName('bat', striker)} (striker)</button>
                  <button className={`flow-option${wicketOutBatsman === nonStriker ? ' selected' : ''}`} onClick={() => setWicketOutBatsman(nonStriker)}>{getPlayerName('bat', nonStriker)}</button>
                </div>
              </>
            )}
            <button className="btn btn-primary btn-large flow-confirm" onClick={confirmWicket}>Confirm Wicket</button>
          </>
        )}
      </FlowOverlay>
    )
  }

  if (inPlayStep === 'newBatsman') {
    const survivingIdx = pendingNewBatsman.end === 'striker' ? nonStriker : striker
    const outIdxs = Object.entries(score.batsmen).filter(([, s]) => s.howOut).map(([i]) => Number(i))
    const disabled = [survivingIdx, ...outIdxs]
    const batRoster = pad(battingTeam.players, battingPlayerCount)
    const defaultName = batRoster[pendingNewBatsman.defaultIndex] || `Batsman ${pendingNewBatsman.defaultIndex + 1}`
    return (
      <FlowOverlay title="New Batsman" subtitle="Who comes in to bat?" onHome={homeButton ? onBack : undefined}>
        <button className="btn btn-primary btn-large" style={{ marginBottom: 14 }} onClick={() => setPendingNewBatsman(null)}>
          Continue with {defaultName}
        </button>
        <p className="flow-label">…or choose someone else</p>
        <PlayerPicker roster={batRoster} defaultLabel="Batsman" disabledIndexes={disabled} onSelect={selectNewBatsman} />
      </FlowOverlay>
    )
  }

  if (inPlayStep === 'bowler') {
    const bowlingSize = (bowlingKey === 'teamA' ? match.teamASize : match.teamBSize) ?? match.playersPerSide
    const bowlRoster = pad(bowlingTeam.bowlingOrder?.length ? bowlingTeam.bowlingOrder : bowlingTeam.players, bowlingSize)
    const defaultName = bowlRoster[bowlerIdx] || `Bowler ${bowlerIdx + 1}`
    const overNo = score.legalBalls / 6 + 1
    return (
      <FlowOverlay title="New Bowler" subtitle={`Who bowls over ${overNo}?`} onHome={homeButton ? onBack : undefined}>
        <button className="btn btn-primary btn-large" style={{ marginBottom: 14 }} onClick={() => selectBowlerForOver({ index: bowlerIdx })}>
          Continue with {defaultName}
        </button>
        <p className="flow-label">…or choose someone else</p>
        <PlayerPicker roster={bowlRoster} defaultLabel="Bowler" onSelect={selectBowlerForOver} />
      </FlowOverlay>
    )
  }

  const curBowlName = getPlayerName('bowl', bowlerIdx)
  const bowlStat = score.bowlers[curBowlName] ?? score.bowlers[bowlerIdx]

  // MiniScorebar derives the batting team as innings 1 → teamA, innings 2 → teamB.
  // Present teams in batting-first order so it labels the right side when the
  // toss put team B in first.
  const scorebarMatch = battingFirst === 'B' ? { ...match, teamA: match.teamB, teamB: match.teamA } : match

  return (
    <div className="container scoring-screen">
      <MiniScorebar
        match={scorebarMatch}
        score={score}
        innings={innings}
        onUndo={handleUndo}
        onSwapStriker={swapStriker}
        onMenu={() => setSheet('menu')}
        firstInningsScore={firstInningsScore}
        onRedo={undoRedo ? handleRedo : undefined}
        canRedo={redoStack.length > 0}
      />

      {isInningsOver && innings === 1 && !targetChased && (
        <button className="innings-complete-banner" onClick={() => setShowInningsBreak(true)}>
          1st innings complete ({inningsEndReason === 'all-out' ? 'all out' : `${match.totalOvers} overs done`}) — Tap to start 2nd innings →
        </button>
      )}

      <div className="score-grid-large">
        {[0, 1, 2, 3].map(tap => {
          if (disabledRunsSet.has(tap)) return null
          const mapped = getMappedRuns(tap)
          const isMapped = mapped !== tap
          return <button key={tap} className={`score-btn-lg run${isMapped ? ' mapped' : ''}`} onClick={() => handleRunTap(tap)}>{isMapped ? `${tap}→${mapped}` : String(tap)}</button>
        })}
        {[4, 6].map(tap => {
          if (disabledRunsSet.has(tap)) return null
          const mapped = getMappedRuns(tap)
          const isMapped = mapped !== tap
          return <button key={tap} className={`score-btn-lg boundary${isMapped ? ' mapped' : ''}`} onClick={() => handleRunTap(tap)}>{isMapped ? `${tap}→${mapped}` : String(tap)}</button>
        })}
        <button className="score-btn-lg wicket" onClick={handleWicketTap}>W</button>
        <button className="score-btn-lg extra" onClick={() => { if (!isInningsOver) setSheet('extras') }}>EX</button>
      </div>

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
            // Tap a delivery to correct it.
            return <button key={i} type="button" className={cls} aria-label={`Edit ball ${ballDisplay(b)}`} onClick={() => openEditBall(b)}>{ballDisplay(b)}</button>
          })}
          {currentOverBalls.length === 0 && <span style={{ color: '#999', fontSize: 13 }}>New over</span>}
        </div>
      </div>

      <div className="card compact-info">
        <div className="player-info">
          <span className="name striker">*{getPlayerName('bat', striker)}</span>: {score.batsmen[striker]?.runs || 0} ({score.batsmen[striker]?.balls || 0})
        </div>
        <div className="player-info">
          <span className="name">{getPlayerName('bat', nonStriker)}</span>: {score.batsmen[nonStriker]?.runs || 0} ({score.batsmen[nonStriker]?.balls || 0})
        </div>
        <div className="player-info" style={{ marginTop: 4 }}>
          <span className="name" style={{ color: 'var(--green-dark)' }}>{curBowlName}</span>: {bowlStat ? `${formatOvers(bowlStat.balls)}-${bowlStat.runs}-${bowlStat.wickets}` : '0.0-0-0'}
        </div>
      </div>

      {sheet === 'wicket' && (
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Wicket</h3>
            {!wicketDismissalType ? (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Dismissal Type</p>
                <div className="sheet-options">
                  {['Bowled', 'Caught', 'Run Out', 'Stumped', 'LBW', 'Hit Wicket'].map(type => (
                    <button key={type} className="sheet-option" onClick={() => selectWicketType(type.toLowerCase())}>{type}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>
                  {wicketDismissalType.replace(/\b\w/g, c => c.toUpperCase())} — Runs scored:
                </p>
                <RunOptions value={wicketRuns} onChange={setWicketRuns} />
                {wicketDismissalType === 'run out' && (
                  <>
                    <p style={{ margin: '10px 0 8px', fontWeight: 600, color: '#666', fontSize: 14 }}>Who is out?</p>
                    <div className="sheet-options">
                      <button className={`sheet-option${wicketOutBatsman === striker ? ' selected' : ''}`} onClick={() => setWicketOutBatsman(striker)}>{getPlayerName('bat', striker)} (striker)</button>
                      <button className={`sheet-option${wicketOutBatsman === nonStriker ? ' selected' : ''}`} onClick={() => setWicketOutBatsman(nonStriker)}>{getPlayerName('bat', nonStriker)}</button>
                    </div>
                  </>
                )}
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={confirmWicket}>Confirm Wicket</button>
              </>
            )}
            <button className="sheet-cancel" onClick={closeSheet}>Cancel</button>
          </div>
        </div>
      )}

      {sheet === 'extras' && (
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Extras</h3>
            {!extraType ? (
              <div className="sheet-options">
                {[['wide', 'Wide'], ['noBall', 'No Ball'], ['bye', 'Bye'], ['legBye', 'Leg Bye']].map(([val, label]) => (
                  <button key={val} className="sheet-option" onClick={() => { setExtraType(val); setExtraRuns(1); setNoBallBatsmanRuns(0) }}>{label}</button>
                ))}
              </div>
            ) : (
              <>
                <p style={{ marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>
                  {extraType === 'noBall' ? 'No Ball — batsman runs:' : extraType === 'wide' ? 'Wide — total runs:' : 'Runs:'}
                </p>
                <RunOptions
                  value={extraType === 'noBall' ? noBallBatsmanRuns : extraRuns}
                  onChange={extraType === 'noBall' ? setNoBallBatsmanRuns : setExtraRuns}
                />
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={confirmExtra}>Confirm {extraType === 'noBall' ? 'No Ball' : extraType === 'wide' ? 'Wide' : 'Extra'}</button>
              </>
            )}
            <button className="sheet-cancel" onClick={closeSheet}>Cancel</button>
          </div>
        </div>
      )}

      {sheet === 'menu' && (
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Menu</h3>
            <div className="sheet-options">
              <button className="sheet-option" onClick={onViewScorecard}><Icon name="eye" /> View Scorecard</button>
              <button className="sheet-option" onClick={onBack}>Home</button>
            </div>
            <button className="sheet-cancel" onClick={closeSheet}>Close</button>
          </div>
        </div>
      )}

      {editingBall && (
        <div className="bottom-sheet-overlay" onClick={() => setEditingBall(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <h3>Edit Ball</h3>
            <p style={{ marginBottom: 4, fontWeight: 600, color: '#666', fontSize: 14 }}>
              {ballDisplay(editingBall)}{editingBall.isExtra ? ` (${editingBall.extraType})` : ''}{editingBall.isWicket ? ' — wicket' : ''}
            </p>
            <p className="flow-label" style={{ marginTop: 8 }}>
              {editingBall.isExtra && editingBall.extraType === 'wide' ? 'Wide runs' : editingBall.isExtra && editingBall.extraType === 'noBall' ? 'Batsman runs' : 'Runs'}
            </p>
            <RunOptions value={editRuns} onChange={setEditRuns} />

            <div className="settings-row" style={{ borderBottom: 'none', marginTop: 6 }}>
              <div className="settings-label"><strong>Wicket</strong></div>
              <button
                type="button"
                role="switch"
                aria-checked={editIsWicket}
                aria-label="Wicket"
                className={`toggle-switch${editIsWicket ? ' on' : ''}`}
                onClick={() => { setEditIsWicket(v => !v); if (!editIsWicket && !editDismissal) setEditDismissal('bowled') }}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            {editIsWicket && (
              <>
                <p className="flow-label">Dismissal</p>
                <div className="sheet-options">
                  {['Bowled', 'Caught', 'Run Out', 'Stumped', 'LBW', 'Hit Wicket'].map(type => {
                    const val = type.toLowerCase()
                    return (
                      <button key={type} className={`sheet-option${editDismissal === val ? ' selected' : ''}`} onClick={() => setEditDismissal(val)}>{type}</button>
                    )
                  })}
                </div>
              </>
            )}

            <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={saveEditBall}>Save</button>
            <button className="btn btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={deleteEditBall}>Delete Ball</button>
            <button className="sheet-cancel" onClick={() => setEditingBall(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
