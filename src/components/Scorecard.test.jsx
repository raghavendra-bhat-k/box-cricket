import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Scorecard from './Scorecard'
import db, { createMatch, addBall } from '../db'

const onBack = vi.fn()
const onResume = vi.fn()

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  onBack.mockClear()
  onResume.mockClear()
})

async function setupMatch(overrides = {}) {
  const id = await createMatch({
    teamA: 'Tigers',
    teamB: 'Lions',
    totalOvers: 6,
    playersPerSide: 6,
    teamAPlayers: ['Alice', 'Bob'],
    teamBPlayers: ['Charlie', 'Dave'],
    ...overrides,
  })
  // Add some balls
  await addBall({ matchId: id, innings: 1, over: 0, ballInOver: 0, runs: 4, isExtra: false, extraType: null, extraRuns: 0, isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0 })
  await addBall({ matchId: id, innings: 1, over: 0, ballInOver: 1, runs: 6, isExtra: false, extraType: null, extraRuns: 0, isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0 })
  await addBall({ matchId: id, innings: 1, over: 0, ballInOver: 2, runs: 0, isExtra: false, extraType: null, extraRuns: 0, isWicket: true, dismissalType: 'bowled', batsmanIndex: 1, bowlerIndex: 0 })
  return id
}

describe('Scorecard', () => {
  it('renders scorecard with team name and score', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText('Scorecard')).toBeInTheDocument()
      expect(screen.getByText(/Tigers/)).toBeInTheDocument()
      expect(screen.getByText(/10\/1/)).toBeInTheDocument() // 4+6 = 10 runs, 1 wicket
    })
  })

  it('shows batsman table with correct data', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText('Batsman')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  it('shows bowler table', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText('Bowler')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    })
  })

  it('shows extras summary', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText(/Extras:/)).toBeInTheDocument()
    })
  })

  it('shows share buttons', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText('Share on WhatsApp')).toBeInTheDocument()
      expect(screen.getByText('Copy / Share')).toBeInTheDocument()
    })
  })

  it('shows Resume button for live matches', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText('Resume')).toBeInTheDocument()
    })
  })

  it('calls onBack when Home is clicked', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => screen.getByText('Home'))
    fireEvent.click(screen.getByText('Home'))
    expect(onBack).toHaveBeenCalled()
  })

  it('shows result banner for completed match', async () => {
    const id = await setupMatch()
    await db.matches.update(id, { status: 'completed', result: 'Tigers won by 10 runs' })
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText('Tigers won by 10 runs')).toBeInTheDocument()
    })
  })

  it('calls onResume when Resume is clicked', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)
    await waitFor(() => screen.getByText('Resume'))
    fireEvent.click(screen.getByText('Resume'))
    expect(onResume).toHaveBeenCalled()
  })

  it('Share on WhatsApp opens window', async () => {
    const id = await setupMatch()
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => {})
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)
    await waitFor(() => screen.getByText('Share on WhatsApp'))
    fireEvent.click(screen.getByText('Share on WhatsApp'))
    expect(windowOpen).toHaveBeenCalledWith(expect.stringContaining('wa.me'), '_blank')
    windowOpen.mockRestore()
  })

  it('Copy/Share uses clipboard or fallback', async () => {
    const id = await setupMatch()
    // Mock execCommand for fallback (jsdom may not have it)
    document.execCommand = vi.fn().mockReturnValue(true)
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)
    await waitFor(() => screen.getByText('Copy / Share'))
    fireEvent.click(screen.getByText('Copy / Share'))
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    alertMock.mockRestore()
    delete document.execCommand
  })

  it('shows bowler economy in table', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)
    await waitFor(() => {
      expect(screen.getByText('Econ')).toBeInTheDocument()
    })
  })

  it('shows how out for dismissed batsman', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)
    await waitFor(() => {
      expect(screen.getByText('bowled')).toBeInTheDocument()
    })
  })

  it('shows not out for batting batsman', async () => {
    const id = await setupMatch()
    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)
    await waitFor(() => {
      expect(screen.getByText('not out')).toBeInTheDocument()
    })
  })

  it('renders 2nd innings when available', async () => {
    const id = await setupMatch()
    await db.matches.update(id, { currentInnings: 2 })
    await addBall({ matchId: id, innings: 2, over: 0, ballInOver: 0, runs: 3, isExtra: false, extraType: null, extraRuns: 0, isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0 })

    render(<Scorecard matchId={id} onBack={onBack} onResume={onResume} />)

    await waitFor(() => {
      expect(screen.getByText(/Lions/)).toBeInTheDocument()
    })
  })
})
