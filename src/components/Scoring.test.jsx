import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import Scoring from './Scoring'
import db, { createMatch, addBall, getBalls, updateMatch } from '../db'

const onBack = vi.fn()
const onViewScorecard = vi.fn()

async function createTestMatch(overrides = {}) {
  return createMatch({
    teamA: 'Team A',
    teamB: 'Team B',
    totalOvers: 6,
    playersPerSide: 6,
    teamAPlayers: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'],
    teamBPlayers: ['George', 'Helen', 'Iris', 'Jack', 'Kate', 'Leo'],
    ...overrides,
  })
}

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  onBack.mockClear()
  onViewScorecard.mockClear()
})

function renderScoring(matchId) {
  return render(
    <Scoring matchId={matchId} onBack={onBack} onViewScorecard={onViewScorecard} />
  )
}

// ─── Basic rendering ────────────────────────────────────────────

describe('Scoring - basic rendering', () => {
  it('shows loading then scoring screen', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText('W')).toBeInTheDocument()
      expect(screen.getByText('EX')).toBeInTheDocument()
    })
  })

  it('shows score buttons 0-4, 6, W, EX', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getByText('6')).toBeInTheDocument()
    })
  })

  it('shows batsmen and bowler names', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText(/Alice/)).toBeInTheDocument()
      expect(screen.getByText(/Bob/)).toBeInTheDocument()
      expect(screen.getByText(/George/)).toBeInTheDocument()
    })
  })
})

// ─── Wicket with runs ───────────────────────────────────────────

describe('Scoring - wicket with runs', () => {
  it('wicket sheet shows dismissal types first', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    fireEvent.click(screen.getByText('W'))
    await waitFor(() => {
      expect(screen.getByText('Wicket')).toBeInTheDocument()
      expect(screen.getByText('Bowled')).toBeInTheDocument()
      expect(screen.getByText('Run Out')).toBeInTheDocument()
      expect(screen.getByText('Caught')).toBeInTheDocument()
    })
  })

  it('after selecting dismissal type, shows runs picker with 0,1,2,3,4,6,+', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    fireEvent.click(screen.getByText('W'))
    await waitFor(() => screen.getByText('Run Out'))
    fireEvent.click(screen.getByText('Run Out'))

    await waitFor(() => {
      expect(screen.getByText(/Run Out.*Runs scored/i)).toBeInTheDocument()
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })

    // Check runs picker has expected values
    const runsContainer = screen.getByText('Confirm').closest('.bottom-sheet')
    const buttons = within(runsContainer).getAllByRole('button')
    const labels = buttons.map(b => b.textContent)
    expect(labels).toContain('0')
    expect(labels).toContain('1')
    expect(labels).toContain('2')
    expect(labels).toContain('3')
    expect(labels).toContain('4')
    expect(labels).toContain('6')
    expect(labels).toContain('+')
  })

  it('records wicket with runs when confirmed', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    fireEvent.click(screen.getByText('W'))
    await waitFor(() => screen.getByText('Run Out'))
    fireEvent.click(screen.getByText('Run Out'))

    await waitFor(() => screen.getByText('Confirm'))

    // Select 2 runs
    const runsContainer = screen.getByText('Confirm').closest('.bottom-sheet')
    const twoBtn = within(runsContainer).getAllByRole('button').find(b => b.textContent === '2')
    fireEvent.click(twoBtn)
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls).toHaveLength(1)
      expect(balls[0].isWicket).toBe(true)
      expect(balls[0].runs).toBe(2)
      expect(balls[0].dismissalType).toBe('run out')
    })
  })

  it('wicket defaults to 0 runs', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    fireEvent.click(screen.getByText('W'))
    await waitFor(() => screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Bowled'))
    await waitFor(() => screen.getByText('Confirm'))
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls).toHaveLength(1)
      expect(balls[0].runs).toBe(0)
      expect(balls[0].isWicket).toBe(true)
      expect(balls[0].dismissalType).toBe('bowled')
    })
  })
})

// ─── Extras with 6+ runs ───────────────────────────────────────

