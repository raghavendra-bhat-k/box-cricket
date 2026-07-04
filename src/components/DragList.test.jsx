import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import DragList from './DragList'

// jsdom returns zero-sized rects; give each row a distinct vertical band so the
// insertion-index math has something meaningful to compute against.
function stubRowRects(container) {
  const rows = container.querySelectorAll('[data-drag-row]')
  rows.forEach((row, i) => {
    row.getBoundingClientRect = () => ({
      top: i * 40,
      bottom: i * 40 + 40,
      height: 40,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: i * 40,
    })
  })
}

describe('DragList (pointer events — works with mouse and touch)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reorders an item after a long-press drag via pointer events', () => {
    const onChange = vi.fn()
    const { container } = render(
      <DragList
        items={['A', 'B', 'C']}
        onChange={onChange}
        renderItem={(name) => <span>{name}</span>}
      />
    )
    stubRowRects(container)

    const handle = container.querySelectorAll('.drag-handle')[0] // handle of "A"

    // Press and hold on A's handle, then wait past the 280ms long-press threshold.
    fireEvent.pointerDown(handle, { clientX: 5, clientY: 5, button: 0, pointerId: 1 })
    act(() => { vi.advanceTimersByTime(300) })

    // Drag down into C's half so A drops between B and C.
    fireEvent.pointerMove(container.querySelector('.drag-list'), { clientX: 5, clientY: 70, pointerId: 1 })
    fireEvent.pointerUp(container.querySelector('.drag-list'), { clientX: 5, clientY: 70, pointerId: 1 })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['B', 'A', 'C'])
  })

  it('does not reorder when released before the long-press threshold', () => {
    const onChange = vi.fn()
    const { container } = render(
      <DragList items={['A', 'B', 'C']} onChange={onChange} renderItem={(name) => <span>{name}</span>} />
    )
    stubRowRects(container)

    const handle = container.querySelectorAll('.drag-handle')[0]
    fireEvent.pointerDown(handle, { clientX: 5, clientY: 5, button: 0, pointerId: 1 })
    // Release immediately (a plain tap) — the 280ms timer never fires.
    fireEvent.pointerUp(container.querySelector('.drag-list'), { clientX: 5, clientY: 5, pointerId: 1 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('cancels the drag when the finger/mouse moves before the threshold (scroll intent)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <DragList items={['A', 'B', 'C']} onChange={onChange} renderItem={(name) => <span>{name}</span>} />
    )
    stubRowRects(container)

    const handle = container.querySelectorAll('.drag-handle')[0]
    fireEvent.pointerDown(handle, { clientX: 5, clientY: 5, button: 0, pointerId: 1 })
    // Move more than 7px before the timer fires → treated as a scroll, press cancelled.
    fireEvent.pointerMove(container.querySelector('.drag-list'), { clientX: 5, clientY: 40, pointerId: 1 })
    act(() => { vi.advanceTimersByTime(300) })
    fireEvent.pointerUp(container.querySelector('.drag-list'), { clientX: 5, clientY: 40, pointerId: 1 })

    expect(onChange).not.toHaveBeenCalled()
  })
})
