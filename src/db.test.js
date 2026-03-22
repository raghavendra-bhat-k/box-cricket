import { describe, it, expect, beforeEach } from 'vitest'
import db, {
  createMatch,
  getMatch,
  updateMatch,
  getAllMatches,
  getBalls,
  addBall,
  removeLastBall,
  updateBall,
  getBallById,
} from './db'

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
})

// ─── createMatch ────────────────────────────────────────────────

describe('createMatch', () => {
  it('creates a match with all fields', async () => {
    const id = await createMatch({
      teamA: 'Tigers',
      teamB: 'Lions',
      totalOvers: 6,
      playersPerSide: 6,
      teamAPlayers: ['Alice', 'Bob'],
      teamBPlayers: ['Charlie', 'Dave'],
      rules: null,
    })
    const m = await getMatch(id)
    expect(m.teamA.name).toBe('Tigers')
    expect(m.teamB.name).toBe('Lions')
    expect(m.totalOvers).toBe(6)
    expect(m.playersPerSide).toBe(6)
    expect(m.status).toBe('live')
    expect(m.currentInnings).toBe(1)
  })

  it('stores teamASize and teamBSize equal to playersPerSide', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 5,
      playersPerSide: 8,
    })
    const m = await getMatch(id)
    expect(m.teamASize).toBe(8)
    expect(m.teamBSize).toBe(8)
  })

  it('stores player arrays', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 5,
      playersPerSide: 3,
      teamAPlayers: ['P1', 'P2', 'P3'],
      teamBPlayers: ['P4', 'P5', 'P6'],
    })
    const m = await getMatch(id)
    expect(m.teamA.players).toEqual(['P1', 'P2', 'P3'])
    expect(m.teamB.players).toEqual(['P4', 'P5', 'P6'])
  })

  it('defaults empty players when not provided', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 5,
      playersPerSide: 3,
    })
    const m = await getMatch(id)
    expect(m.teamA.players).toEqual([])
    expect(m.teamB.players).toEqual([])
  })

  it('stores custom rules', async () => {
    const rules = { runMap: { 1: 2 }, disabledRuns: [3] }
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 5,
      playersPerSide: 6,
      rules,
    })
    const m = await getMatch(id)
    expect(m.rules).toEqual(rules)
  })
})

// ─── updateMatch ────────────────────────────────────────────────

describe('updateMatch', () => {
  it('updates match fields', async () => {
    const id = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 5, playersPerSide: 6 })
    await updateMatch(id, { status: 'completed', result: 'A won' })
    const m = await getMatch(id)
    expect(m.status).toBe('completed')
    expect(m.result).toBe('A won')
  })

  it('updates teamASize and teamBSize independently', async () => {
    const id = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 5, playersPerSide: 6 })
    await updateMatch(id, { teamASize: 8, teamBSize: 5 })
    const m = await getMatch(id)
    expect(m.teamASize).toBe(8)
    expect(m.teamBSize).toBe(5)
    expect(m.playersPerSide).toBe(6) // unchanged
  })

  it('updates totalOvers (change overs mid-match)', async () => {
    const id = await createMatch({ teamA: 'A', teamB: 'B', totalOvers: 6, playersPerSide: 6 })
    await updateMatch(id, { totalOvers: 4 })
    const m = await getMatch(id)
    expect(m.totalOvers).toBe(4)
  })

  it('updates team players (remove player)', async () => {
    const id = await createMatch({
      teamA: 'A',
      teamB: 'B',
      totalOvers: 5,
      playersPerSide: 3,
      teamAPlayers: ['P1', 'P2', 'P3'],
    })
    const m = await getMatch(id)
    const updatedPlayers = m.teamA.players.filter((_, i) => i !== 1)
    await updateMatch(id, { teamA: { ...m.teamA, players: updatedPlayers } })
    const m2 = await getMatch(id)
    expect(m2.teamA.players).toEqual(['P1', 'P3'])
  })
})

// ─── getAllMatches ───────────────────────────────────────────────

describe('getAllMatches', () => {
  it('returns matches in reverse date order', async () => {
    await createMatch({ teamA: 'First', teamB: 'B', totalOvers: 5, playersPerSide: 6 })
    await createMatch({ teamA: 'Second', teamB: 'B', totalOvers: 5, playersPerSide: 6 })
    const all = await getAllMatches()
    expect(all).toHaveLength(2)
    expect(all[0].teamA.name).toBe('Second')
  })
})

// ─── Ball operations ────────────────────────────────────────────

describe('ball CRUD', () => {
  it('addBall + getBalls returns balls for correct innings', async () => {
    await addBall({ matchId: 1, innings: 1, runs: 4 })
    await addBall({ matchId: 1, innings: 2, runs: 6 })
    const b1 = await getBalls(1, 1)
    expect(b1).toHaveLength(1)
    expect(b1[0].runs).toBe(4)
  })

  it('removeLastBall removes the last ball', async () => {
    await addBall({ matchId: 1, innings: 1, runs: 1 })
    await addBall({ matchId: 1, innings: 1, runs: 2 })
    const removed = await removeLastBall(1, 1)
    expect(removed.runs).toBe(2)
    const remaining = await getBalls(1, 1)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].runs).toBe(1)
  })

  it('removeLastBall returns null for empty innings', async () => {
    const removed = await removeLastBall(1, 1)
    expect(removed).toBeNull()
  })

  it('updateBall modifies ball data', async () => {
    const id = await addBall({ matchId: 1, innings: 1, runs: 0, isWicket: false })
    await updateBall(id, { runs: 2, isWicket: true, dismissalType: 'run out' })
    const b = await getBallById(id)
    expect(b.runs).toBe(2)
    expect(b.isWicket).toBe(true)
    expect(b.dismissalType).toBe('run out')
  })

  it('getBallById returns correct ball', async () => {
    const id = await addBall({ matchId: 1, innings: 1, runs: 6 })
    const b = await getBallById(id)
    expect(b.runs).toBe(6)
  })
})

// ─── Backward compatibility ─────────────────────────────────────

describe('backward compatibility', () => {
  it('old match without teamASize/teamBSize still has playersPerSide', async () => {
    // Simulate old match by directly inserting without teamASize/teamBSize
    const id = await db.matches.add({
      date: new Date().toISOString(),
      status: 'live',
      teamA: { name: 'Old A', players: [] },
      teamB: { name: 'Old B', players: [] },
      totalOvers: 5,
      playersPerSide: 6,
      currentInnings: 1,
      result: null,
    })
    const m = await getMatch(id)
    expect(m.playersPerSide).toBe(6)
    expect(m.teamASize).toBeUndefined()
    expect(m.teamBSize).toBeUndefined()
    // Verify fallback works: teamASize ?? playersPerSide
    const teamASize = m.teamASize ?? m.playersPerSide
    expect(teamASize).toBe(6)
  })
})