describe('Scoring - extras', () => {
  it('extras sheet shows type picker then runs picker with 1,2,3,4,6,+', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('EX'))

    fireEvent.click(screen.getByText('EX'))
    await waitFor(() => screen.getByText('Wide'))
    fireEvent.click(screen.getByText('Wide'))

    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })

    const container = screen.getByText('Confirm').closest('.bottom-sheet')
    const buttons = within(container).getAllByRole('button')
    const labels = buttons.map(b => b.textContent)
    expect(labels).toContain('1')
    expect(labels).toContain('2')
    expect(labels).toContain('3')
    expect(labels).toContain('4')
    expect(labels).toContain('6')
    expect(labels).toContain('+')
    // No 5 button
    expect(labels).not.toContain('5')
  })

  it('+ button shows custom input for extras', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('EX'))

    fireEvent.click(screen.getByText('EX'))
    await waitFor(() => screen.getByText('No Ball'))
    fireEvent.click(screen.getByText('No Ball'))
    await waitFor(() => screen.getByText('+'))

    fireEvent.click(screen.getByText('+'))
    await waitFor(() => {
      const input = screen.getByDisplayValue('7')
      expect(input).toBeInTheDocument()
      expect(input.type).toBe('number')
    })
  })
})

// ─── Edit ball ──────────────────────────────────────────────────

describe('Scoring - edit ball', () => {
  it('tapping a ball dot opens edit sheet', async () => {
    const id = await createTestMatch()
    await addBall({
      matchId: id, innings: 1, over: 0, ballInOver: 0,
      runs: 1, isExtra: false, extraType: null, extraRuns: 0,
      isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0,
    })
    renderScoring(id)

    await waitFor(() => {
      expect(document.querySelectorAll('.ball-dot').length).toBeGreaterThan(0)
    })
    fireEvent.click(document.querySelector('.ball-dot'))

    await waitFor(() => {
      expect(screen.getByText('Edit Delivery')).toBeInTheDocument()
    })
  })

  it('edit ball runs has [0,1,2,3,4,6,+] buttons', async () => {
    const id = await createTestMatch()
    await addBall({
      matchId: id, innings: 1, over: 0, ballInOver: 0,
      runs: 1, isExtra: false, extraType: null, extraRuns: 0,
      isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0,
    })
    renderScoring(id)

    // Wait for ball dot to appear then click it
    await waitFor(() => {
      expect(document.querySelectorAll('.ball-dot').length).toBeGreaterThan(0)
    })
    fireEvent.click(document.querySelector('.ball-dot'))

    await waitFor(() => screen.getByText('Edit Delivery'))

    const sheet = screen.getByText('Edit Delivery').closest('.bottom-sheet')
    const runBtns = within(sheet).getAllByRole('button')
    const labels = runBtns.map(b => b.textContent)
    expect(labels).toContain('0')
    expect(labels).toContain('1')
    expect(labels).toContain('2')
    expect(labels).toContain('3')
    expect(labels).toContain('4')
    expect(labels).toContain('6')
    expect(labels).toContain('+')
  })

  it('edit ball allows setting runs + wicket independently', async () => {
    const id = await createTestMatch()
    await addBall({
      matchId: id, innings: 1, over: 0, ballInOver: 0,
      runs: 0, isExtra: false, extraType: null, extraRuns: 0,
      isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0,
    })
    renderScoring(id)

    await waitFor(() => {
      expect(document.querySelectorAll('.ball-dot').length).toBeGreaterThan(0)
    })
    fireEvent.click(document.querySelector('.ball-dot'))

    await waitFor(() => screen.getByText('Edit Delivery'))

    const sheet = screen.getByText('Edit Delivery').closest('.bottom-sheet')

    // Select 2 runs
    const runBtns = within(sheet).getAllByRole('button')
    const btn2 = runBtns.find(b => b.textContent === '2' && b.classList.contains('edit-run-btn'))
    fireEvent.click(btn2)

    // Toggle wicket on
    const wBtn = runBtns.find(b => b.textContent === 'W')
    fireEvent.click(wBtn)

    // Save
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls[0].runs).toBe(2)
      expect(balls[0].isWicket).toBe(true)
    })
  })

  it('edit ball extras has [1,2,3,4,6,+] buttons', async () => {
    const id = await createTestMatch()
    await addBall({
      matchId: id, innings: 1, over: 0, ballInOver: 0,
      runs: 0, isExtra: true, extraType: 'wide', extraRuns: 1,
      isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0,
    })
    renderScoring(id)

    await waitFor(() => {
      expect(document.querySelectorAll('.ball-dot').length).toBeGreaterThan(0)
    })
    fireEvent.click(document.querySelector('.ball-dot'))

    await waitFor(() => screen.getByText('Edit Delivery'))
    await waitFor(() => screen.getByText('Extra runs'))

    const section = screen.getByText('Extra runs').closest('.edit-ball-section')
    const btns = within(section).getAllByRole('button')
    const labels = btns.map(b => b.textContent)
    expect(labels).toContain('1')
    expect(labels).toContain('4')
    expect(labels).toContain('6')
    expect(labels).toContain('+')
  })
})

