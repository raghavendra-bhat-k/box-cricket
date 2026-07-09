import { describe, it, expect, beforeEach, vi } from 'vitest'
import db, { addBall, createMatch, getAllMatches, getBalls, getDayKey } from '../db'
import {
  applySyncImport,
  exportDayPayload,
  exportMatchPayload,
  exportTournamentPayload,
  getSyncFileName,
  getPayloadSummary,
  parseSyncPayload,
  shareOrDownloadPayload,
} from './sync'

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
})

async function createScoredMatch(overrides = {}) {
  const id = await createMatch({
    teamA: 'Tigers',
    teamB: 'Lions',
    totalOvers: 6,
    playersPerSide: 6,
    tournamentName: 'Summer Cup',
    ...overrides,
  })
  await addBall({
    matchId: id,
    innings: 1,
    over: 0,
    ballInOver: 0,
    runs: 4,
    isExtra: false,
    extraType: null,
    extraRuns: 0,
    isWicket: false,
    dismissalType: null,
    batsmanIndex: 0,
    bowlerIndex: 0,
  })
  return id
}

describe('JSON sync utilities', () => {
  it('exports one match with stable match and ball identifiers', async () => {
    const id = await createScoredMatch()
    const payload = await exportMatchPayload(id)

    expect(payload.format).toBe('box-cricket-json-sync')
    expect(payload.scope).toBe('match')
    expect(payload.matches).toHaveLength(1)
    expect(payload.balls).toHaveLength(1)
    expect(payload.matches[0].syncId).toEqual(expect.stringMatching(/^match_/))
    expect(payload.balls[0].uid).toEqual(expect.stringMatching(/^ball_/))
    expect(payload.balls[0].matchSyncId).toBe(payload.matches[0].syncId)
  })

  it('preserves bowlerName through export so bowler identity survives handoff', async () => {
    const id = await createMatch({
      teamA: 'Tigers',
      teamB: 'Lions',
      totalOvers: 6,
      playersPerSide: 6,
    })
    await addBall({
      matchId: id,
      innings: 1,
      over: 0,
      ballInOver: 0,
      runs: 6,
      isExtra: false,
      extraType: null,
      extraRuns: 0,
      isWicket: false,
      dismissalType: null,
      batsmanIndex: 0,
      bowlerIndex: 0,
      bowlerName: 'Sachin',
    })
    const payload = await exportMatchPayload(id)
    expect(payload.balls[0].bowlerName).toBe('Sachin')
  })

  it('preserves outBatsmanIndex and newBatsmanIndex through export', async () => {
    const id = await createMatch({ teamA: 'Tigers', teamB: 'Lions', totalOvers: 6, playersPerSide: 6 })
    await addBall({
      matchId: id, innings: 1, over: 0, ballInOver: 0, runs: 0,
      isExtra: false, extraType: null, extraRuns: 0,
      isWicket: true, dismissalType: 'run out',
      batsmanIndex: 0, outBatsmanIndex: 1, newBatsmanIndex: 4, bowlerIndex: 0,
    })
    const payload = await exportMatchPayload(id)
    expect(payload.balls[0].outBatsmanIndex).toBe(1)
    expect(payload.balls[0].newBatsmanIndex).toBe(4)
  })

  it('exports only matches for the requested day', async () => {
    await createScoredMatch({ teamA: 'Today A', teamB: 'Today B' })
    const oldId = await createScoredMatch({ teamA: 'Old A', teamB: 'Old B' })
    await db.matches.update(oldId, { date: '2024-01-01T10:00:00.000Z', dayKey: getDayKey('2024-01-01T10:00:00.000Z') })

    const payload = await exportDayPayload(getDayKey(new Date().toISOString()))

    expect(payload.scope).toBe('day')
    expect(payload.matches).toHaveLength(1)
    expect(payload.matches[0].teamA.name).toBe('Today A')
  })

  it('exports only matches with the requested tournament name', async () => {
    await createScoredMatch({ teamA: 'Cup A', teamB: 'Cup B', tournamentName: 'Summer Cup' })
    await createScoredMatch({ teamA: 'Casual A', teamB: 'Casual B', tournamentName: '' })

    const payload = await exportTournamentPayload('Summer Cup')

    expect(payload.scope).toBe('tournament')
    expect(payload.matches).toHaveLength(1)
    expect(payload.matches[0].tournamentName).toBe('Summer Cup')
  })

  it('imports a new match preserving sync identity for handoff', async () => {
    const sourceId = await createScoredMatch()
    const payload = await exportMatchPayload(sourceId)
    await db.balls.clear()
    await db.matches.clear()

    const result = await applySyncImport(payload, { [payload.matches[0].syncId]: 'import' })
    const matches = await getAllMatches()
    const balls = await getBalls(result.imported[0].localMatchId, 1)

    expect(matches).toHaveLength(1)
    expect(matches[0].syncId).toBe(payload.matches[0].syncId)
    expect(matches[0].sourceSyncId).toBeUndefined()
    expect(balls).toHaveLength(1)
    expect(balls[0].runs).toBe(4)
  })

  it('imports a deliberate copy with a new sync id and sourceSyncId', async () => {
    const sourceId = await createScoredMatch()
    const payload = await exportMatchPayload(sourceId)

    const result = await applySyncImport(payload, { [payload.matches[0].syncId]: 'copy' })
    const copied = await db.matches.get(result.imported[0].localMatchId)

    expect(copied.syncId).not.toBe(payload.matches[0].syncId)
    expect(copied.sourceSyncId).toBe(payload.matches[0].syncId)
  })

  it('replaces an existing match and its balls', async () => {
    const sourceId = await createScoredMatch()
    const payload = await exportMatchPayload(sourceId)
    await addBall({
      matchId: sourceId,
      innings: 1,
      over: 0,
      ballInOver: 1,
      runs: 6,
      isExtra: false,
      extraType: null,
      extraRuns: 0,
      isWicket: false,
      dismissalType: null,
      batsmanIndex: 0,
      bowlerIndex: 0,
    })

    await applySyncImport(payload, { [payload.matches[0].syncId]: 'replace' })
    const balls = await getBalls(sourceId, 1)

    expect(balls).toHaveLength(1)
    expect(balls[0].runs).toBe(4)
  })

  it('skips an existing match by default and reports conflicts', async () => {
    const sourceId = await createScoredMatch()
    const payload = await exportMatchPayload(sourceId)
    const localMatches = await getAllMatches()
    const summary = getPayloadSummary(payload, localMatches)

    const result = await applySyncImport(payload)

    expect(summary.conflicts).toHaveLength(1)
    expect(result.skipped).toEqual([payload.matches[0].syncId])
  })

  it('normalizes legacy matches and balls without sync fields during export', async () => {
    const id = await db.matches.add({
      date: new Date().toISOString(),
      status: 'live',
      teamA: { name: 'Old A', players: [] },
      teamB: { name: 'Old B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: null,
    })
    await db.balls.add({ matchId: id, innings: 1, over: 0, ballInOver: 0, runs: 1 })

    const payload = await exportMatchPayload(id)

    expect(payload.matches[0].syncId).toEqual(expect.stringMatching(/^match_/))
    expect(payload.balls[0].uid).toEqual(expect.stringMatching(/^ball_/))
    expect(payload.balls[0].matchSyncId).toBe(payload.matches[0].syncId)
  })

  it('rejects invalid JSON and wrong sync formats', () => {
    expect(() => parseSyncPayload('{bad json')).toThrow('not valid JSON')
    expect(() => parseSyncPayload(JSON.stringify({ format: 'other', version: 1, matches: [], balls: [] }))).toThrow('not a Box Cricket sync file')
  })

  it('rejects balls that are not linked to exported matches', () => {
    const payload = {
      format: 'box-cricket-json-sync',
      version: 1,
      exportedAt: new Date().toISOString(),
      sourceDeviceId: 'device_test',
      scope: 'match',
      matches: [{
        syncId: 'match_a',
        date: new Date().toISOString(),
        status: 'live',
        teamA: { name: 'A', players: [] },
        teamB: { name: 'B', players: [] },
        totalOvers: 6,
        playersPerSide: 6,
        currentInnings: 1,
      }],
      balls: [{ matchSyncId: 'match_missing', innings: 1, runs: 1 }],
    }

    expect(() => parseSyncPayload(JSON.stringify(payload))).toThrow('not linked')
  })

  it('generates descriptive filenames for day and tournament exports', async () => {
    const id = await createScoredMatch()
    const matchPayload = await exportMatchPayload(id)
    const dayPayload = { ...matchPayload, scope: 'day' }
    const tournamentPayload = { ...matchPayload, scope: 'tournament' }

    expect(getSyncFileName(matchPayload)).toContain('box-cricket-match-tigers-v-lions')
    expect(getSyncFileName(dayPayload)).toContain('box-cricket-day-')
    expect(getSyncFileName(tournamentPayload)).toBe('box-cricket-tournament-summer-cup.boxcricket.json')
  })

  it('uses native file sharing when available', async () => {
    const id = await createScoredMatch()
    const payload = await exportMatchPayload(id)
    const originalCanShare = navigator.canShare
    const originalShare = navigator.share
    navigator.canShare = () => true
    navigator.share = vi.fn().mockResolvedValue()

    await expect(shareOrDownloadPayload(payload)).resolves.toBe('shared')
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }))

    navigator.canShare = originalCanShare
    navigator.share = originalShare
  })

  it('downloads the sync file when native sharing is unavailable', async () => {
    const id = await createScoredMatch()
    const payload = await exportMatchPayload(id)
    const originalCanShare = navigator.canShare
    const originalShare = navigator.share
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    navigator.canShare = () => false
    navigator.share = undefined
    URL.createObjectURL = vi.fn(() => 'blob:sync')
    URL.revokeObjectURL = vi.fn()
    const click = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = click
      return el
    })

    await expect(shareOrDownloadPayload(payload)).resolves.toBe('downloaded')
    expect(click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sync')

    document.createElement.mockRestore()
    navigator.canShare = originalCanShare
    navigator.share = originalShare
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })

  it('falls back to download when native sharing is denied', async () => {
    const id = await createScoredMatch()
    const payload = await exportMatchPayload(id)
    const originalCanShare = navigator.canShare
    const originalShare = navigator.share
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    navigator.canShare = () => true
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }))
    URL.createObjectURL = vi.fn(() => 'blob:sync-denied')
    URL.revokeObjectURL = vi.fn()
    const click = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = click
      return el
    })

    await expect(shareOrDownloadPayload(payload)).resolves.toBe('downloaded')
    expect(navigator.share).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()

    document.createElement.mockRestore()
    navigator.canShare = originalCanShare
    navigator.share = originalShare
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })

  it('does not download when native sharing is cancelled', async () => {
    const id = await createScoredMatch()
    const payload = await exportMatchPayload(id)
    const originalCanShare = navigator.canShare
    const originalShare = navigator.share
    navigator.canShare = () => true
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('Share cancelled'), { name: 'AbortError' }))

    await expect(shareOrDownloadPayload(payload)).resolves.toBe('cancelled')

    navigator.canShare = originalCanShare
    navigator.share = originalShare
  })
})

