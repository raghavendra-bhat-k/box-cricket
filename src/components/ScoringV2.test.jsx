import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ScoringV2 from './ScoringV2'
import db, { createMatchV2, addBall, getBalls, getAuditLog } from '../db'

const onBack = vi.fn()
const onViewScorecard = vi.fn()

async function createV2Match(overrides = {}) {
  return createMatchV2({
    teamA: 'Team A',
    teamB: 'Team B',
    totalOvers: 2,
    playersPerSide: 3,
    teamAPlayers: ['Alice', 'Bob', 'Charlie'],
    teamBPlayers: ['George', 'Helen', 'Iris'],
    ...overrides,
  })
}

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  await db.auditLog.clear()
  onBack.mockClear()
  onViewScorecard.mockClear()
})

function renderV2(matchId, settings) {
  return render(<ScoringV2 matchId={matchId} settings={settings} onBack={onBack} onViewScorecard={onViewScorecard} />)
}

describe('ScoringV2 - rendering', () => {
  it('renders the scoring grid and player names', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => {
      expect(screen.getByText('W')).toBeInTheDocument()
      expect(screen.getByText('EX')).toBeInTheDocument()
      expect(screen.getByText(/Alice/)).toBeInTheDocument()
      expect(screen.getByText(/George/)).toBeInTheDocument()
    })
  })
})

describe('ScoringV2 - scoring core', () => {
  it('records a run and updates the score', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByText('4'))
    fireEvent.click(screen.getByText('4'))
    await waitFor(() => {
      expect(screen.getByText(/Team A: 4\/0/)).toBeInTheDocument()
    })
    const balls = await getBalls(id, 1)
    expect(balls).toHaveLength(1)
    expect(balls[0].runs).toBe(4)
  })

  it('rotates strike on an odd run', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByText('1'))
    fireEvent.click(screen.getByText('1'))
    // After a single, Bob (was non-striker) becomes striker (marked with *).
    await waitFor(() => {
      expect(screen.getByText('*Bob')).toBeInTheDocument()
    })
  })

  it('records a wicket via the wicket sheet', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    fireEvent.click(screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Confirm Wicket'))
    await waitFor(() => {
      expect(screen.getByText(/Team A: 0\/1/)).toBeInTheDocument()
    })
  })

  it('asks who is out for a run out', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    fireEvent.click(screen.getByText('Run Out'))
    await waitFor(() => expect(screen.getByText('Who is out?')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Bob' }))
    fireEvent.click(screen.getByText('Confirm Wicket'))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/1/)).toBeInTheDocument())
    const balls = await getBalls(id, 1)
    expect(balls[0].isWicket).toBe(true)
    expect(balls[0].outBatsmanIndex).toBe(1) // Bob
  })

  it('records a wide as an extra run without a legal ball', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByText('EX'))
    fireEvent.click(screen.getByText('EX'))
    fireEvent.click(screen.getByText('Wide'))
    fireEvent.click(screen.getByText('Confirm Wide'))
    await waitFor(() => expect(screen.getByText(/Team A: 1\/0/)).toBeInTheDocument())
    const balls = await getBalls(id, 1)
    expect(balls[0].isExtra).toBe(true)
    expect(balls[0].extraType).toBe('wide')
  })

  it('undo removes the last ball', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByText('4'))
    fireEvent.click(screen.getByText('4'))
    await waitFor(() => screen.getByText(/Team A: 4\/0/))
    fireEvent.click(screen.getByText('Undo'))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/0/)).toBeInTheDocument())
    expect(await getBalls(id, 1)).toHaveLength(0)
  })
})

describe('ScoringV2 - audit logging', () => {
  it('appends audit events for balls when enabled', async () => {
    const id = await createV2Match()
    renderV2(id, { auditLog: true })
    await waitFor(() => screen.getByText('4'))
    fireEvent.click(screen.getByText('4'))
    await waitFor(() => screen.getByText(/Team A: 4\/0/))
    const log = await getAuditLog(id)
    // matchCreated + ballAdded
    expect(log.map(e => e.action)).toContain('ballAdded')
  })

  it('does not append ball audit events when audit logging is off', async () => {
    const id = await createV2Match()
    renderV2(id, { auditLog: false })
    await waitFor(() => screen.getByText('4'))
    fireEvent.click(screen.getByText('4'))
    await waitFor(() => screen.getByText(/Team A: 4\/0/))
    const log = await getAuditLog(id)
    expect(log.some(e => e.action === 'ballAdded')).toBe(false)
  })
})