// ─── Menu items ─────────────────────────────────────────────────

describe('Scoring - menu', () => {
  it('menu shows Change Team Sizes, Change Overs, Remove Player', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    // Open menu via the three-dot button
    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)

    await waitFor(() => {
      expect(screen.getByText('Change Team Sizes')).toBeInTheDocument()
      expect(screen.getByText('Change Overs')).toBeInTheDocument()
      expect(screen.getByText('Remove Player')).toBeInTheDocument()
      expect(screen.getByText('Edit Player Names')).toBeInTheDocument()
    })
  })
})

// ─── Change Overs ───────────────────────────────────────────────

describe('Scoring - change overs', () => {
  it('opens change overs sheet from menu', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Change Overs'))
    fireEvent.click(screen.getByText('Change Overs'))

    await waitFor(() => {
      expect(screen.getByText('Change Overs')).toBeInTheDocument()
      expect(screen.getByText('Total Overs')).toBeInTheDocument()
    })
  })
})

// ─── Change Team Sizes ──────────────────────────────────────────

describe('Scoring - change team sizes', () => {
  it('opens change team sizes sheet with both team inputs', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Change Team Sizes'))
    fireEvent.click(screen.getByText('Change Team Sizes'))

    await waitFor(() => {
      expect(screen.getByText('Team A players')).toBeInTheDocument()
      expect(screen.getByText('Team B players')).toBeInTheDocument()
    })
  })
})

// ─── Remove Player ──────────────────────────────────────────────

describe('Scoring - remove player', () => {
  it('opens remove player sheet with team toggle', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Remove Player'))
    fireEvent.click(screen.getByText('Remove Player'))

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument()
      expect(screen.getByText('Team B')).toBeInTheDocument()
      // Should show player names
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })

  it('shows Remove button for each player', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Remove Player'))
    fireEvent.click(screen.getByText('Remove Player'))

    await waitFor(() => {
      const removeButtons = screen.getAllByText('Remove')
      expect(removeButtons.length).toBe(6) // 6 players on team A
    })
  })
})

// ─── Edit Player Names ──────────────────────────────────────────

describe('Scoring - edit player names', () => {
  it('shows input slots for all players based on team size', async () => {
    const id = await createTestMatch({ playersPerSide: 4, teamAPlayers: ['A1'], teamBPlayers: [] })
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Edit Player Names'))
    fireEvent.click(screen.getByText('Edit Player Names'))

    await waitFor(() => {
      expect(screen.getByText('Edit Player Names')).toBeInTheDocument()
      // Should have inputs even for empty player slots
      const inputs = screen.getAllByPlaceholderText(/Player \d+/)
      // Team A: 4 slots, Team B: 4 slots = 8 total
      expect(inputs.length).toBe(8)
    })
  })

  it('pre-fills existing player names', async () => {
    const id = await createTestMatch({ playersPerSide: 3, teamAPlayers: ['Alice', 'Bob', 'Charlie'] })
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Edit Player Names'))
    fireEvent.click(screen.getByText('Edit Player Names'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Bob')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Charlie')).toBeInTheDocument()
    })
  })
})

// ─── Run scoring ────────────────────────────────────────────────

