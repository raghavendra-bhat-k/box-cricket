import { describe, it, expect } from 'vitest'
import { needsBowlerAtBoundary, currentInPlayStep } from './matchFlow'

describe('needsBowlerAtBoundary', () => {
  it('is false when the feature is off', () => {
    expect(needsBowlerAtBoundary({ legalBalls: 6, forceBowlerEachOver: false, ackOver: null })).toBe(false)
  })
  it('is false mid-over', () => {
    expect(needsBowlerAtBoundary({ legalBalls: 4, forceBowlerEachOver: true, ackOver: null })).toBe(false)
  })
  it('is false at the very start (no ball bowled)', () => {
    expect(needsBowlerAtBoundary({ legalBalls: 0, forceBowlerEachOver: true, ackOver: null })).toBe(false)
  })
  it('is true at an over boundary that has not been acknowledged', () => {
    expect(needsBowlerAtBoundary({ legalBalls: 6, forceBowlerEachOver: true, ackOver: null })).toBe(true)
    expect(needsBowlerAtBoundary({ legalBalls: 12, forceBowlerEachOver: true, ackOver: 1 })).toBe(true)
  })
  it('is false once the upcoming over has been acknowledged', () => {
    expect(needsBowlerAtBoundary({ legalBalls: 6, forceBowlerEachOver: true, ackOver: 1 })).toBe(false)
  })
})

describe('currentInPlayStep', () => {
  it('prioritises the wicket entry', () => {
    expect(currentInPlayStep({ wicketFlow: true, pendingNewBatsman: { x: 1 }, needBowler: true })).toBe('wicket')
  })
  it('then the incoming batsman', () => {
    expect(currentInPlayStep({ wicketFlow: false, pendingNewBatsman: { x: 1 }, needBowler: true })).toBe('newBatsman')
  })
  it('then the new bowler', () => {
    expect(currentInPlayStep({ wicketFlow: false, pendingNewBatsman: null, needBowler: true })).toBe('bowler')
  })
  it('returns null when nothing is pending', () => {
    expect(currentInPlayStep({ wicketFlow: false, pendingNewBatsman: null, needBowler: false })).toBe(null)
  })
})
