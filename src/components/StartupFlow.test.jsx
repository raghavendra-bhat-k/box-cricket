import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StartupFlow, { resolveBattingFirst } from './StartupFlow'

const baseMatch = {
  teamA: { name: 'Alpha', players: ['A1', 'A2', 'A3'] },
  teamB: { name: 'Beta', players: ['B1', 'B2', 'B3'] },
  teamASize: 3,
  teamBSize: 3,
  playersPerSide: 3,
  toss: null,
  openingSetup: null,
}

describe('resolveBattingFirst', () => {
  it('bats first when the toss winner chooses to bat', () => {
    expect(resolveBattingFirst('A', 'bat')).toBe('A')
    expect(resolveBattingFirst('B', 'bat')).toBe('B')
  })
  it('the other team bats first when the winner chooses to bowl', () => {
    expect(resolveBattingFirst('A', 'bowl')).toBe('B')
    expect(resolveBattingFirst('B', 'bowl')).toBe('A')
  })
})

describe('StartupFlow - toss', () => {
  it('confirms a toss and reports the derived batting-first team', () => {
    const onToss = vi.fn()
    render(<StartupFlow match={baseMatch} settings={{ toss: true, openingBatsmen: true }} onToss={onToss} onOpenings={vi.fn()} />)
    expect(screen.getByText('Toss')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bowl' }))
    fireEvent.click(screen.getByText('Confirm Toss'))
    expect(onToss).toHaveBeenCalledWith({ wonBy: 'B', decision: 'bowl', battingFirst: 'A' })
  })

  it('disables confirm until both toss answers are chosen', () => {
    render(<StartupFlow match={baseMatch} settings={{ toss: true, openingBatsmen: false }} onToss={vi.fn()} onOpenings={vi.fn()} />)
    expect(screen.getByText('Confirm Toss')).toBeDisabled()
  })
})

describe('StartupFlow - openings', () => {
  const tossedMatch = { ...baseMatch, toss: { wonBy: 'A', decision: 'bat', battingFirst: 'A' } }

  it('walks striker -> non-striker -> bowler and emits the opening setup', () => {
    const onOpenings = vi.fn()
    render(<StartupFlow match={tossedMatch} settings={{ toss: false, openingBatsmen: true }} onToss={vi.fn()} onOpenings={onOpenings} />)
    // Striker step lists the batting roster.
    expect(screen.getByText('Select the striker')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'A1' }))
    // Non-striker step excludes the chosen striker.
    expect(screen.getByText('Select the non-striker')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A1' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'A2' }))
    // Bowler step lists the bowling roster.
    expect(screen.getByText('Select the bowler')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'B1' }))
    expect(onOpenings).toHaveBeenCalledWith(expect.objectContaining({
      openingSetup: { striker: 0, nonStriker: 1, bowlerIndex: 0 },
    }))
  })

  it('lets you type a new batsman name and carries it through', () => {
    const onOpenings = vi.fn()
    const emptyRoster = { ...tossedMatch, teamA: { name: 'Alpha', players: [] } }
    render(<StartupFlow match={emptyRoster} settings={{ toss: false, openingBatsmen: true }} onToss={vi.fn()} onOpenings={onOpenings} />)
    // Type a striker name.
    fireEvent.change(screen.getByPlaceholderText('Or type a name…'), { target: { value: 'Sachin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    // Non-striker (defaults still available as Batsman N options).
    fireEvent.click(screen.getAllByRole('button').find(b => /Batsman/.test(b.textContent)))
    // Bowler
    fireEvent.click(screen.getAllByRole('button').find(b => /Bowler|B1/.test(b.textContent)))
    expect(onOpenings).toHaveBeenCalled()
    const arg = onOpenings.mock.calls[0][0]
    expect(Object.values(arg.names.batting)).toContain('Sachin')
  })

  it('renders nothing once toss and openings are already set', () => {
    const done = { ...baseMatch, toss: { wonBy: 'A', decision: 'bat', battingFirst: 'A' }, openingSetup: { striker: 0, nonStriker: 1, bowlerIndex: 0 } }
    const { container } = render(<StartupFlow match={done} settings={{ toss: true, openingBatsmen: true }} onToss={vi.fn()} onOpenings={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