describe('Scoring - recording runs', () => {
  it('records a 4 when 4 button is tapped', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('4'))

    // Find the boundary 4 button (score-btn-lg)
    const fourBtn = document.querySelector('.score-btn-lg.boundary')
    fireEvent.click(fourBtn)

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls).toHaveLength(1)
      expect(balls[0].runs).toBe(4)
    })
  })

  it('records a 1 when 1 button is tapped', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('1'))

    const btns = document.querySelectorAll('.score-btn-lg.run')
    // Button "1" is the second run button (0,1,2,3)
    const oneBtn = Array.from(btns).find(b => b.textContent === '1')
    fireEvent.click(oneBtn)

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls).toHaveLength(1)
      expect(balls[0].runs).toBe(1)
    })
  })
})

// ─── Extras confirm ─────────────────────────────────────────────

describe('Scoring - extras confirm', () => {
  it('records wide with selected runs', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('EX'))

    fireEvent.click(screen.getByText('EX'))
    await waitFor(() => screen.getByText('Wide'))
    fireEvent.click(screen.getByText('Wide'))
    await waitFor(() => screen.getByText('Confirm'))

    // Default is 1, change to 2
    const container = screen.getByText('Confirm').closest('.bottom-sheet')
    const btn2 = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '2')
    fireEvent.click(btn2)
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls).toHaveLength(1)
      expect(balls[0].isExtra).toBe(true)
      expect(balls[0].extraType).toBe('wide')
      expect(balls[0].extraRuns).toBe(2)
    })
  })

  it('records bye as legal delivery', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('EX'))

    fireEvent.click(screen.getByText('EX'))
    await waitFor(() => screen.getByText('Bye'))
    fireEvent.click(screen.getByText('Bye'))
    await waitFor(() => screen.getByText('Confirm'))
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls).toHaveLength(1)
      expect(balls[0].isExtra).toBe(true)
      expect(balls[0].extraType).toBe('bye')
      // Bye: runs go to runs field, extraRuns = 0
      expect(balls[0].runs).toBe(1)
      expect(balls[0].extraRuns).toBe(0)
    })
  })
})

// ─── Undo ───────────────────────────────────────────────────────

describe('Scoring - undo', () => {
  it('removes last ball on undo', async () => {
    const id = await createTestMatch()
    await addBall({ matchId: id, innings: 1, over: 0, ballInOver: 0, runs: 4, isExtra: false, extraType: null, extraRuns: 0, isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0 })

    renderScoring(id)
    await waitFor(() => {
      expect(document.querySelectorAll('.ball-dot').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText('Undo'))

    await waitFor(async () => {
      const balls = await getBalls(id, 1)
      expect(balls).toHaveLength(0)
    })
  })
})

// ─── Swap striker ───────────────────────────────────────────────

describe('Scoring - swap striker', () => {
  it('shows Swap Striker button', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText('Swap Striker')).toBeInTheDocument()
    })
  })
})

// ─── Innings break / completed ───────────────────────────────────

