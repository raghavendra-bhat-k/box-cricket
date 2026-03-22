import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MatchList from './MatchList'
import db from '../db'

const onResume = vi.fn()
const onView = vi.fn()
const onRematch = vi.fn()

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  onResume.mockClear()
  onView.mockClear()
  onRematch.mockClear()
})

describe('MatchList - rematch button', () => {
  it('shows Rematch button for matches created today', async () => {
    await db.matches.add({
      date: new Date().toISOString(),
      status: 'completed',
      teamA: { name: 'A', players: [] },
      teamB: { name: 'B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: 'A won',
    })

    render(<MatchList onResume={onResume} onView={onView} onRematch={onRematch} />)

    await waitFor(() => {
      expect(screen.getByText('Rematch')).toBeInTheDocument()
    })
  })

  it('does NOT show Rematch button for matches from other days', async () => {
    await db.matches.add({
      date: new Date('2024-01-01').toISOString(),
      status: 'completed',
      teamA: { name: 'Old A', players: [] },
      teamB: { name: 'Old B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: 'Old A won',
    })

    render(<MatchList onResume={onResume} onView={onView} onRematch={onRematch} />)

    await waitFor(() => {
      expect(screen.getByText('Old A vs Old B')).toBeInTheDocument()
    })
    expect(screen.queryByText('Rematch')).not.toBeInTheDocument()
  })

  it('shows Resume button only for live matches', async () => {
    await db.matches.add({
      date: new Date().toISOString(),
      status: 'live',
      teamA: { name: 'Live A', players: [] },
      teamB: { name: 'Live B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: null,
    })

    render(<MatchList onResume={onResume} onView={onView} onRematch={onRematch} />)

    await waitFor(() => {
      expect(screen.getByText('Resume')).toBeInTheDocument()
    })
  })
})