describe('ScoringV2 - extras and menu', () => {
  it('records a no-ball with batsman runs plus the penalty', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByText('EX'))
    fireEvent.click(screen.getByText('EX'))
    fireEvent.click(screen.getByText('No Ball'))
    // Choose 2 batsman runs (scoped to the sheet); no-ball adds a 1-run penalty -> total 3.
    const sheet = document.querySelector('.bottom-sheet')
    fireEvent.click(within(sheet).getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByText('Confirm No Ball'))
    await waitFor(() => expect(screen.getByText(/Team A: 3\/0/)).toBeInTheDocument())
    const balls = await getBalls(id, 1)
    expect(balls[0].extraType).toBe('noBall')
    expect(balls[0].extraRuns).toBe(1)
  })

  it('opens the menu and reaches the scorecard and home', async () => {
    const id = await createV2Match()
    renderV2(id)
    await waitFor(() => screen.getByLabelText('Menu'))
    fireEvent.click(screen.getByLabelText('Menu'))
    fireEvent.click(screen.getByText('View Scorecard'))
    expect(onViewScorecard).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Menu'))
    fireEvent.click(screen.getByText('Home'))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('ScoringV2 - guided startup flow', () => {
  const guided = { guidedScoring: true, toss: true, openingBatsmen: true, auditLog: true }

  it('runs toss then openings before showing the scoring grid', async () => {
    const id = await createV2Match()
    renderV2(id, guided)
    // Toss step appears first (scoring grid is not yet shown).
    await waitFor(() => expect(screen.getByText('Toss')).toBeInTheDocument())
    expect(screen.queryByText('EX')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Team A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bat' }))
    fireEvent.click(screen.getByText('Confirm Toss'))

    // Opening batsmen then bowler.
    await waitFor(() => expect(screen.getByText('Select the striker')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Alice' }))
    await waitFor(() => screen.getByText('Select the non-striker'))
    fireEvent.click(screen.getByRole('button', { name: 'Bob' }))
    await waitFor(() => screen.getByText('Select the bowler'))
    fireEvent.click(screen.getByRole('button', { name: 'George' }))

    // Now the scoring grid is shown with the chosen striker on strike.
    await waitFor(() => expect(screen.getByText('EX')).toBeInTheDocument())
    expect(screen.getByText('*Alice')).toBeInTheDocument()

    const m = await db.matches.get(id)
    expect(m.toss.battingFirst).toBe('A')
    expect(m.openingSetup).toEqual({ striker: 0, nonStriker: 1, bowlerIndex: 0 })
    const log = await getAuditLog(id)
    expect(log.map(e => e.action)).toEqual(expect.arrayContaining(['tossSet', 'openingSet']))
  })

  it('bats team B first and labels the scorebar correctly when the toss elects to bowl', async () => {
    const id = await createV2Match()
    renderV2(id, guided)
    await waitFor(() => screen.getByText('Toss'))
    // Team A won the toss and elected to bowl -> Team B bats first.
    fireEvent.click(screen.getByRole('button', { name: 'Team A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bowl' }))
    fireEvent.click(screen.getByText('Confirm Toss'))

    await waitFor(() => screen.getByText('Select the striker'))
    // Batting roster is now team B (George/Helen/Iris).
    fireEvent.click(screen.getByRole('button', { name: 'George' }))
    await waitFor(() => screen.getByText('Select the non-striker'))
    fireEvent.click(screen.getByRole('button', { name: 'Helen' }))
    await waitFor(() => screen.getByText('Select the bowler'))
    // Bowling roster is team A (Alice...).
    fireEvent.click(screen.getByRole('button', { name: 'Alice' }))

    await waitFor(() => expect(screen.getByText(/Team B: 0\/0/)).toBeInTheDocument())
    expect(screen.getByText('*George')).toBeInTheDocument()
  })

  it('skips the startup flow when guided scoring is off', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: false })
    // Goes straight to scoring, no toss.
    await waitFor(() => expect(screen.getByText('EX')).toBeInTheDocument())
    expect(screen.queryByText('Toss')).not.toBeInTheDocument()
  })
})

describe('ScoringV2 - bug fixes', () => {
  async function sixPlayerMatch(openingSetup) {
    const id = await createV2Match({
      playersPerSide: 6,
      teamAPlayers: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'],
      teamBPlayers: ['George', 'Helen', 'Iris', 'Jack', 'Kate', 'Leo'],
    })
    await db.matches.update(id, {
      toss: { wonBy: 'A', decision: 'bat', battingFirst: 'A' },
      openingSetup,
    })
    return id
  }

  it('Bug 1: incoming batsman after a wicket is a real player, not an out-of-range slot', async () => {
    // Openers chosen non-adjacently (Alice #0 and Frank #5). When Alice is out,
    // the default incoming must be the lowest free player (#1 Bob), not #6 (Bat 7).
    const id = await sixPlayerMatch({ striker: 0, nonStriker: 5, bowlerIndex: 0 })
    renderV2(id, { guidedScoring: true, detailedWicket: true, toss: false, openingBatsmen: false })
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    await waitFor(() => screen.getByText('How did the batsman get out?'))
    fireEvent.click(screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Confirm Wicket'))
    await waitFor(() => screen.getByText('Who comes in to bat?'))
    // Default is Bob (#1), not "Batsman 7".
    expect(screen.getByText('Continue with Bob')).toBeInTheDocument()
    expect(screen.queryByText(/Batsman 7/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Continue with Bob'))
    await waitFor(() => screen.getByText(/Team A: 0\/1/))
    const balls = await getBalls(id, 1)
    expect(balls[0].newBatsmanIndex).toBe(1)
  })

  it('Bug 3: a no-ball can score 5 batsman runs via the custom input', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: true, detailedWicket: false, toss: false, openingBatsmen: false })
    await waitFor(() => screen.getByText('EX'))
    fireEvent.click(screen.getByText('EX'))
    fireEvent.click(screen.getByText('No Ball'))
    const sheet = document.querySelector('.bottom-sheet')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Custom runs' }))
    fireEvent.change(within(sheet).getByLabelText('Custom run value'), { target: { value: '5' } })
    fireEvent.click(screen.getByText('Confirm No Ball'))
    // 5 batsman runs + 1 no-ball penalty = 6.
    await waitFor(() => expect(screen.getByText(/Team A: 6\/0/)).toBeInTheDocument())
    const balls = await getBalls(id, 1)
    expect(balls[0].runs).toBe(5)
    expect(balls[0].extraType).toBe('noBall')
  })

  it('Bug 2: tapping a delivery lets you correct its runs', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: true, detailedWicket: false, toss: false, openingBatsmen: false })
    await waitFor(() => screen.getByText('4'))
    fireEvent.click(screen.getByText('4'))
    await waitFor(() => screen.getByText(/Team A: 4\/0/))
    // Tap the "4" delivery in the current over (accessible name "Edit ball 4").
    fireEvent.click(screen.getByRole('button', { name: 'Edit ball 4' }))
    await waitFor(() => screen.getByText('Edit Ball'))
    const sheet = document.querySelector('.bottom-sheet')
    fireEvent.click(within(sheet).getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText(/Team A: 1\/0/)).toBeInTheDocument())
  })

  it('Bug 2: a delivery can be deleted', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: true, detailedWicket: false, toss: false, openingBatsmen: false })
    await waitFor(() => screen.getByText('4'))
    fireEvent.click(screen.getByText('4'))
    await waitFor(() => screen.getByText(/Team A: 4\/0/))
    fireEvent.click(screen.getByRole('button', { name: 'Edit ball 4' }))
    await waitFor(() => screen.getByText('Edit Ball'))
    fireEvent.click(screen.getByText('Delete Ball'))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/0/)).toBeInTheDocument())
    expect(await getBalls(id, 1)).toHaveLength(0)
  })

  it('Edit: a delivery can be turned into a wicket', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: true, detailedWicket: false, toss: false, openingBatsmen: false })
    await waitFor(() => screen.getByRole('button', { name: '0', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '0', exact: true }))
    // A dot leaves the score at 0/0, so wait for the over count to advance instead.
    await waitFor(() => expect(screen.getByText(/0\.1 ov/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Edit ball/ }))
    await waitFor(() => screen.getByText('Edit Ball'))
    // Toggle the wicket switch, pick a dismissal, save.
    fireEvent.click(screen.getByRole('switch', { name: 'Wicket' }))
    fireEvent.click(screen.getByText('Caught'))
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/1/)).toBeInTheDocument())
    const balls = await getBalls(id, 1)
    expect(balls[0].isWicket).toBe(true)
    expect(balls[0].dismissalType).toBe('caught')
  })

  it('forced-bowler prompt reappears after undoing across an over boundary', async () => {
    // 2-over guided match, force bowler on, openings preset.
    const id = await createV2Match({
      playersPerSide: 6, totalOvers: 2,
      teamAPlayers: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      teamBPlayers: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    })
    await db.matches.update(id, {
      toss: { wonBy: 'A', decision: 'bat', battingFirst: 'A' },
      openingSetup: { striker: 0, nonStriker: 1, bowlerIndex: 0 },
    })
    // Seed the first 5 legal balls so the test only drives the boundary itself.
    for (let i = 0; i < 5; i++) {
      await addBall({
        matchId: id, innings: 1, over: 0, ballInOver: i, runs: 0, tapRuns: 0,
        isExtra: false, extraType: null, extraRuns: 0, isWicket: false,
        dismissalType: null, batsmanIndex: 0, bowlerIndex: 0, bowlerName: 'b1',
      })
    }
    const settings = { guidedScoring: true, forceBowlerEachOver: true, toss: false, openingBatsmen: false, detailedWicket: false }
    renderV2(id, settings)
    await waitFor(() => expect(screen.getByText(/0\.5 ov/)).toBeInTheDocument())

    // The 6th ball completes the over → forced-bowler step; confirm it.
    fireEvent.click(screen.getByRole('button', { name: '0', exact: true }))
    await waitFor(() => screen.getByText(/Who bowls over 2/))
    fireEvent.click(screen.getByText(/Continue with/))
    await waitFor(() => expect(screen.getByText(/1\.0 ov/)).toBeInTheDocument())

    // Undo the last ball (back to 0.5), then re-bowl it.
    fireEvent.click(screen.getByText('Undo'))
    await waitFor(() => expect(screen.getByText(/0\.5 ov/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '0', exact: true }))
    // The prompt must show again — it must NOT silently skip (bowlerAckOver reset).
    await waitFor(() => expect(screen.getByText(/Who bowls over 2/)).toBeInTheDocument())
  })
})

