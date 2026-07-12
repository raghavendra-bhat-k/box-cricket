import { useState, useEffect, useCallback } from 'react'
import { getMatch, updateMatch, getBalls, addBall, removeLastBall, appendAudit } from '../db'
import { calculateScore, getCurrentOver, ballDisplay, formatOvers, restoreStateFromBalls } from '../utils/scoring'
import MiniScorebar from './MiniScorebar'
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

  const auditEnabled = settings.auditLog !== false

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

  if (!match) return <div className="container">Loading...</div>

  const battingTeam = innings === 1 ? match.teamA : match.teamB
  const bowlingTeam = innings === 1 ? match.teamB : match.teamA

  function getPlayerName(team, index) {
    if (team === 'bat') return battingTeam.players?.[index] || `Bat ${index + 1}`
    const order = bowlingTeam.bowlingOrder
    if (order && order[index]) return order[index]
    return bowlingTeam.players?.[index] || `Bowl ${index + 1}`
  }

  const score = calculateScore(balls)
  const currentOverBalls = getCurrentOver(balls)
  const totalBalls = match.totalOvers * 6

  const teamASize = match.teamASize ?? match.playersPerSide
  const teamBSize = match.teamBSize ?? match.playersPerSide
  const currentTeamSize = innings === 1 ? teamASize : teamBSize
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
    await record('matchEnded', { result })
    setMatch(prev => ({ ...prev, status: 'completed', result }))
  }

  // swapRuns = the original tap value (for strike rotation); runs = the mapped value stored.
  async function recordBall({ runs = 0, swapRuns, isExtra = false, extraType: et = null, extraRuns: er = 0, isWicket = false, dismissalType = null, outBatsmanIndex = null }) {
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
      // Stamp the default incoming batsman so replay/restore is exact. The Phase 5
      // guided flow will let the scorer override this.
      newBatsmanIndex: isWicket ? Math.max(striker, nonStriker) + 1 : undefined,
      bowlerIndex: bowlerIdx,
      bowlerName: getPlayerName('bowl', bowlerIdx),
    }
    await addBall(ball)
    await record(isWicket ? 'wicket' : 'ballAdded', { ball })

    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
    const restored = restoreStateFromBalls(updatedBalls)
    setStriker(restored.striker)
    setNonStriker(restored.nonStriker)
    setBowlerIdx(restored.bowlerIdx)

    const newScore = calculateScore(updatedBalls)
    const newIsAllOut = newScore.wickets >= battingPlayerCount - 1
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
    }
  }

  async function handleUndo() {
    const removed = await removeLastBall(matchId, innings)
    if (!removed) return
    await record('undo', { ball: removed })
    const updatedBalls = await getBalls(matchId, innings)
    setBalls(updatedBalls)
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

  function swapStriker() {
    setStriker(nonStriker)
    setNonStriker(striker)
  }

  function handleRunTap(tap) {
    if (isInningsOver || targetChased || match.status === 'completed') return
    recordBall({ runs: getMappedRuns(tap), swapRuns: tap })
  }

  function selectWicketType(type) {
    setWicketDismissalType(type)
    setWicketRuns(0)
    setWicketOutBatsman(type === 'run out' ? striker : null)
  }

  function confirmWicket() {
    recordBall({
      runs: wicketRuns,
      isWicket: true,
      dismissalType: wicketDismissalType,
      outBatsmanIndex: wicketDismissalType === 'run out' ? wicketOutBatsman : striker,
    })
    closeSheet()
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

  if (showInningsBreak) {
    const reasonText = inningsEndReason === 'all-out' ? 'All batsmen out' : `${match.totalOvers} overs completed`
    return (
      <div className="container innings-break">
        <h2>End of 1st Innings</h2>
        <div className="innings-end-reason">{reasonText}</div>
        <p>{match.teamA.name}: {firstInningsScore} runs</p>
        <div className="target">Target: {firstInningsScore + 1}</div>
        <p>{match.teamB.name} need {firstInningsScore + 1} runs from {match.totalOvers} overs</p>
        <button className="btn btn-primary btn-large" style={{ marginTop: 20 }} onClick={startSecondInnings}>Start 2nd Innings</button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => setShowInningsBreak(false)}>← Continue in 1st Innings</button>
        <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={onViewScorecard}>View Scorecard</button>
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

  const curBowlName = getPlayerName('bowl', bowlerIdx)
  const bowlStat = score.bowlers[curBowlName] ?? score.bowlers[bowlerIdx]

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
        <button className="score-btn-lg wicket" onClick={() => { if (!isInningsOver) setSheet('wicket') }}>W</button>
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
            return <div key={i} className={cls}>{ballDisplay(b)}</div>
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
                <div className="extras-runs">
                  {[0, 1, 2, 3, 4, 6].map(n => (
                    <button key={n} className={wicketRuns === n ? 'selected' : ''} onClick={() => setWicketRuns(n)}>{n}</button>
                  ))}
                </div>
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
                <div className="extras-runs">
                  {[0, 1, 2, 3, 4, 6].map(n => {
                    const isNoBall = extraType === 'noBall'
                    const selected = isNoBall ? noBallBatsmanRuns === n : extraRuns === n
                    return (
                      <button key={n} className={selected ? 'selected' : ''} onClick={() => (isNoBall ? setNoBallBatsmanRuns(n) : setExtraRuns(n))}>{n}</button>
                    )
                  })}
                </div>
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
    </div>
  )
}
