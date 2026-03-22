import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'
import db, { createMatch, addBall } from './db'

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
})

describe('App - navigation', () => {
  it('renders home screen with New Match button', () => {
    render(<App />)
    expect(screen.getByText('Box Cricket')).toBeInTheDocument()
    expect(screen.getByText('New Match')).toBeInTheDocument()
  })

  it('navigates to new match screen', () => {
    render(<App />)
    fireEvent.click(screen.getByText('New Match'))
    expect(screen.getByText('New Match')).toBeInTheDocument()
    expect(screen.getByText('Team A (Batting First)')).toBeInTheDocument()
  })

  it('navigates back from new match to home', () => {
    render(<App />)
    fireEvent.click(screen.getByText('New Match'))
    const backBtn = document.querySelector('.back-btn')
    fireEvent.click(backBtn)
    expect(screen.getByText('Box Cricket')).toBeInTheDocument()
  })

  it('shows match list with existing matches', async () => {
    await createMatch({
      teamA: 'Alpha',
      teamB: 'Beta',
      totalOvers: 6,
      playersPerSide: 6,
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Alpha vs Beta')).toBeInTheDocument()
    })
  })

  it('resumes a live match from match list', async () => {
    const id = await createMatch({
      teamA: 'Alpha',
      teamB: 'Beta',
      totalOvers: 6,
      playersPerSide: 6,
      teamAPlayers: ['P1', 'P2'],
      teamBPlayers: ['P3', 'P4'],
    })
    render(<App />)
    await waitFor(() => screen.getByText('Resume'))
    fireEvent.click(screen.getByText('Resume'))
    await waitFor(() => {
      expect(screen.getByText('W')).toBeInTheDocument()
      expect(screen.getByText('EX')).toBeInTheDocument()
    })
  })

  it('views scorecard from match list', async () => {
    const id = await createMatch({
      teamA: 'Alpha',
      teamB: 'Beta',
      totalOvers: 6,
      playersPerSide: 6,
    })
    await addBall({ matchId: id, innings: 1, over: 0, ballInOver: 0, runs: 1, isExtra: false, extraType: null, extraRuns: 0, isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0 })

    render(<App />)
    await waitFor(() => screen.getByText('View'))
    fireEvent.click(screen.getByText('View'))
    await waitFor(() => {
      expect(screen.getByText('Scorecard')).toBeInTheDocument()
    })
  })

  it('rematch navigates to new match pre-filled', async () => {
    await createMatch({
      teamA: 'Alpha',
      teamB: 'Beta',
      totalOvers: 8,
      playersPerSide: 5,
      teamAPlayers: ['A1', 'A2'],
      teamBPlayers: ['B1', 'B2'],
    })
    render(<App />)
    await waitFor(() => screen.getByText('Rematch'))
    fireEvent.click(screen.getByText('Rematch'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Beta')).toBeInTheDocument()
      expect(screen.getByDisplayValue('8')).toBeInTheDocument()
      expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    })
  })
})