describe('Scoring - innings transitions', () => {
  it('shows innings break when all out in 1st innings', async () => {
    const id = await createMatch({
      teamA: 'Small',
      teamB: 'Big',
      totalOvers: 6,
      playersPerSide: 3,
      teamAPlayers: ['A', 'B', 'C'],
      teamBPlayers: ['D', 'E', 'F'],
    })

    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    // Record 2 wickets (for 3-player team = all out)
    fireEvent.click(screen.getByText('W'))
    await waitFor(() => screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Bowled'))
    await waitFor(() => screen.getByText('Confirm'))
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('W'))
    await waitFor(() => screen.getByText('Bowled'))
    fireEvent.click(screen.getByText('Bowled'))
    await waitFor(() => screen.getByText('Confirm'))
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => {
      expect(screen.getByText('End of 1st Innings')).toBeInTheDocument()
      expect(screen.getByText('Start 2nd Innings')).toBeInTheDocument()
    })
  })

  it('shows innings break when overs complete via UI', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 1,
      playersPerSide: 6,
      teamAPlayers: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
      teamBPlayers: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
    })

    // Pre-add 5 balls, record 6th via UI to trigger state change
    for (let i = 0; i < 5; i++) {
      await addBall({
        matchId: id, innings: 1, over: 0, ballInOver: i,
        runs: 1, isExtra: false, extraType: null, extraRuns: 0,
        isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0,
      })
    }

    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    // Record 6th ball via UI
    const zeroBtn = Array.from(document.querySelectorAll('.score-btn-lg.run')).find(b => b.textContent === '0')
    fireEvent.click(zeroBtn)

    await waitFor(() => {
      expect(screen.getByText('End of 1st Innings')).toBeInTheDocument()
    })
  })

  it('can start 2nd innings from break screen', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 1,
      playersPerSide: 6,
      teamAPlayers: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
      teamBPlayers: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
    })

    for (let i = 0; i < 5; i++) {
      await addBall({
        matchId: id, innings: 1, over: 0, ballInOver: i,
        runs: 1, isExtra: false, extraType: null, extraRuns: 0,
        isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0,
      })
    }

    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const zeroBtn = Array.from(document.querySelectorAll('.score-btn-lg.run')).find(b => b.textContent === '0')
    fireEvent.click(zeroBtn)

    await waitFor(() => screen.getByText('Start 2nd Innings'))
    fireEvent.click(screen.getByText('Start 2nd Innings'))

    await waitFor(() => {
      expect(screen.getByText('W')).toBeInTheDocument()
      expect(screen.getByText('EX')).toBeInTheDocument()
    })
  })

  it('shows completed match screen', async () => {
    const id = await createMatch({
      teamA: 'Winners',
      teamB: 'Losers',
      totalOvers: 6,
      playersPerSide: 6,
    })
    await db.matches.update(id, { status: 'completed', result: 'Winners won by 5 runs' })

    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText('Winners won by 5 runs')).toBeInTheDocument()
      expect(screen.getByText('View Full Scorecard')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })

  it('calls onViewScorecard from completed screen', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 6,
      playersPerSide: 6,
    })
    await db.matches.update(id, { status: 'completed', result: 'Tied' })

    renderScoring(id)
    await waitFor(() => screen.getByText('View Full Scorecard'))
    fireEvent.click(screen.getByText('View Full Scorecard'))
    expect(onViewScorecard).toHaveBeenCalled()
  })

  it('calls onBack from completed screen', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 6,
      playersPerSide: 6,
    })
    await db.matches.update(id, { status: 'completed', result: 'Tied' })

    renderScoring(id)
    await waitFor(() => screen.getByText('Home'))
    fireEvent.click(screen.getByText('Home'))
    expect(onBack).toHaveBeenCalled()
  })
})

// ─── Add player ─────────────────────────────────────────────────

describe('Scoring - add player', () => {
  it('opens add player sheet from menu', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText(/Add Player to Team A/))
    fireEvent.click(screen.getByText(/Add Player to Team A/))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Player name')).toBeInTheDocument()
      expect(screen.getByText('Add Player')).toBeInTheDocument()
    })
  })

  it('adds a player and returns to menu', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText(/Add Player to Team A/))
    fireEvent.click(screen.getByText(/Add Player to Team A/))

    await waitFor(() => screen.getByPlaceholderText('Player name'))
    fireEvent.change(screen.getByPlaceholderText('Player name'), { target: { value: 'NewGuy' } })
    fireEvent.click(screen.getByText('Add Player'))

    await waitFor(() => {
      expect(screen.getByText('Match Options')).toBeInTheDocument()
    })
  })
})

// ─── Change overs save ─────────────────────────────────────────

describe('Scoring - change overs save', () => {
  it('saves new overs value', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Change Overs'))
    fireEvent.click(screen.getByText('Change Overs'))

    await waitFor(() => screen.getByText('Total Overs'))
    const input = screen.getByDisplayValue('6')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(async () => {
      const m = await db.matches.get(id)
      expect(m.totalOvers).toBe(10)
    })
  })
})

// ─── Change team sizes save ─────────────────────────────────────

