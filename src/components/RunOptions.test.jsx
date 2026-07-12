import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RunOptions from './RunOptions'

describe('RunOptions', () => {
  it('reports a standard value when a button is tapped', () => {
    const onChange = vi.fn()
    render(<RunOptions value={0} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('allows a custom value (e.g. 5) via the + input', () => {
    const onChange = vi.fn()
    render(<RunOptions value={0} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Custom runs' }))
    fireEvent.change(screen.getByLabelText('Custom run value'), { target: { value: '5' } })
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('opens in custom mode when the current value is non-standard', () => {
    render(<RunOptions value={5} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Custom run value')).toHaveValue(5)
  })
})
