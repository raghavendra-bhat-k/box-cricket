import { describe, it, expect, beforeEach } from 'vitest'
import db, {
  createMatch,
  createMatchV2,
  getMatch,
  appendAudit,
  getAuditLog,
  deleteAuditLog,
  deleteMatch,
} from './db'

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  await db.auditLog.clear()
})

describe('v2 match fields', () => {
  it('defaults appVersion/toss/openingSetup for classic matches', async () => {
    const id = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    const m = await getMatch(id)
    expect(m.appVersion).toBe(1)
    expect(m.toss).toBeNull()
    expect(m.openingSetup).toBeNull()
  })

  it('createMatchV2 stamps appVersion 2', async () => {
    const id = await createMatchV2({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    const m = await getMatch(id)
    expect(m.appVersion).toBe(2)
  })

  it('createMatchV2 records a matchCreated audit event', async () => {
    const id = await createMatchV2({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    const log = await getAuditLog(id)
    expect(log).toHaveLength(1)
    expect(log[0].action).toBe('matchCreated')
    expect(log[0].seq).toBe(0)
  })
})

describe('audit log', () => {
  it('appends events with per-match increasing seq', async () => {
    const id = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    await appendAudit({ matchId: id, action: 'ballAdded', payload: { runs: 1 } })
    await appendAudit({ matchId: id, action: 'ballAdded', payload: { runs: 4 } })
    const log = await getAuditLog(id)
    expect(log.map(e => e.seq)).toEqual([0, 1])
    expect(log.map(e => e.action)).toEqual(['ballAdded', 'ballAdded'])
  })

  it('scopes seq numbering per match', async () => {
    const a = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    const b = await createMatch({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })
    await appendAudit({ matchId: a, action: 'ballAdded' })
    await appendAudit({ matchId: b, action: 'ballAdded' })
    expect((await getAuditLog(a))[0].seq).toBe(0)
    expect((await getAuditLog(b))[0].seq).toBe(0)
  })

  it('returns events ordered by seq', async () => {
    const id = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    for (let i = 0; i < 5; i++) await appendAudit({ matchId: id, action: `step-${i}` })
    const log = await getAuditLog(id)
    expect(log.map(e => e.action)).toEqual(['step-0', 'step-1', 'step-2', 'step-3', 'step-4'])
  })

  it('deleteAuditLog removes only that match log', async () => {
    const a = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    const b = await createMatch({ teamA: 'C', teamB: 'D', totalOvers: 6, playersPerSide: 6 })
    await appendAudit({ matchId: a, action: 'x' })
    await appendAudit({ matchId: b, action: 'y' })
    await deleteAuditLog(a)
    expect(await getAuditLog(a)).toHaveLength(0)
    expect(await getAuditLog(b)).toHaveLength(1)
  })

  it('deleteMatch also clears its audit log', async () => {
    const id = await createMatchV2({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    await appendAudit({ matchId: id, action: 'ballAdded' })
    await deleteMatch(id)
    expect(await getAuditLog(id)).toHaveLength(0)
  })
})