describe('Scoring - change team sizes save', () => {
  it('saves new team sizes', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Change Team Sizes'))
    fireEvent.click(screen.getByText('Change Team Sizes'))

    await waitFor(() => screen.getByText('Team A players'))
    const inputs = screen.getAllByDisplayValue('6')
    fireEvent.change(inputs[0], { target: { value: '8' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(async () => {
      const m = await db.matches.get(id)
      expect(m.teamASize).toBe(8)
    })
  })
})

// ─── Remove player action ───────────────────────────────────────

describe('Scoring - remove player action', () => {
  it('removes a player when Remove is clicked', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Remove Player'))
    fireEvent.click(screen.getByText('Remove Player'))

    await waitFor(() => screen.getByText('Alice'))
    const removeBtns = screen.getAllByText('Remove')
    fireEvent.click(removeBtns[0]) // Remove Alice

    await waitFor(async () => {
      const m = await db.matches.get(id)
      expect(m.teamA.players).not.toContain('Alice')
      expect(m.teamA.players).toContain('Bob')
    })
  })

  it('toggles between teams', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Remove Player'))
    fireEvent.click(screen.getByText('Remove Player'))

    await waitFor(() => screen.getByText('Team B'))
    fireEvent.click(screen.getByText('Team B'))

    await waitFor(() => {
      expect(screen.getByText('George')).toBeInTheDocument()
    })
  })
})

// ─── Edit player names save ─────────────────────────────────────

describe('Scoring - edit player names save', () => {
  it('saves edited player names', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Edit Player Names'))
    fireEvent.click(screen.getByText('Edit Player Names'))

    await waitFor(() => screen.getByDisplayValue('Alice'))
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Alicia' } })
    fireEvent.click(screen.getByText('Save Names'))

    await waitFor(async () => {
      const m = await db.matches.get(id)
      expect(m.teamA.players[0]).toBe('Alicia')
    })
  })
})

// ─── Menu navigation items ──────────────────────────────────────

describe('Scoring - menu navigation', () => {
  it('View Scorecard calls onViewScorecard', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('View Scorecard'))
    fireEvent.click(screen.getByText('View Scorecard'))
    expect(onViewScorecard).toHaveBeenCalled()
  })

  it('Home calls onBack', async () => {
    const id = await createTestMatch()
    renderScoring(id)
    await waitFor(() => screen.getByText('W'))

    const menuBtn = document.querySelector('.menu-dots')
    fireEvent.click(menuBtn)
    await waitFor(() => screen.getByText('Home'))
    fireEvent.click(screen.getByText('Home'))
    expect(onBack).toHaveBeenCalled()
  })
})

// ─── Resume state restoration ───────────────────────────────────

describe('Scoring - resume restores state from ball history', () => {
  it('restores striker/nonStriker after odd runs', async () => {
    const id = await createTestMatch({ totalOvers: 6 })
    // Pre-add a ball with 1 run (odd → swap strike)
    await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0, runs: 1, isExtra: false, isWicket: false })

    renderScoring(id)
    await waitFor(() => screen.getByText('W'))
    // After 1 run: striker should be 1 (was 0, swapped), nonStriker 0
    // The scoring UI should show the batting team info without crashing
    expect(screen.getByText(/Team A/)).toBeInTheDocument()
  })

  it('restores bowlerIdx after a complete over', async () => {
    const id = await createTestMatch({ totalOvers: 6 })
    // Pre-add 6 dot balls (1 complete over)
    for (let i = 0; i < 6; i++) {
      await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0, runs: 0, isExtra: false, isWicket: false })
    }

    renderScoring(id)
    // After 1 complete over: bowlerIdx=1 (Helen), strike swapped (Bob is striker)
    await waitFor(() => {
      expect(screen.getByText(/1\.0/)).toBeInTheDocument()
      // Bob (index 1) is striker after end-of-over swap
      expect(screen.getByText('*Bob')).toBeInTheDocument()
      // Helen (teamB index 1) is bowling (bowlerIdx advanced to 1)
      expect(screen.getByText(/Helen/)).toBeInTheDocument()
    })
  })

  it('restores state after wicket brings new batsman', async () => {
    const id = await createTestMatch({ totalOvers: 6 })
    // 1 wicket ball
    await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0, runs: 0, isExtra: false, isWicket: true, dismissalType: 'bowled' })

    renderScoring(id)
    // Wait for score to show 0/1 (1 wicket)
    await waitFor(() => {
      expect(screen.getByText(/0\/1/)).toBeInTheDocument()
    })
  })

  it('detects completed 1st innings on resume and shows innings break', async () => {
    const id = await createTestMatch({ totalOvers: 2, playersPerSide: 6 })
    // Pre-add 12 dot balls (2 overs = innings complete)
    for (let i = 0; i < 12; i++) {
      await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: i < 6 ? 0 : 1, runs: 0, isExtra: false, isWicket: false })
    }

    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText(/End of 1st Innings/i)).toBeInTheDocument()
    })
  })

  it('restores state with mixed balls (runs + extras + wickets)', async () => {
    const id = await createTestMatch({ totalOvers: 6 })
    // Ball 1: 2 runs
    await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0, runs: 2, isExtra: false, isWicket: false })
    // Ball 2: wide (1 run)
    await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0, runs: 0, extraRuns: 1, isExtra: true, extraType: 'wide', isWicket: false })
    // Ball 3: 1 run (odd → swap)
    await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0, runs: 1, isExtra: false, isWicket: false })

    renderScoring(id)
    await waitFor(() => screen.getByText('W'))
    // Should render without crashing with restored state
    expect(screen.getByText(/Team A/)).toBeInTheDocument()
  })
})

