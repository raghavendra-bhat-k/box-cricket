import { useRef, useState, useEffect } from 'react'

export default function DragList({ items, onChange, renderItem }) {
  const listRef = useRef(null)
  const insertAtRef = useRef(null)
  const [drag, setDrag] = useState(null) // { idx, ghostY } or null
  const [insertAt, setInsertAt] = useState(null)

  // Keep ref in sync so native event handlers don't see stale state
  function setInsertAtSync(val) {
    insertAtRef.current = val
    setInsertAt(val)
  }

  const itemsRef = useRef(items)
  const onChangeRef = useRef(onChange)
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    let timer = null
    let activeIdx = null
    let startPos = null

    function getRows() {
      return Array.from(el.querySelectorAll('[data-drag-row]'))
    }

    function computeInsert(clientY) {
      const rows = getRows()
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect()
        if (clientY < r.top + r.height / 2) return i
      }
      return rows.length
    }

    function onTouchStart(e) {
      const handle = e.target.closest('.drag-handle')
      if (!handle) return
      const row = handle.closest('[data-drag-row]')
      if (!row) return
      const idx = getRows().indexOf(row)
      if (idx === -1) return

      const touch = e.touches[0]
      startPos = { x: touch.clientX, y: touch.clientY }

      timer = setTimeout(() => {
        timer = null
        activeIdx = idx
        setDrag({ idx, ghostY: startPos.y })
        setInsertAtSync(idx)
      }, 280)
    }

    function onTouchMove(e) {
      const touch = e.touches[0]
      if (timer !== null) {
        const dx = Math.abs(touch.clientX - startPos.x)
        const dy = Math.abs(touch.clientY - startPos.y)
        if (dx > 7 || dy > 7) {
          clearTimeout(timer)
          timer = null
        }
        return
      }
      if (activeIdx === null) return
      e.preventDefault()
      const clientY = touch.clientY
      setDrag(prev => prev ? { ...prev, ghostY: clientY } : null)
      setInsertAtSync(computeInsert(clientY))
    }

    function onTouchEnd() {
      if (timer !== null) { clearTimeout(timer); timer = null }
      if (activeIdx === null) return

      const fromIdx = activeIdx
      const toIdx = insertAtRef.current
      activeIdx = null
      setDrag(null)
      setInsertAtSync(null)

      if (toIdx !== null && fromIdx !== toIdx) {
        const arr = [...itemsRef.current]
        const [removed] = arr.splice(fromIdx, 1)
        arr.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, removed)
        onChangeRef.current(arr)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      if (timer) clearTimeout(timer)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, []) // stable: reads via refs

  const listRect = drag !== null && listRef.current ? listRef.current.getBoundingClientRect() : null

  return (
    <div ref={listRef} className="drag-list">
      {items.map((item, i) => (
        <div key={i} data-drag-row className={`drag-item${drag?.idx === i ? ' drag-item--dragging' : ''}`}>
          {insertAt === i && drag !== null && drag.idx !== i && <div className="drag-placeholder" />}
          <span className="drag-handle" title="Hold to drag">☰</span>
          {renderItem(item, i)}
        </div>
      ))}
      {insertAt === items.length && drag !== null && <div className="drag-placeholder" />}
      {drag !== null && listRect && (
        <div
          className="drag-item drag-item--ghost"
          style={{
            position: 'fixed',
            top: drag.ghostY - 22,
            left: listRect.left,
            width: listRect.width,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <span className="drag-handle">☰</span>
          {renderItem(items[drag.idx], drag.idx)}
        </div>
      )}
    </div>
  )
}
