import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewMatch from './NewMatch'
import db from '../db'

let onBack, onStart

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  onBack = vi.fn()
  onStart = vi.fn()
})

describe('NewMatch - form basics', () => {
  it('disables Start Match when team names empty', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    const startBtn = screen.getByText('Start Match')
    expect(startBtn).toBeDisabled()
  })

  it('enables Start Match when both teams entered', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    const inputs = screen.getAllByPlaceholderText('Team name')
    fireEvent.change(inputs[0], { target: { value: 'A' } })
    fireEvent.change(inputs[1], { target: { value: 'B' } })
    expect(screen.getByText('Start Match')).not.toBeDisabled()
  })

  it('creates match on Start Match click', async () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    const inputs = screen.getAllByPlaceholderText('Team name')
    fireEvent.change(inputs[0], { target: { value: 'Team X' } })
    fireEvent.change(inputs[1], { target: { value: 'Team Y' } })
    fireEvent.click(screen.getByText('Start Match'))
    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith(expect.any(Number))
    })
  })

  it('toggle player names shows and hides inputs', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    fireEvent.click(screen.getByText('Add Player Names (Optional)'))
    expect(screen.getByText('Hide Player Names')).toBeInTheDocument()
    // Should show player inputs (6 per side default)
    const playerInputs = screen.getAllByPlaceholderText(/Player \d+/)
    expect(playerInputs.length).toBe(12) // 6 + 6
  })

  it('player name inputs can be edited', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    fireEvent.click(screen.getByText('Add Player Names (Optional)'))
    const playerInputs = screen.getAllByPlaceholderText(/Player \d+/)
    fireEvent.change(playerInputs[0], { target: { value: 'Alice' } })
    expect(playerInputs[0].value).toBe('Alice')
  })

  it('toggle custom rules shows rules table', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    fireEvent.click(screen.getByText('Custom Scoring Rules (Optional)'))
    expect(screen.getByText('Hide Custom Rules')).toBeInTheDocument()
    expect(screen.getByText('Button')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Records as')).toBeInTheDocument()
  })

  it('calls onBack when back button clicked', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    const backBtn = document.querySelector('.back-btn')
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalled()
  })

  it('changes overs and players per side', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    const numberInputs = screen.getAllByDisplayValue('6')
    // First is overs, second is players per side
    fireEvent.change(numberInputs[0], { target: { value: '10' } })
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })
})

describe('NewMatch - rematch pre-fill', () => {
  it('renders empty form when no rematchFrom', () => {
    render(<NewMatch onBack={onBack} onStart={onStart} />)
    const inputs = screen.getAllByPlaceholderText('Team name')
    expect(inputs).toHaveLength(2)
    expect(inputs[0].value).toBe('')
    expect(inputs[1].value).toBe('')
  })

  it('pre-fills team names from rematchFrom', () => {
    const rematch = {
      teamA: { name: 'Tigers', players: ['Alice', 'Bob'] },
      teamB: { name: 'Lions', players: ['Charlie', 'Dave'] },
      totalOvers: 8,
      playersPerSide: 4,
      rules: null,
    }
    render(<NewMatch onBack={onBack} onStart={onStart} rematchFrom={rematch} />)

    const inputs = screen.getAllByDisplayValue(/Tigers|Lions/)
    expect(inputs).toHaveLength(2)
  })

  it('pre-fills overs and players per side', () => {
    const rematch = {
      teamA: { name: 'A', players: [] },
      teamB: { name: 'B', players: [] },
      totalOvers: 8,
      playersPerSide: 5,
    }
    render(<NewMatch onBack={onBack} onStart={onStart} rematchFrom={rematch} />)

    expect(screen.getByDisplayValue('8')).toBeInTheDocument() // overs
    expect(screen.getByDisplayValue('5')).toBeInTheDocument() // players
  })

  it('shows player names section when rematch has players', () => {
    const rematch = {
      teamA: { name: 'A', players: ['P1', 'P2'] },
      teamB: { name: 'B', players: ['P3', 'P4'] },
      totalOvers: 6,
      playersPerSide: 4,
    }
    render(<NewMatch onBack={onBack} onStart={onStart} rematchFrom={rematch} />)

    // Player names section should be visible since rematch has players
    expect(screen.getByDisplayValue('P1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('P2')).toBeInTheDocument()
    expect(screen.getByDisplayValue('P3')).toBeInTheDocument()
  })

  it('pre-fills custom rules from rematch', () => {
    const rematch = {
      teamA: { name: 'A', players: [] },
      teamB: { name: 'B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      rules: { runMap: { 1: 2 }, disabledRuns: [3] },
    }
    render(<NewMatch onBack={onBack} onStart={onStart} rematchFrom={rematch} />)

    // Rules section should be visible
    expect(screen.getByText('Hide Custom Rules')).toBeInTheDocument()
  })
})
