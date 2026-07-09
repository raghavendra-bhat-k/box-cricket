import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Settings from './Settings'
import { DEFAULT_SETTINGS } from '../settings'

function renderSettings(overrides = {}, onExportDebugLog) {
  const onChange = vi.fn()
  const onBack = vi.fn()
  const settings = { ...DEFAULT_SETTINGS, ...overrides }
  render(<Settings settings={settings} onChange={onChange} onBack={onBack} onExportDebugLog={onExportDebugLog} />)
  return { onChange, onBack }
}

describe('Settings', () => {
  it('hides sub-toggles until guided scoring is enabled', () => {
    renderSettings({ guidedScoring: false })
    expect(screen.queryByText('Toss selection')).not.toBeInTheDocument()
  })

  it('reveals sub-toggles when guided scoring is on', () => {
    renderSettings({ guidedScoring: true })
    expect(screen.getByText('Toss selection')).toBeInTheDocument()
    expect(screen.getByText('Detailed wicket flow')).toBeInTheDocument()
  })

  it('emits an updated settings object when the master toggle is flipped', () => {
    const { onChange } = renderSettings({ guidedScoring: false })
    const master = screen.getAllByRole('switch')[0]
    fireEvent.click(master)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ guidedScoring: true }))
  })

  it('toggling a sub-setting off is reported to onChange', () => {
    const { onChange } = renderSettings({ guidedScoring: true, toss: true })
    // First switch is the master; the toss row is the next switch.
    const tossToggle = screen.getAllByRole('switch')[1]
    fireEvent.click(tossToggle)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ toss: false }))
  })

  it('calls onBack from the back button', () => {
    const { onBack } = renderSettings()
    fireEvent.click(screen.getByText('←'))
    expect(onBack).toHaveBeenCalled()
  })

  it('hides the debug export unless guided scoring is on', () => {
    renderSettings({ guidedScoring: false })
    expect(screen.queryByText('Export Debug Log')).not.toBeInTheDocument()
  })

  it('exports the debug log and shows a success status', async () => {
    const onExport = vi.fn().mockResolvedValue({ status: 'downloaded', matchCount: 2 })
    renderSettings({ guidedScoring: true }, onExport)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => {
      expect(onExport).toHaveBeenCalled()
      expect(screen.getByText('Exported debug log for 2 matches.')).toBeInTheDocument()
    })
  })

  it('shows an empty-state message when there is no debug log', async () => {
    const onExport = vi.fn().mockResolvedValue({ status: 'empty', matchCount: 0 })
    renderSettings({ guidedScoring: true }, onExport)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => {
      expect(screen.getByText('No guided matches with a debug log yet.')).toBeInTheDocument()
    })
  })

  it('surfaces an error message when the export throws', async () => {
    const onExport = vi.fn().mockRejectedValue(new Error('boom'))
    renderSettings({ guidedScoring: true }, onExport)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => {
      expect(screen.getByText('Could not export debug log.')).toBeInTheDocument()
    })
  })

  it('clears the status when a native share is cancelled', async () => {
    const onExport = vi.fn().mockResolvedValue({ status: 'cancelled', matchCount: 1 })
    renderSettings({ guidedScoring: true }, onExport)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => expect(onExport).toHaveBeenCalled())
    expect(screen.queryByText(/Exported debug log/)).not.toBeInTheDocument()
  })
})
