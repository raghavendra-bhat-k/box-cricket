// User settings for the v2 (guided scoring) experience.
// Persisted in localStorage, mirroring the theme pattern in App.jsx.
// `guidedScoring` is the master switch; the sub-toggles only take effect when it is on.

const STORAGE_KEY = 'boxCricketSettings';

export const DEFAULT_SETTINGS = {
  guidedScoring: false,      // master v2 switch
  toss: true,                // ask who won the toss + bat/bowl at match start
  openingBatsmen: true,      // pick opening striker/non-striker (and opening bowler)
  forceBowlerEachOver: true, // force an explicit bowler pick at every over boundary
  detailedWicket: true,      // full-screen dismissal flow (how out, run-out target, runs)
  undoRedo: true,            // enable redo in addition to undo
  homeButton: true,          // persistent home control + back-button guard
  auditLog: true,            // record the per-ball audit log for support/debugging
};

export function loadSettings() {
  try {
    if (typeof localStorage?.getItem !== 'function') return { ...DEFAULT_SETTINGS };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    // Merge over defaults so newly-added settings keys get sensible values.
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    if (typeof localStorage?.setItem === 'function') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // Settings are non-critical; ignore storage failures.
  }
  return settings;
}

// Resolves whether a specific guided-scoring feature is active, honoring the master switch.
export function isFeatureEnabled(settings, key) {
  if (!settings?.guidedScoring) return false;
  return settings[key] !== false;
}
