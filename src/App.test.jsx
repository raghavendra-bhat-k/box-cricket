import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'
import db, { createMatch, addBall } from './db'
import { exportMatchPayload } from './utils/sync'

beforeEach(async () => {
  await db.balls.clear()
  await db.matches.clear()
  await db.auditLog.clear()
  // Reset persisted settings + theme so state does not leak between tests
  // (localStorage persists across tests in this runtime; empty loads defaults).
  try {
    localStorage.setItem('boxCricketSettings', '')
    localStorage.setItem('boxCricketTheme', 'royal')
  } catch { /* ignore */ }
  document.documentElement.dataset.theme = 'royal'
})

describe('App - navigation', () => {
  it('renders home screen with New Match button', () => {
    render(<App />)
    expect(screen.getByText('Box Cricket')).toBeInTheDocument()
    expect(screen.getByText('New Match')).toBeInTheDocument()
  })

  it('defaults to red and gold palette and allows changing palettes', async () => {
    render(<App />)
    const palette = screen.getByLabelText('Palette')
    expect(palette.value).toBe('royal')

    fireEvent.change(palette, { target: { value: 'sky' } })

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('sky')
    })
  })

  it('renders the palette-driven brand logo mark', () => {
    render(<App />)
    // The logo is an accessible SVG mark beside the title.
    expect(screen.getByTitle('Box Cricket logo')).toBeInTheDocument()
  })

  it('syncs the browser status-bar color to the selected palette', async () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
    try {
      render(<App />)
      const palette = screen.getByLabelText('Palette')

      // Default palette (royal) primary colour.
      await waitFor(() => expect(meta.getAttribute('content')).toBe('#991b1b'))

      fireEvent.change(palette, { target: { value: 'classic' } })
      await waitFor(() => expect(meta.getAttribute('content')).toBe('#1a472a'))
    } finally {
      document.head.removeChild(meta)
    }
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
    await createMatch({
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

  it('navigates to the settings screen and back', async () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('Settings'))
    await waitFor(() => expect(screen.getByText('Guided Scoring (v2)')).toBeInTheDocument())
    // Sub-toggles stay hidden until guided scoring is enabled.
    expect(screen.queryByText('Toss selection')).not.toBeInTheDocument()
    fireEvent.click(document.querySelector('.back-btn'))
    expect(screen.getByText('Box Cricket')).toBeInTheDocument()
  })

  it('creates a v2 match when guided scoring is enabled in settings', async () => {
    render(<App />)
    // Enable guided scoring.
    fireEvent.click(screen.getByLabelText('Settings'))
    await waitFor(() => screen.getByText('Guided Scoring (v2)'))
    fireEvent.click(screen.getAllByRole('switch')[0])
    fireEvent.click(document.querySelector('.back-btn'))

    // Create a match through the normal flow.
    fireEvent.click(screen.getByText('New Match'))
    const nameInputs = screen.getAllByPlaceholderText('Team name')
    fireEvent.change(nameInputs[0], { target: { value: 'Guided A' } })
    fireEvent.change(nameInputs[1], { target: { value: 'Guided B' } })
    fireEvent.click(screen.getByText('Start Match'))

    // The created match is tagged appVersion 2.
    await waitFor(async () => {
      const matches = await db.matches.toArray()
      expect(matches).toHaveLength(1)
      expect(matches[0].appVersion).toBe(2)
    })
  })

  it('imports a sync file through the home import flow', async () => {
    const id = await createMatch({
      teamA: 'Import A',
      teamB: 'Import B',
      totalOvers: 6,
      playersPerSide: 6,
    })
    await addBall({ matchId: id, innings: 1, over: 0, ballInOver: 0, runs: 4, isExtra: false, extraType: null, extraRuns: 0, isWicket: false, dismissalType: null, batsmanIndex: 0, bowlerIndex: 0 })
    const payload = await exportMatchPayload(id)
    await db.balls.clear()
    await db.matches.clear()

    render(<App />)
    const file = new File([JSON.stringify(payload)], 'handoff.boxcricket.json', { type: 'application/json' })
    const input = screen.getByLabelText('Import Sync File')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import Selected')).toBeInTheDocument()
      expect(screen.getByText('Import A vs Import B')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Import Selected'))

    await waitFor(() => {
      expect(screen.getByText('Import A vs Import B')).toBeInTheDocument()
    })
  })
})
