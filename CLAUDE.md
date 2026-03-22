# Box Cricket App — Claude Rules

## Testing Requirements

Before pushing any commit to the remote:
1. Run `npm test` — all tests must pass (100% success rate)
2. Run `npm run test:coverage` — verify at least 80% statement coverage
3. If any test fails, fix the issue before pushing
4. **All changes** (features, bug fixes, refactors) must include corresponding test cases
5. Existing tests must not break — run full suite before committing

## Branching & PR Workflow

- All new changes must start on a **new branch created from `master`**
- Branch naming: `feature/<short-description>` or `fix/<short-description>`
- After changes are complete and tests pass, create a **Pull Request** to `master`
- Never push directly to `master`

## Tech Stack

- React 19 + Vite 7
- Dexie (IndexedDB) for offline storage
- Vitest + React Testing Library for tests
- PWA with vite-plugin-pwa

## Project Structure

- `src/utils/scoring.js` — pure scoring logic (100% test coverage expected)
- `src/db.js` — Dexie database operations
- `src/components/Scoring.jsx` — main scoring screen (largest component)
- `src/components/NewMatch.jsx` — match creation with rematch support
- `src/components/MatchList.jsx` — match listing with rematch button
- `src/components/Scorecard.jsx` — scorecard with share functionality

## Key Conventions

- Backward compatibility: use `??` fallback for new fields (e.g., `match.teamASize ?? match.playersPerSide`)
- No IndexedDB schema migrations for non-indexed fields
- Extras/runs pickers use `[values] + "+" button` pattern for custom input
