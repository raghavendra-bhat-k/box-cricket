import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BallLog from './BallLog'

const match = {
  teamA: { name: 'Tigers', players: ['Alice', 'Bob'] },
  teamB: { name: 'Lions', players: ['Charlie'] },
}

describe('BallLog', () => {
  it('shows ball-wise score with cumulative totals', () => {
    render(
      <BallLog
        match={match}
        inningsBalls={{
          1: [
            { uid: 'b1', innings: 1, runs: 4, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0 },
            { uid: 'b2', innings: 1, runs: 0, isExtra: false, extraRuns: 0, isWicket: true, dismissalType: 'bowled', batsmanIndex: 1, bowlerIndex: 0 },
          ],
        }}
      />
    )

    expect(screen.getByText('Tigers innings')).toBeInTheDocument()
    expect(screen.getByText('0.1')).toBeInTheDocument()
    expect(screen.getByText('4/0')).toBeInTheDocument()
    expect(screen.getByText('4/1')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getAllByText('Charlie')).toHaveLength(2)
  })

  it('shows an empty state when there are no deliveries', () => {
    render(<BallLog match={match} inningsBalls={{ 1: [], 2: [] }} />)

    expect(screen.getByText('No deliveries recorded yet.')).toBeInTheDocument()
  })
})
