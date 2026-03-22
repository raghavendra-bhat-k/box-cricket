import { describe, it, expect } from 'vitest'
import {
  calculateScore,
  formatOvers,
  calculateRR,
  calculateRequiredRR,
  getCurrentOver,
  ballDisplay,
  restoreStateFromBalls,
} from './scoring'

// Helper to create a ball object
function makeBall(overrides = {}) {
  return {
    matchId: 1,
    innings: 1,
    over: 0,
    ballInOver: 0,
    runs: 0,
    isExtra: false,
    extraType: null,
    extraRuns: 0,
    isWicket: false,
    dismissalType: null,
    batsmanIndex: 0,
    bowlerIndex: 0,
    ...overrides,
  }
}

// ─── calculateScore ─────────────────────────────────────────────

describe('calculateScore', () => {
  it('returns zeroes for empty balls array', () => {
    const s = calculateScore([])
    expect(s.runs).toBe(0)
    expect(s.wickets).toBe(0)
    expect(s.legalBalls).toBe(0)
  })

  it('counts normal runs and legal balls', () => {
    const balls = [
      makeBall({ runs: 1 }),
      makeBall({ runs: 4 }),
      makeBall({ runs: 6 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(11)
    expect(s.legalBalls).toBe(3)
    expect(s.wickets).toBe(0)
  })

  it('counts wickets', () => {
    const balls = [
      makeBall({ runs: 0, isWicket: true, dismissalType: 'bowled' }),
      makeBall({ runs: 2, isWicket: true, dismissalType: 'run out' }),
    ]
    const s = calculateScore(balls)
    expect(s.wickets).toBe(2)
    expect(s.runs).toBe(2)
    expect(s.legalBalls).toBe(2)
  })

  it('handles wicket with runs (run out scenario)', () => {
    const balls = [
      makeBall({ runs: 2, isWicket: true, dismissalType: 'run out' }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(2)
    expect(s.wickets).toBe(1)
    expect(s.legalBalls).toBe(1)
    expect(s.batsmen[0].howOut).toBe('run out')
    expect(s.batsmen[0].runs).toBe(2)
  })

  it('wide does not count as legal ball, adds to extras', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'wide', extraRuns: 1 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(1)
    expect(s.legalBalls).toBe(0)
    expect(s.extras.wides).toBe(1)
  })

  it('no-ball does not count as legal ball, adds to extras', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'noBall', extraRuns: 1 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(1)
    expect(s.legalBalls).toBe(0)
    expect(s.extras.noBalls).toBe(1)
  })

  it('bye is a legal ball', () => {
    const balls = [
      makeBall({ runs: 2, isExtra: true, extraType: 'bye', extraRuns: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(2)
    expect(s.legalBalls).toBe(1)
    expect(s.extras.byes).toBe(2)
  })

  it('leg bye is a legal ball', () => {
    const balls = [
      makeBall({ runs: 4, isExtra: true, extraType: 'legBye', extraRuns: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(4)
    expect(s.legalBalls).toBe(1)
    expect(s.extras.legByes).toBe(4)
  })

  it('supports extras with 6+ runs (wide 7)', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'wide', extraRuns: 7 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(7)
    expect(s.extras.wides).toBe(7)
    expect(s.legalBalls).toBe(0)
  })

  it('supports extras with 6+ runs (no-ball 8)', () => {
    // New format: batsman hit 7, penalty 1
    const balls = [
      makeBall({ runs: 7, isExtra: true, extraType: 'noBall', extraRuns: 1 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(8)
    expect(s.extras.noBalls).toBe(1)
  })

  it('backward compat: old no-ball format (runs=0, extraRuns=N)', () => {
    // Old data: all runs in extraRuns
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'noBall', extraRuns: 5 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(5)
    expect(s.extras.noBalls).toBe(5)
  })

  it('tracks batsman stats correctly', () => {
    const balls = [
      makeBall({ runs: 4, batsmanIndex: 0 }),
      makeBall({ runs: 6, batsmanIndex: 0 }),
      makeBall({ runs: 1, batsmanIndex: 1 }),
    ]
    const s = calculateScore(balls)
    expect(s.batsmen[0].runs).toBe(10)
    expect(s.batsmen[0].balls).toBe(2)
    expect(s.batsmen[0].fours).toBe(1)
    expect(s.batsmen[0].sixes).toBe(1)
    expect(s.batsmen[1].runs).toBe(1)
    expect(s.batsmen[1].balls).toBe(1)
  })

  it('batsman does not get credited runs on wide', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'wide', extraRuns: 1, batsmanIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.batsmen[0].runs).toBe(0)
    expect(s.batsmen[0].balls).toBe(0) // wide doesn't count as ball faced
  })

  it('tracks bowler stats correctly', () => {
    const balls = [
      makeBall({ runs: 4, bowlerIndex: 0 }),
      makeBall({ runs: 0, isWicket: true, dismissalType: 'bowled', bowlerIndex: 0 }),
      makeBall({ runs: 0, isExtra: true, extraType: 'wide', extraRuns: 1, bowlerIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.bowlers[0].runs).toBe(5)
    expect(s.bowlers[0].balls).toBe(2) // wide doesn't count
    expect(s.bowlers[0].wickets).toBe(1)
  })

  it('calculates overs and ballsInOver', () => {
    const balls = Array.from({ length: 8 }, (_, i) => makeBall({ runs: 1 }))
    const s = calculateScore(balls)
    expect(s.overs).toBe(1)
    expect(s.ballsInOver).toBe(2)
    expect(s.legalBalls).toBe(8)
  })

  it('batsman gets credited runs on no-ball', () => {
    // New format: batsman hit 3, penalty 1, total 4
    const balls = [
      makeBall({ runs: 3, isExtra: true, extraType: 'noBall', extraRuns: 1, batsmanIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.batsmen[0].runs).toBe(3)
    expect(s.batsmen[0].balls).toBe(1)
    expect(s.extras.noBalls).toBe(1)
    expect(s.runs).toBe(4) // 3 batsman + 1 penalty
  })

  it('no-ball boundary credited to batsman fours/sixes', () => {
    const balls = [
      makeBall({ runs: 4, isExtra: true, extraType: 'noBall', extraRuns: 1, batsmanIndex: 0 }),
      makeBall({ runs: 6, isExtra: true, extraType: 'noBall', extraRuns: 1, batsmanIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.batsmen[0].fours).toBe(1)
    expect(s.batsmen[0].sixes).toBe(1)
    expect(s.batsmen[0].runs).toBe(10)
  })

  it('batsman fours and sixes not counted on extras', () => {
    const balls = [
      makeBall({ runs: 4, isExtra: true, extraType: 'bye', batsmanIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.batsmen[0].fours).toBe(0) // bye 4 doesn't count as batsman four
  })

  it('bowler stats: wide does not count as legal delivery', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'wide', extraRuns: 2, bowlerIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.bowlers[0].balls).toBe(0)
    expect(s.bowlers[0].runs).toBe(2)
  })

  it('bowler stats: no-ball does not count as legal delivery', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'noBall', extraRuns: 1, bowlerIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.bowlers[0].balls).toBe(0)
    expect(s.bowlers[0].runs).toBe(1)
  })

  it('bowler stats: bye counts as legal delivery', () => {
    const balls = [
      makeBall({ runs: 2, isExtra: true, extraType: 'bye', bowlerIndex: 0 }),
    ]
    const s = calculateScore(balls)
    expect(s.bowlers[0].balls).toBe(1)
  })

  it('handles ball with no batsmanIndex/bowlerIndex', () => {
    const balls = [{ runs: 3, isExtra: false, extraRuns: 0, isWicket: false }]
    const s = calculateScore(balls)
    expect(s.runs).toBe(3)
    expect(s.legalBalls).toBe(1)
    expect(Object.keys(s.batsmen)).toHaveLength(0)
    expect(Object.keys(s.bowlers)).toHaveLength(0)
  })

  it('complete over calculation', () => {
    const balls = Array.from({ length: 6 }, () => makeBall({ runs: 2 }))
    const s = calculateScore(balls)
    expect(s.overs).toBe(1)
    expect(s.ballsInOver).toBe(0)
  })
})

// ─── formatOvers ────────────────────────────────────────────────

describe('formatOvers', () => {
  it('formats zero balls', () => {
    expect(formatOvers(0)).toBe('0.0')
  })

  it('formats partial over', () => {
    expect(formatOvers(3)).toBe('0.3')
  })

  it('formats complete overs', () => {
    expect(formatOvers(12)).toBe('2.0')
  })

  it('formats overs with remainder', () => {
    expect(formatOvers(15)).toBe('2.3')
  })
})

// ─── calculateRR ────────────────────────────────────────────────

describe('calculateRR', () => {
  it('returns 0.00 for zero balls', () => {
    expect(calculateRR(10, 0)).toBe('0.00')
  })

  it('calculates run rate correctly', () => {
    // 36 runs off 18 balls = 36 / 3 overs = 12.00
    expect(calculateRR(36, 18)).toBe('12.00')
  })

  it('calculates fractional run rate', () => {
    // 10 runs off 6 balls = 10 / 1 = 10.00
    expect(calculateRR(10, 6)).toBe('10.00')
  })
})

// ─── calculateRequiredRR ────────────────────────────────────────

describe('calculateRequiredRR', () => {
  it('returns dash when no balls remaining', () => {
    expect(calculateRequiredRR(100, 50, 30, 5)).toBe('-')
  })

  it('calculates required run rate', () => {
    // Need 60 runs, scored 0, 0 balls bowled, 5 overs total
    // 60 / 5 = 12.00
    expect(calculateRequiredRR(60, 0, 0, 5)).toBe('12.00')
  })

  it('adjusts for balls already bowled', () => {
    // Need 100, scored 40, 12 balls (2 overs) bowled, 5 total overs
    // remaining = 60 runs in 3 overs = 20.00
    expect(calculateRequiredRR(100, 40, 12, 5)).toBe('20.00')
  })
})

// ─── getCurrentOver ─────────────────────────────────────────────

describe('getCurrentOver', () => {
  it('returns empty array for no balls', () => {
    expect(getCurrentOver([])).toEqual([])
  })

  it('returns all balls when less than 6 legal deliveries', () => {
    const balls = [
      makeBall({ runs: 1 }),
      makeBall({ runs: 2 }),
    ]
    expect(getCurrentOver(balls)).toHaveLength(2)
  })

  it('returns only current over balls after complete over', () => {
    const balls = [
      ...Array.from({ length: 6 }, () => makeBall({ runs: 1 })),
      makeBall({ runs: 4 }),
    ]
    const current = getCurrentOver(balls)
    expect(current).toHaveLength(1)
    expect(current[0].runs).toBe(4)
  })

  it('includes extras (wides) in current over without counting as legal', () => {
    const balls = [
      ...Array.from({ length: 6 }, () => makeBall({ runs: 1 })),
      makeBall({ runs: 0, isExtra: true, extraType: 'wide', extraRuns: 1 }),
      makeBall({ runs: 2 }),
    ]
    const current = getCurrentOver(balls)
    expect(current).toHaveLength(2) // wide + 2-run ball
  })
})

// ─── ballDisplay ────────────────────────────────────────────────

describe('ballDisplay', () => {
  it('shows W for wicket', () => {
    expect(ballDisplay(makeBall({ isWicket: true }))).toBe('W')
  })

  it('shows dot for 0 runs', () => {
    expect(ballDisplay(makeBall({ runs: 0 }))).toBe('.')
  })

  it('shows run number', () => {
    expect(ballDisplay(makeBall({ runs: 4 }))).toBe('4')
  })

  it('shows wide with runs', () => {
    expect(ballDisplay(makeBall({ isExtra: true, extraType: 'wide', runs: 0, extraRuns: 1 }))).toBe('Wd1')
  })

  it('shows no-ball with runs', () => {
    expect(ballDisplay(makeBall({ isExtra: true, extraType: 'noBall', runs: 0, extraRuns: 2 }))).toBe('Nb2')
  })

  it('shows bye', () => {
    expect(ballDisplay(makeBall({ isExtra: true, extraType: 'bye', runs: 2, extraRuns: 0 }))).toBe('B2')
  })

  it('shows leg bye', () => {
    expect(ballDisplay(makeBall({ isExtra: true, extraType: 'legBye', runs: 4, extraRuns: 0 }))).toBe('Lb4')
  })

  it('shows wide with 7+ runs', () => {
    expect(ballDisplay(makeBall({ isExtra: true, extraType: 'wide', runs: 0, extraRuns: 7 }))).toBe('Wd7')
  })

  it('wicket with 0 runs shows W', () => {
    expect(ballDisplay(makeBall({ runs: 0, isWicket: true, dismissalType: 'bowled' }))).toBe('W')
  })

  it('wicket with runs shows W plus runs', () => {
    expect(ballDisplay(makeBall({ runs: 2, isWicket: true, dismissalType: 'run out' }))).toBe('W2')
  })
})

// ─── restoreStateFromBalls ──────────────────────────────────────

describe('restoreStateFromBalls', () => {
  it('returns initial state for empty balls', () => {
    const state = restoreStateFromBalls([])
    expect(state).toEqual({ striker: 0, nonStriker: 1, bowlerIdx: 0 })
  })

  it('swaps strike on odd runs', () => {
    const balls = [makeBall({ runs: 1 })]
    const state = restoreStateFromBalls(balls)
    expect(state.striker).toBe(1) // swapped
    expect(state.nonStriker).toBe(0)
  })

  it('does not swap strike on even runs', () => {
    const balls = [makeBall({ runs: 2 })]
    const state = restoreStateFromBalls(balls)
    expect(state.striker).toBe(0)
    expect(state.nonStriker).toBe(1)
  })

  it('brings in new batsman on wicket', () => {
    const balls = [makeBall({ runs: 0, isWicket: true, dismissalType: 'bowled' })]
    const state = restoreStateFromBalls(balls)
    expect(state.striker).toBe(2) // next batsman
    expect(state.nonStriker).toBe(1)
  })

  it('increments bowler at end of over', () => {
    // 6 dot balls = end of over
    const balls = Array.from({ length: 6 }, () => makeBall({ runs: 0 }))
    const state = restoreStateFromBalls(balls)
    expect(state.bowlerIdx).toBe(1) // next bowler
  })

  it('swaps strike at end of over (even runs over)', () => {
    // 6 dot balls: end of over swaps strike
    const balls = Array.from({ length: 6 }, () => makeBall({ runs: 0 }))
    const state = restoreStateFromBalls(balls)
    // After 6 dots: no mid-ball swaps, then end-of-over swap
    expect(state.striker).toBe(1)
    expect(state.nonStriker).toBe(0)
  })

  it('handles wide (no legal ball count)', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'wide', extraRuns: 1 }),
    ]
    const state = restoreStateFromBalls(balls)
    // Wide with 1 run = odd, swaps strike
    expect(state.striker).toBe(1)
    expect(state.nonStriker).toBe(0)
    expect(state.bowlerIdx).toBe(0) // not a legal ball, no over change
  })

  it('handles no-ball (no legal ball count)', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'noBall', extraRuns: 1 }),
    ]
    const state = restoreStateFromBalls(balls)
    expect(state.bowlerIdx).toBe(0) // not a legal ball
  })

  it('handles two complete overs correctly', () => {
    // Over 1: 6 dots, Over 2: 6 dots
    const balls = Array.from({ length: 12 }, () => makeBall({ runs: 0 }))
    const state = restoreStateFromBalls(balls)
    expect(state.bowlerIdx).toBe(2) // two bowler changes
    // Two end-of-over swaps cancel out
    expect(state.striker).toBe(0)
    expect(state.nonStriker).toBe(1)
  })

  it('handles mixed scenario: runs + wicket + over end', () => {
    const balls = [
      makeBall({ runs: 1 }),                                                    // swap: s=1, ns=0
      makeBall({ runs: 4 }),                                                    // no swap
      makeBall({ runs: 0, isWicket: true, dismissalType: 'bowled' }),           // new bat s=2, ns=0
      makeBall({ runs: 2 }),                                                    // no swap
      makeBall({ runs: 0 }),                                                    // no swap
      makeBall({ runs: 1 }),                                                    // swap: s=0, ns=2, then end-of-over swap back: s=2, ns=0
    ]
    const state = restoreStateFromBalls(balls)
    expect(state.bowlerIdx).toBe(1) // end of first over
  })

  it('handles wicket with runs (run out)', () => {
    const balls = [
      makeBall({ runs: 2, isWicket: true, dismissalType: 'run out' }),
    ]
    const state = restoreStateFromBalls(balls)
    // Wicket: new batsman at striker. runs=2 (even) so no mid-ball swap before wicket check
    // But the code does swap first for odd, then wicket. 2 is even, no swap.
    // Wicket: s = max(0,1)+1 = 2
    expect(state.striker).toBe(2)
    expect(state.nonStriker).toBe(1)
  })

  it('odd runs on last ball of over cancels out (swap + end-of-over swap)', () => {
    // 5 dots + 1 single = end of over
    // Single swaps strike, then end-of-over swaps back
    const balls = [
      ...Array.from({ length: 5 }, () => makeBall({ runs: 0 })),
      makeBall({ runs: 1 }),
    ]
    const state = restoreStateFromBalls(balls)
    // Odd run swap: s=1,ns=0, then end-of-over swap: s=0,ns=1 — back to original
    expect(state.striker).toBe(0)
    expect(state.nonStriker).toBe(1)
    expect(state.bowlerIdx).toBe(1)
  })

  it('restores correctly after 1.3 overs (9 legal balls)', () => {
    // Simulating: 1 over (6 balls) + 3 more balls
    const balls = [
      ...Array.from({ length: 6 }, () => makeBall({ runs: 0 })), // over 1 done
      makeBall({ runs: 1 }), // ball 7: swap
      makeBall({ runs: 0 }), // ball 8
      makeBall({ runs: 0 }), // ball 9
    ]
    const state = restoreStateFromBalls(balls)
    expect(state.bowlerIdx).toBe(1) // 1 over completed = 1 bowler change
  })
})
