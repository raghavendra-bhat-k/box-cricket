import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, isFeatureEnabled } from './settings'

// The test runtime's global localStorage is a minimal stub; install a full in-memory
// implementation so these tests are self-contained and deterministic.
beforeEach(() => {
  const store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: key => { store.delete(key) },
    clear: () => { store.clear() },
  })
})

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('defaults guidedScoring to off', () => {
    expect(loadSettings().guidedScoring).toBe(false)
  })

  it('merges stored values over defaults so new keys get defaults', () => {
    localStorage.setItem('boxCricketSettings', JSON.stringify({ guidedScoring: true, toss: false }))
    const settings = loadSettings()
    expect(settings.guidedScoring).toBe(true)
    expect(settings.toss).toBe(false)
    // A key not present in stored JSON falls back to its default.
    expect(settings.detailedWicket).toBe(true)
  })

  it('falls back to defaults on malformed JSON', () => {
    localStorage.setItem('boxCricketSettings', '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('saveSettings', () => {
  it('persists settings that loadSettings can read back', () => {
    const next = { ...DEFAULT_SETTINGS, guidedScoring: true, undoRedo: false }
    saveSettings(next)
    expect(loadSettings()).toEqual(next)
  })

  it('returns the settings it was given', () => {
    const next = { ...DEFAULT_SETTINGS, guidedScoring: true }
    expect(saveSettings(next)).toBe(next)
  })
})

describe('isFeatureEnabled', () => {
  it('is false for every feature when guidedScoring is off', () => {
    const settings = { ...DEFAULT_SETTINGS, guidedScoring: false, toss: true }
    expect(isFeatureEnabled(settings, 'toss')).toBe(false)
  })

  it('reflects the sub-toggle when guidedScoring is on', () => {
    const settings = { ...DEFAULT_SETTINGS, guidedScoring: true, toss: true, undoRedo: false }
    expect(isFeatureEnabled(settings, 'toss')).toBe(true)
    expect(isFeatureEnabled(settings, 'undoRedo')).toBe(false)
  })

  it('treats a missing sub-toggle as enabled when guided', () => {
    expect(isFeatureEnabled({ guidedScoring: true }, 'toss')).toBe(true)
  })

  it('handles undefined settings safely', () => {
    expect(isFeatureEnabled(undefined, 'toss')).toBe(false)
  })
})
