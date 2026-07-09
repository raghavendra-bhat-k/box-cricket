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
