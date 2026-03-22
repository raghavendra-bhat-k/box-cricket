import { describe, it, expect } from 'vitest'
import {
  calculateScore,
  formatOvers,
  calculateRR,
  calculateRequiredRR,
  getCurrentOver,
  ballDisplay,
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
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'noBall', extraRuns: 8 }),
    ]
    const s = calculateScore(balls)
    expect(s.runs).toBe(8)
    expect(s.extras.noBalls).toBe(8)
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

  it('batsman gets credited runs on no-ball faced (not extra runs)', () => {
    const balls = [
      makeBall({ runs: 0, isExtra: true, extraType: 'noBall', extraRuns: 1, batsmanIndex: 0 }),
    ]
    const s = calculateScore(balls)
    // On no-ball, batsman faces but doesn't get credited runs (runs=0)
    expect(s.batsmen[0].runs).toBe(0)
    expect(s.batsmen[0].balls).toBe(1) // no-ball counts as ball faced
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

  it('wicket takes priority in display', () => {
    // A ball that is both wicket and has runs should show W
    expect(ballDisplay(makeBall({ runs: 2, isWicket: true, dismissalType: 'run out' }))).toBe('W')
  })
})