describe('v2 export behaviour', () => {
  it('includes appVersion, toss and openingSetup in exported matches', async () => {
    const id = await createMatch({
      teamA: 'Tigers', teamB: 'Lions', totalOvers: 6, playersPerSide: 6,
      appVersion: 2,
      toss: { wonBy: 'A', decision: 'bat', battingFirst: 'A' },
      openingSetup: { striker: 0, nonStriker: 1, bowlerIndex: 0 },
    })
    const payload = await exportMatchPayload(id)
    expect(payload.matches[0].appVersion).toBe(2)
    expect(payload.matches[0].toss).toEqual({ wonBy: 'A', decision: 'bat', battingFirst: 'A' })
    expect(payload.matches[0].openingSetup).toEqual({ striker: 0, nonStriker: 1, bowlerIndex: 0 })
  })

  it('never includes the audit log in an exported payload', async () => {
    const { createMatchV2, appendAudit } = await import('../db')
    const id = await createMatchV2({ teamA: 'Tigers', teamB: 'Lions', totalOvers: 6, playersPerSide: 6 })
    await appendAudit({ matchId: id, action: 'ballAdded', payload: { runs: 4 } })
    const payload = await exportMatchPayload(id)
    expect(payload).not.toHaveProperty('auditLog')
    // No exported field should carry audit action data.
    expect(JSON.stringify(payload)).not.toContain('ballAdded')
  })
})
