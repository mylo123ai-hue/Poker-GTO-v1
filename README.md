# Poker GTO Lab

A desktop-first, GitHub Pages-compatible heads-up no-limit Texas Hold'em trainer. Play one human versus a selectable heuristic opponent, inspect transparent pot and equity estimates, or run reproducible headless batches.

> **Accuracy boundary:** this release contains no solver binary or verified solver strategy data. Coach advice and opponent profiles are approximate authored heuristics. The app does not claim full-game GTO accuracy. No real-money wagering is supported.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

The trainer opens at the local Vite URL. Each hand uses a reproducible seed, resets both stacks to 100 BB, and alternates the button. Opponent hole cards stay hidden until showdown. The coach and AI both receive a player view that excludes the opponent's private cards.

## Check and build

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The build writes a static site to `dist/`. Vite uses relative asset paths, so the output can be hosted from a GitHub Pages project path. There is no deploy workflow; publish Pages separately only when explicitly intended.

## Reproducible simulations

Run 1,000 hands with a fixed seed and export JSON, CSV, and a charted PDF:

```sh
npm run simulate -- --hands 1000 --seed 20261030 --p0 balanced --p1 aggressive --out reports/sample
```

Supported profile names are `tight`, `caller`, `aggressive`, and `balanced`. Batch sizes are 1–100,000 hands. The CLI records the source commit SHA, seed, profile pair, stack/blinds, chip outcomes, action counts, runtime and any failed hand. A repeated run has identical game results for the same seed and parameters; elapsed runtime can vary. `npm run simulate:sample` produces a ready-to-review sample under `reports/sample/`.

Simulation outputs are evidence about the selected heuristic profiles only. They do not validate GTO play. Agreement and solver EV loss remain null unless compatible verified solver references are later added.

## Architecture

- `src/poker/` — seeded deck, hand evaluation, heads-up rules, legal sizing, all-ins, showdown settlement and profile-driven opponents.
- `src/coach/` — concise rule-based recommendation; it receives only a privacy-limited `PlayerView`.
- `src/solver/` and `public/solver-manifest.json` — rules abstraction and fail-closed solver lookup. Current coverage is zero.
- `src/simulation/` — headless engine runner, deterministic regression projection, worker entry point and JSON/CSV/PDF exports.
- `src/ui/` — table, action controls, live coach, metrics and simulation controls.
- `e2e/` and `src/**/*.test.ts` — rule, accuracy-boundary, repeatability, export, privacy and browser smoke checks.
- `.github/workflows/ci.yml` — type checks, unit tests, static build, a seeded batch with report artifacts, and Chromium smoke tests. It does not deploy.

Chips use integer half-big-blind units: blinds are 1/2 chips and the default 200-chip stack is 100 BB. There is no rake. The current game is heads-up only. Each hand resets to its initial stack. See [solver provenance and coverage](docs/solver-provenance.md) for reviewed sources and the explicit unsupported-data boundary.

## Solver provenance and metrics

`VERIFIED SOLVER` is reserved for licensed, compatible strategy outputs with validated spot fixtures and parameter metadata. No rows currently meet that bar. `APPROXIMATE` labels the authored coach, profile behavior, and deterministic Monte Carlo equity estimate against a uniformly random legal hand. `UNAVAILABLE` marks solver frequencies and solver EV. Pot odds are exact arithmetic for the current call price and exclude future betting.

## Rollback

Revert the implementation commit on its branch with `git revert <commit-sha>`. If the pull request has not been merged, closing it and deleting its implementation branch removes the proposed change without affecting `main`. No deployment or repository settings are part of this task.
