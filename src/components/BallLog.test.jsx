import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BallLog from './BallLog'
import tournamentExport from '../test/fixtures/tournament-export.json'

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

  it('adds an end-of-over summary line with the cumulative score', () => {
    // One full over: 3 + wide(1) + 4 + 0 + 6 + 1(wicket... no, keep simple) = mix
    const overBalls = [
      { uid: 'o1', innings: 1, runs: 3, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0, bowlerName: 'Sachin' },
      { uid: 'o2', innings: 1, runs: 0, extraRuns: 1, isExtra: true, extraType: 'wide', isWicket: false, batsmanIndex: 0, bowlerIndex: 0, bowlerName: 'Sachin' },
      { uid: 'o3', innings: 1, runs: 4, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0, bowlerName: 'Sachin' },
      { uid: 'o4', innings: 1, runs: 0, isExtra: false, extraRuns: 0, isWicket: true, dismissalType: 'bowled', batsmanIndex: 0, bowlerIndex: 0, bowlerName: 'Sachin' },
      { uid: 'o5', innings: 1, runs: 6, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 1, bowlerIndex: 0, bowlerName: 'Sachin' },
      { uid: 'o6', innings: 1, runs: 1, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 1, bowlerIndex: 0, bowlerName: 'Sachin' },
      { uid: 'o7', innings: 1, runs: 0, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0, bowlerName: 'Sachin' },
    ]
    render(<BallLog match={match} inningsBalls={{ 1: overBalls, 2: [] }} />)

    // Summary appears once after the 6th legal ball (the trailing 7th ball has no summary).
    const overLine = screen.getByText('End of Over 1').closest('.ball-log-over')
    expect(overLine).toBeInTheDocument()
    // 6 legal balls: 3 + 1(wide) + 4 + 0 + 6 + 1 = 15 runs, 1 wicket at end of over.
    expect(overLine.textContent).toMatch(/\+15 runs/)
    expect(overLine.textContent).toMatch(/1 wkt/)
    expect(overLine.textContent).toMatch(/15\/1/)
    expect(overLine.textContent).toMatch(/Sachin/)
  })

  it('does not add an over summary for an incomplete over', () => {
    render(
      <BallLog
        match={match}
        inningsBalls={{
          1: [
            { uid: 'p1', innings: 1, runs: 4, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0 },
            { uid: 'p2', innings: 1, runs: 1, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0 },
          ],
        }}
      />
    )
    expect(screen.queryByText(/End of Over/)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no deliveries', () => {
    render(<BallLog match={match} inningsBalls={{ 1: [], 2: [] }} />)

    expect(screen.getByText('No deliveries recorded yet.')).toBeInTheDocument()
  })

  it('resolves the bowler from bowlingOrder, not the batting roster', () => {
    // teamB.bowlingOrder[0]='Sachin' while teamB.players[0]='Adarsha'. A ball with
    // an explicit bowlerName must show that name over both.
    const boMatch = {
      teamA: { name: 'Bat', players: ['Amar'] },
      teamB: { name: 'Bowl', players: ['Adarsha', 'Nikhil'], bowlingOrder: ['Sachin', 'Nikhil'] },
    }
    render(
      <BallLog
        match={boMatch}
        inningsBalls={{
          1: [
            { uid: 'x1', innings: 1, runs: 6, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0, bowlerName: 'Sachin' },
          ],
        }}
      />
    )

    expect(screen.getByText('Sachin')).toBeInTheDocument()
    expect(screen.queryByText('Adarsha')).not.toBeInTheDocument()
  })

  it('resolves the bowler from bowlingOrder for real exported data (bowlerName stripped)', () => {
    // The tournament export drops bowlerName; over 1 (bowlerIndex 0) must still show
    // Sachin (bowlingOrder[0]), not Adarsha (players[0]); over 2 shows Nikhil.
    const exportedMatch = tournamentExport.matches[0]
    const innings1 = tournamentExport.balls.filter(b => b.innings === 1)
    // Sanity: the fixture genuinely has no bowlerName so this exercises the fallback.
    expect(innings1.some(b => b.bowlerName !== undefined)).toBe(false)

    render(<BallLog match={exportedMatch} inningsBalls={{ 1: innings1, 2: [] }} />)

    expect(screen.getAllByText('Sachin').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nikhil').length).toBeGreaterThan(0)
    // "Adarsha" is players[0] of the bowling team — it must never surface as a bowler.
    expect(screen.queryByText('Adarsha')).not.toBeInTheDocument()
  })

  it('falls back to players when neither bowlerName nor bowlingOrder is present (legacy)', () => {
    const legacyMatch = {
      teamA: { name: 'Bat', players: ['Amar'] },
      teamB: { name: 'Bowl', players: ['Adarsha'] },
    }
    render(
      <BallLog
        match={legacyMatch}
        inningsBalls={{
          1: [{ uid: 'l1', innings: 1, runs: 1, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0 }],
        }}
      />
    )

    expect(screen.getByText('Adarsha')).toBeInTheDocument()
  })
})
