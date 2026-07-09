import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Settings from './Settings'
import { DEFAULT_SETTINGS } from '../settings'

function renderSettings(overrides = {}) {
  const onChange = vi.fn()
  const onBack = vi.fn()
  const settings = { ...DEFAULT_SETTINGS, ...overrides }
  render(<Settings settings={settings} onChange={onChange} onBack={onBack} />)
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
})
