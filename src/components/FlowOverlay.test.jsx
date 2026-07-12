import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FlowOverlay from './FlowOverlay'

describe('FlowOverlay', () => {
  it('renders title, subtitle and children', () => {
    render(<FlowOverlay title="Toss" subtitle="Pick a side">body</FlowOverlay>)
    expect(screen.getByText('Toss')).toBeInTheDocument()
    expect(screen.getByText('Pick a side')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('shows a progress hint only when total > 1', () => {
    const { rerender } = render(<FlowOverlay title="A" step={2} total={3}>x</FlowOverlay>)
    expect(screen.getByText('2/3')).toBeInTheDocument()
    rerender(<FlowOverlay title="A" step={1} total={1}>x</FlowOverlay>)
    expect(screen.queryByText('1/1')).not.toBeInTheDocument()
  })

  it('renders Back and Home only when their handlers are provided', () => {
    const onBack = vi.fn()
    const onHome = vi.fn()
    const { rerender } = render(<FlowOverlay title="A">x</FlowOverlay>)
    expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Home')).not.toBeInTheDocument()

    rerender(<FlowOverlay title="A" onBack={onBack} onHome={onHome}>x</FlowOverlay>)
    fireEvent.click(screen.getByLabelText('Back'))
    fireEvent.click(screen.getByLabelText('Home'))
    expect(onBack).toHaveBeenCalled()
    expect(onHome).toHaveBeenCalled()
  })
})
