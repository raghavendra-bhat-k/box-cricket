import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import MatchList from './MatchList'
import db from '../db'

const onResume = vi.fn()
const onView = vi.fn()
const onRematch = vi.fn()
const onExportMatch = vi.fn()
const onExportDay = vi.fn()
const onExportTournament = vi.fn()
const onImportFile = vi.fn()
const onDeleteMatch = vi.fn()
const onDeleteDay = vi.fn()
const onDeleteTournament = vi.fn()

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  onResume.mockClear()
  onView.mockClear()
  onRematch.mockClear()
  onExportMatch.mockClear()
  onExportDay.mockClear()
  onExportTournament.mockClear()
  onImportFile.mockClear()
  onDeleteMatch.mockClear()
  onDeleteDay.mockClear()
  onDeleteTournament.mockClear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
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

describe('MatchList - sync export buttons', () => {
  it('shows match, day, and tournament export actions in grouped sections', async () => {
    const tournamentId = await db.matches.add({
      date: new Date().toISOString(),
      dayKey: '2026-06-21',
      status: 'live',
      teamA: { name: 'Sync A', players: [] },
      teamB: { name: 'Sync B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: null,
      tournamentName: 'Summer Cup',
    })
    await db.matches.add({
      date: '2026-06-20T10:00:00.000Z',
      dayKey: '2026-06-20',
      status: 'completed',
      teamA: { name: 'Day A', players: [] },
      teamB: { name: 'Day B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: 'Day A won',
      tournamentName: '',
    })

    render(
      <MatchList
        onResume={onResume}
        onView={onView}
        onRematch={onRematch}
        onExportMatch={onExportMatch}
        onExportDay={onExportDay}
        onExportTournament={onExportTournament}
        onImportFile={onImportFile}
      />
    )

    await waitFor(() => screen.getByText('Sync A vs Sync B'))
    const tournamentGroup = screen.getByText('Summer Cup').closest('.match-group')
    const dayGroup = screen.getByText('Sat, Jun 20, 2026').closest('.match-group')
    fireEvent.click(within(tournamentGroup).getAllByText('Export')[0])
    fireEvent.click(within(dayGroup).getByText('Export'))
    fireEvent.click(within(tournamentGroup).getAllByText('Export')[1])

    expect(onExportDay).toHaveBeenCalledWith('2026-06-20')
    expect(onExportTournament).toHaveBeenCalledWith('Summer Cup')
    expect(onExportMatch).toHaveBeenCalledWith(tournamentId)
  })

  it('collapses older groups by default and expands when tapped', async () => {
    await db.matches.add({
      date: new Date().toISOString(),
      dayKey: '2026-06-21',
      status: 'live',
      teamA: { name: 'Today A', players: [] },
      teamB: { name: 'Today B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: null,
    })
    await db.matches.add({
      date: '2026-06-20T10:00:00.000Z',
      dayKey: '2026-06-20',
      status: 'completed',
      teamA: { name: 'Old A', players: [] },
      teamB: { name: 'Old B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: 'Old A won',
    })

    render(<MatchList onResume={onResume} onView={onView} onRematch={onRematch} />)

    await waitFor(() => screen.getByText('Today A vs Today B'))
    expect(screen.queryByText('Old A vs Old B')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Sat, Jun 20, 2026'))
    expect(screen.getByText('Old A vs Old B')).toBeInTheDocument()
  })

  it('deletes a single match after confirmation', async () => {
    const id = await db.matches.add({
      date: new Date().toISOString(),
      status: 'completed',
      teamA: { name: 'Delete A', players: [] },
      teamB: { name: 'Delete B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: 'Delete A won',
    })

    render(<MatchList onResume={onResume} onView={onView} onRematch={onRematch} onDeleteMatch={onDeleteMatch} />)

    await waitFor(() => screen.getByText('Delete A vs Delete B'))
    const group = screen.getByText('Delete A vs Delete B').closest('.match-group')
    fireEvent.click(within(group).getAllByText('Delete')[1])

    expect(onDeleteMatch).toHaveBeenCalledWith(id)
  })

  it('deletes a day group after confirmation', async () => {
    await db.matches.add({
      date: '2026-06-20T10:00:00.000Z',
      dayKey: '2026-06-20',
      status: 'completed',
      teamA: { name: 'Day Delete A', players: [] },
      teamB: { name: 'Day Delete B', players: [] },
      totalOvers: 6,
      playersPerSide: 6,
      currentInnings: 1,
      result: 'Done',
    })

    render(<MatchList onResume={onResume} onView={onView} onRematch={onRematch} onDeleteDay={onDeleteDay} />)

    await waitFor(() => screen.getByText('Day Delete A vs Day Delete B'))
    const group = screen.getByText('Sat, Jun 20, 2026').closest('.match-group')
    fireEvent.click(within(group).getAllByText('Delete')[0])

    expect(onDeleteDay).toHaveBeenCalledWith('2026-06-20')
  })
})