describe('ScoringV2 - guided in-play flows', () => {
  // Guided match with openings already set so we start straight in scoring.
  // Uses full 6-player rosters so an incoming batsman can be overridden.
  async function guidedMatch(overrides = {}) {
    const id = await createV2Match({
      playersPerSide: 6,
      teamAPlayers: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'],
      teamBPlayers: ['George', 'Helen', 'Iris', 'Jack', 'Kate', 'Leo'],
      ...overrides,
    })
    await db.matches.update(id, {
      toss: { wonBy: 'A', decision: 'bat', battingFirst: 'A' },
      openingSetup: { striker: 0, nonStriker: 1, bowlerIndex: 0 },
    })
    return id
  }
  const inplay = { guidedScoring: true, toss: true, openingBatsmen: true, forceBowlerEachOver: true, detailedWicket: true, auditLog: true }

  it('shows the full-screen wicket flow and then prompts for the new batsman', async () => {
    const id = await guidedMatch()
    renderV2(id, inplay)
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    // Full-screen wicket step (not the bottom sheet).
    await waitFor(() => expect(screen.getByText('How did the batsman get out?')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Confirm Wicket'))
    // New-batsman step appears.
    await waitFor(() => expect(screen.getByText('Who comes in to bat?')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Continue with/))
    // Back to scoring, one wicket down.
    await waitFor(() => expect(screen.getByText(/Team A: 0\/1/)).toBeInTheDocument())
  })

  it('lets you override the incoming batsman', async () => {
    const id = await guidedMatch()
    renderV2(id, inplay)
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    await waitFor(() => screen.getByText('How did the batsman get out?'))
    fireEvent.click(screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Confirm Wicket'))
    await waitFor(() => screen.getByText('Who comes in to bat?'))
    // Pick Dave (index 3) instead of the default (Charlie, index 2).
    fireEvent.click(screen.getByRole('button', { name: 'Dave' }))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/1/)).toBeInTheDocument())
    const balls = await getBalls(id, 1)
    expect(balls[0].newBatsmanIndex).toBe(3)
  })

  it('forces a bowler selection at the end of an over', async () => {
    const id = await guidedMatch({ totalOvers: 2 })
    renderV2(id, inplay)
    await waitFor(() => screen.getByRole('button', { name: '1' }))
    // Bowl 5 legal singles (each settling), then the 6th completes the over.
    for (let i = 1; i <= 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      await waitFor(() => expect(screen.getByText(new RegExp(`Team A: ${i}/0`))).toBeInTheDocument())
    }
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    // Forced bowler step appears before the next over.
    await waitFor(() => expect(screen.getByText(/Who bowls over 2/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Continue with/))
    // Scoring resumes.
    await waitFor(() => expect(screen.getByText('EX')).toBeInTheDocument())
    const log = await getAuditLog(id)
    expect(log.some(e => e.action === 'bowlerSelected')).toBe(true)
  })

  it('uses the bottom-sheet wicket (not full screen) when detailedWicket is off', async () => {
    const id = await guidedMatch()
    renderV2(id, { guidedScoring: true, detailedWicket: false })
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    // The bottom sheet heading, not the full-screen flow subtitle.
    await waitFor(() => expect(screen.getByText('Wicket')).toBeInTheDocument())
    expect(screen.queryByText('How did the batsman get out?')).not.toBeInTheDocument()
  })
})

describe('ScoringV2 - home button & back guard', () => {
  it('routes the browser back button to home when enabled', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: true, homeButton: true, toss: false, openingBatsmen: false })
    await waitFor(() => screen.getByText('EX'))
    // Simulate a hardware/browser back press.
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(onBack).toHaveBeenCalled()
  })

  it('shows a Home escape on the full-screen toss step', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: true, homeButton: true, toss: true, openingBatsmen: true })
    await waitFor(() => screen.getByText('Toss'))
    fireEvent.click(screen.getByLabelText('Home'))
    expect(onBack).toHaveBeenCalled()
  })

  it('has no Home escape on overlays when the home setting is off', async () => {
    const id = await createV2Match()
    renderV2(id, { guidedScoring: true, homeButton: false, toss: true, openingBatsmen: true })
    await waitFor(() => screen.getByText('Toss'))
    expect(screen.queryByLabelText('Home')).not.toBeInTheDocument()
  })
})