// ─── Per-team player count / all-out ────────────────────────────

describe('Scoring - per-team sizes', () => {
  it('backward compat: old match without teamASize still works', async () => {
    // Insert directly without teamASize/teamBSize
    const id = await db.matches.add({
      date: new Date().toISOString(),
      status: 'live',
      teamA: { name: 'Old A', players: ['P1', 'P2', 'P3'] },
      teamB: { name: 'Old B', players: ['P4', 'P5', 'P6'] },
      totalOvers: 6,
      playersPerSide: 3,
      currentInnings: 1,
      result: null,
    })

    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText('W')).toBeInTheDocument()
      // Should render without crashing
      expect(screen.getByText(/Old A/)).toBeInTheDocument()
    })
  })
})

// ─── Defect fixes: undo/edit restore state, odd-runs end-of-over ───

describe('Scoring - undo restores striker/bowler state', () => {
  it('undo after single run restores original striker', async () => {
    const id = await createTestMatch()
    renderScoring(id)

    // Wait for render, tap 1 run (causes strike rotation)
    await waitFor(() => screen.getByText('W'))
    fireEvent.click(screen.getByText('1'))

    // After 1 run: striker should have swapped (Bob* now)
    await waitFor(() => {
      expect(screen.getByText('*Bob')).toBeInTheDocument()
    })

    // Undo the ball
    fireEvent.click(screen.getByText('Undo'))

    // After undo: should be back to Alice* as striker
    await waitFor(() => {
      expect(screen.getByText('*Alice')).toBeInTheDocument()
    })
  })

  it('undo after completing an over restores bowler', async () => {
    const id = await createTestMatch()
    // Pre-load 6 dot balls (completes an over)
    for (let i = 0; i < 6; i++) {
      await addBall({ matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0, runs: 0, isExtra: false, isWicket: false })
    }
    renderScoring(id)

    await waitFor(() => {
      // After 1 complete over, bowler should be Helen (index 1)
      expect(screen.getByText(/Helen/)).toBeInTheDocument()
    })

    // Undo the 6th ball
    fireEvent.click(screen.getByText('Undo'))
    await waitFor(() => {
      // Bowler should be back to George (index 0)
      expect(screen.getByText(/George/)).toBeInTheDocument()
    })
  })
})

describe('Scoring - no-ball credits batsman runs', () => {
  it('no-ball with runs shows correct total in scorebar', async () => {
    const id = await createTestMatch()
    // Add a no-ball where batsman hit 3 + 1 penalty = 4 total
    await addBall({
      matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0,
      runs: 3, isExtra: true, extraType: 'noBall', extraRuns: 1, isWicket: false,
    })
    renderScoring(id)
    await waitFor(() => {
      // Total should be 4 (3 bat + 1 penalty)
      expect(screen.getByText(/4\/0/)).toBeInTheDocument()
    })
  })
})

describe('Scoring - wicket display shows runs', () => {
  it('wicket with runs displays W+runs in over view', async () => {
    const id = await createTestMatch()
    await addBall({
      matchId: id, innings: 1, batsmanIndex: 0, bowlerIndex: 0,
      runs: 2, isExtra: false, isWicket: true, dismissalType: 'run out',
    })
    renderScoring(id)
    await waitFor(() => {
      expect(screen.getByText('W2')).toBeInTheDocument()
    })
  })
})
