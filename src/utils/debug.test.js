import { describe, it, expect, beforeEach, vi } from 'vitest'
import db, { createMatch, createMatchV2, appendAudit, addBall } from '../db'
import { calculateScore } from './scoring'
import {
  DEBUG_FORMAT,
  replayBallsFromAudit,
  buildDebugPayload,
  makeDebugFile,
  exportDebugLog,
} from './debug'

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  await db.auditLog.clear()
})

describe('replayBallsFromAudit', () => {
  it('returns an empty list for no events', () => {
    expect(replayBallsFromAudit()).toEqual([])
  })

  it('ignores non-ball events', () => {
    const events = [
      { action: 'matchCreated', payload: { config: {} } },
      { action: 'tossSet', payload: { toss: {} } },
    ]
    expect(replayBallsFromAudit(events)).toEqual([])
  })

  it('reconstructs the ball list from ballAdded events', () => {
    const events = [
      { action: 'ballAdded', payload: { ball: { uid: 'b1', runs: 4 } } },
      { action: 'ballAdded', payload: { ball: { uid: 'b2', runs: 1 } } },
    ]
    expect(replayBallsFromAudit(events).map(b => b.uid)).toEqual(['b1', 'b2'])
  })

  it('applies undo then redo to reach the same final state', () => {
    const events = [
      { action: 'ballAdded', payload: { ball: { uid: 'b1', runs: 4 } } },
      { action: 'ballAdded', payload: { ball: { uid: 'b2', runs: 2 } } },
      { action: 'undo', payload: {} },
      { action: 'redo', payload: { ball: { uid: 'b2', runs: 2 } } },
    ]
    expect(replayBallsFromAudit(events).map(b => b.uid)).toEqual(['b1', 'b2'])
  })

  it('applies a ballEdited event by matching uid', () => {
    const events = [
      { action: 'ballAdded', payload: { ball: { uid: 'b1', runs: 4 } } },
      { action: 'ballEdited', payload: { ball: { uid: 'b1', runs: 6 } } },
    ]
    expect(replayBallsFromAudit(events)[0].runs).toBe(6)
  })

  it('replayed balls reduce to the same score as the live ball log', () => {
    const balls = [
      { uid: 'b1', runs: 4, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0 },
      { uid: 'b2', runs: 1, isExtra: false, extraRuns: 0, isWicket: false, batsmanIndex: 0, bowlerIndex: 0 },
    ]
    const events = balls.map(ball => ({ action: 'ballAdded', payload: { ball } }))
    const replayed = replayBallsFromAudit(events)
    expect(calculateScore(replayed).runs).toBe(calculateScore(balls).runs)
  })
})

describe('buildDebugPayload', () => {
  it('includes only matches that have an audit log', async () => {
    // A classic match with no audit log.
    await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    // A guided match (records a matchCreated audit event).
    const guidedId = await createMatchV2({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })

    const payload = await buildDebugPayload()
    expect(payload.format).toBe(DEBUG_FORMAT)
    expect(payload.matchCount).toBe(1)
    expect(payload.entries[0].match.id).toBe(guidedId)
    expect(payload.entries[0].auditLog[0].action).toBe('matchCreated')
  })

  it('bundles the match snapshot, balls and audit log for replay', async () => {
    const id = await createMatchV2({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })
    await addBall({ matchId: id, innings: 1, over: 0, ballInOver: 0, runs: 4, isExtra: false, extraType: null, extraRuns: 0, isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0 })
    await appendAudit({ matchId: id, action: 'ballAdded', payload: { ball: { runs: 4 } } })

    const payload = await buildDebugPayload()
    const entry = payload.entries[0]
    expect(entry.balls).toHaveLength(1)
    expect(entry.auditLog.map(e => e.action)).toEqual(['matchCreated', 'ballAdded'])
  })

  it('returns matchCount 0 when nothing has an audit log', async () => {
    await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    const payload = await buildDebugPayload()
    expect(payload.matchCount).toBe(0)
    expect(payload.entries).toEqual([])
  })
})

describe('makeDebugFile', () => {
  it('produces a distinctly-named debug json file', () => {
    const file = makeDebugFile({ exportedAt: '2026-07-09T00:00:00.000Z', entries: [] })
    expect(file.name).toMatch(/^box-cricket-debug-/)
    expect(file.name).toMatch(/\.json$/)
    expect(file.type).toBe('application/json')
  })
})

describe('exportDebugLog', () => {
  it('reports empty when there is nothing to export', async () => {
    await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    const result = await exportDebugLog()
    expect(result.status).toBe('empty')
    expect(result.matchCount).toBe(0)
  })

  it('shares via the native share sheet when available', async () => {
    await createMatchV2({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })
    const originalCanShare = navigator.canShare
    const originalShare = navigator.share
    navigator.canShare = () => true
    navigator.share = vi.fn().mockResolvedValue(undefined)

    const result = await exportDebugLog()
    expect(result.status).toBe('shared')
    expect(navigator.share).toHaveBeenCalled()

    navigator.canShare = originalCanShare
    navigator.share = originalShare
  })

  it('reports cancelled when the native share is aborted', async () => {
    await createMatchV2({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })
    const originalCanShare = navigator.canShare
    const originalShare = navigator.share
    navigator.canShare = () => true
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))

    const result = await exportDebugLog()
    expect(result.status).toBe('cancelled')

    navigator.canShare = originalCanShare
    navigator.share = originalShare
  })

  it('falls back to download when native share fails non-abort', async () => {
    await createMatchV2({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })
    const originalCanShare = navigator.canShare
    const originalShare = navigator.share
    navigator.canShare = () => true
    navigator.share = vi.fn().mockRejectedValue(new Error('boom'))
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:debug')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await exportDebugLog()
    expect(result.status).toBe('downloaded')
    expect(clickSpy).toHaveBeenCalled()

    navigator.canShare = originalCanShare
    navigator.share = originalShare
    createUrl.mockRestore()
    revokeUrl.mockRestore()
    clickSpy.mockRestore()
  })

  it('downloads a file when audit logs exist', async () => {
    await createMatchV2({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })

    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:debug')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const originalCanShare = navigator.canShare
    navigator.canShare = undefined

    const result = await exportDebugLog()
    expect(result.status).toBe('downloaded')
    expect(result.matchCount).toBe(1)
    expect(clickSpy).toHaveBeenCalled()

    navigator.canShare = originalCanShare
    createUrl.mockRestore()
    revokeUrl.mockRestore()
    clickSpy.mockRestore()
  })
})