describe('ScoringV2 - undo/redo', () => {
  // Guided but with the pre-match + in-play prompts off, so we start in scoring.
  const settings = { guidedScoring: true, undoRedo: true, toss: false, openingBatsmen: false, forceBowlerEachOver: false, detailedWicket: false, auditLog: true }

  it('does not show a Redo button when undo/redo is disabled', async () => {
    const id = await createV2Match()
    renderV2(id, { ...settings, undoRedo: false })
    await waitFor(() => screen.getByText('Undo'))
    expect(screen.queryByText('Redo')).not.toBeInTheDocument()
  })

  it('undo then redo replays the ball back to the same score', async () => {
    const id = await createV2Match()
    renderV2(id, settings)
    await waitFor(() => screen.getByText('4'))
    fireEvent.click(screen.getByText('4'))
    await waitFor(() => screen.getByText(/Team A: 4\/0/))

    fireEvent.click(screen.getByText('Undo'))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/0/)).toBeInTheDocument())
    expect(await getBalls(id, 1)).toHaveLength(0)

    fireEvent.click(screen.getByText('Redo'))
    await waitFor(() => expect(screen.getByText(/Team A: 4\/0/)).toBeInTheDocument())
    const balls = await getBalls(id, 1)
    expect(balls).toHaveLength(1)
    expect(balls[0].runs).toBe(4)
    const log = await getAuditLog(id)
    expect(log.map(e => e.action)).toEqual(expect.arrayContaining(['undo', 'redo']))
  })

  it('Redo is disabled until an undo happens, and a new ball clears the redo history', async () => {
    const id = await createV2Match()
    renderV2(id, settings)
    await waitFor(() => screen.getByText('4'))
    // Nothing to redo yet.
    expect(screen.getByText('Redo')).toBeDisabled()

    fireEvent.click(screen.getByText('4'))
    await waitFor(() => screen.getByText(/Team A: 4\/0/))
    fireEvent.click(screen.getByText('Undo'))
    await waitFor(() => expect(screen.getByText('Redo')).not.toBeDisabled())

    // A new forward action invalidates the redo history.
    fireEvent.click(screen.getByText('1'))
    await waitFor(() => screen.getByText(/Team A: 1\/0/))
    expect(screen.getByText('Redo')).toBeDisabled()
  })

  it('redo of a wicket restores the stamped incoming batsman', async () => {
    const id = await createV2Match()
    renderV2(id, settings)
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    fireEvent.click(screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Confirm Wicket'))
    await waitFor(() => screen.getByText(/Team A: 0\/1/))
    const before = (await getBalls(id, 1))[0].newBatsmanIndex

    fireEvent.click(screen.getByText('Undo'))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/0/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Redo'))
    await waitFor(() => expect(screen.getByText(/Team A: 0\/1/)).toBeInTheDocument())
    const after = (await getBalls(id, 1))[0]
    expect(after.isWicket).toBe(true)
    expect(after.newBatsmanIndex).toBe(before)
  })
})

describe('ScoringV2 - innings and match end', () => {
  async function seedCompleteFirstInnings(id, runsPerBall = 0) {
    for (let i = 0; i < 6; i++) {
      await addBall({
        matchId: id, innings: 1, over: 0, ballInOver: i, runs: runsPerBall,
        tapRuns: runsPerBall, isExtra: false, extraType: null, extraRuns: 0,
        isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0,
      })
    }
  }

  it('progresses through the innings break into the second innings and completes the match', async () => {
    const id = await createV2Match({ totalOvers: 1 })
    await seedCompleteFirstInnings(id, 0) // 1 over done, 0 runs -> target 1
    renderV2(id)

    // The innings-complete banner appears; tap it to reach the break screen.
    await waitFor(() => screen.getByText(/1st innings complete/))
    fireEvent.click(screen.getByText(/1st innings complete/))
    await waitFor(() => expect(screen.getByText('End of 1st Innings')).toBeInTheDocument())
    expect(screen.getByText('Target: 1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Start 2nd Innings'))
    // Wait until the 2nd innings is actually active (team B now batting at 0/0).
    await waitFor(() => expect(screen.getByText(/Team B: 0\/0/)).toBeInTheDocument())

    // Any run chases the target of 1 and ends the match.
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    await waitFor(() => expect(screen.getByText(/won by/)).toBeInTheDocument())
    expect(screen.getByText('View Full Scorecard')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Home'))
    expect(onBack).toHaveBeenCalled()
  })

  it('shows the innings break when overs are complete', async () => {
    // 1 over match. Complete the over with 6 legal singles, waiting for the
    // cumulative score to settle between taps so each ball persists.
    const id = await createV2Match({ totalOvers: 1 })
    renderV2(id)
    await waitFor(() => screen.getByRole('button', { name: '1' }))
    // First 5 legal balls stay in the innings; wait for each to settle.
    for (let i = 1; i <= 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      await waitFor(() => expect(screen.getByText(new RegExp(`Team A: ${i}/0`))).toBeInTheDocument())
    }
    // The 6th ball completes the over and the (1-over) innings.
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    await waitFor(() => expect(screen.getByText('End of 1st Innings')).toBeInTheDocument())
  })
})
