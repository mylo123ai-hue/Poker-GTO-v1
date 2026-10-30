# Poker Practice Trainer

A mobile-first, static heads-up no-limit Texas Hold'em trainer. Play continuous matches against four authored heuristic opponents, use lightweight coaching, review saved hands, and track your own action statistics. All play uses synthetic chips in the browser; there is no backend, account system, telemetry, paid API, or real-money feature.

> **Accuracy boundary:** coach recommendations and opponent decisions are heuristics, not solver-backed GTO strategy or a claim of optimal play. The optional equity tool samples a uniformly random legal opponent hand, not the selected profile's range, and reports sampling uncertainty.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

The app opens at the local Vite URL. Match setup accepts whole-number starting stacks and small/big blinds. Stacks carry forward between hands, heads-up button/blind positions alternate, and the match ends when a player is eliminated. The seed is reproducible. The current match, up to 500 completed hands, coaching activity, and match results are saved in this browser's local storage. Refresh resumes the current hand; starting a new match resets the current match while preserving saved hand history and statistics.

Opponent hole cards remain hidden until showdown. The coach and each heuristic opponent receive a privacy-limited view containing only that player's private cards and public state.

## Coaching and statistics

- **Beginner** shows the rule-based suggestion automatically.
- **Practice** lets you choose first and request a hint.
- **Challenge** hides live suggestions and shows them after the hand for comparison. A match with the heuristic is not a correctness grade.
- Pot odds use the exact call amount divided by the called pot, before future betting.
- The coach labels the current made-hand category when five public/private cards exist, adds position and starting-hand context, and explains legal bet sizing. It does not show hidden opponent cards.
- The optional equity estimate uses 96 deterministic samples and a uniform-random-legal-hand assumption. Its approximate 95% sampling range can be wide, especially at this cap.
- Player stats use explicit denominators: VPIP and PFR per hand; 3-bet and continuation-bet rates per legal opportunity; fold-to-c-bet per time facing a c-bet; WTSD per flop seen; W$SD per showdown with a split counting half; aggression factor as bets/raises divided by calls; and BB/100 from net chips normalized by each hand's big blind. Zero-sample values display as unavailable. Stats use the latest 500 saved hands and identify their sample counts.
- Common-leak indicators are simple review prompts with minimum sample thresholds, not diagnoses or strategy grades.

## Opponents and simulations

The four profiles are **Tight**, **Calling station**, **Aggressive**, and **Balanced**. Their descriptions and results are empirical properties of these authored heuristics only.

The in-browser simulation lab runs seeded batches in a worker and can download JSON, CSV, and PDF summaries. For reproducible continuous matches from the command line:

```sh
npm run simulate:matches -- --matches 20 --seed 20261030 --stack 200 --small-blind 1 --big-blind 2 --p0 balanced --p1 aggressive --out reports/matches.json
```

The simulation uses synthetic data, tracks elimination and chip conservation, and has no solver reference or optimal-play benchmark.

## Build, tests, and GitHub Pages

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The static build is written to `dist/`. Vite uses relative asset URLs (`base: "./"`), suitable for a GitHub Pages project path. To publish later, an owner can enable GitHub Pages with GitHub Actions, run these build steps, upload `dist/` as the Pages artifact, then deploy it with GitHub's Pages actions. This repository's validation workflow does not deploy. Pages was not enabled or changed for this task.

## Architecture and retained research

- `src/poker/` — seeded deck, hand evaluation, heads-up rules, configurable blinds, continuous match transitions, player views, opponent profiles, and match simulation.
- `src/coach/` — explainable approximate advice based on the player's visible cards and legal action state.
- `src/poker/stats.ts` and `src/poker/persistence.ts` — replayable hand records, sample-aware metrics, challenge feedback, and guarded local recovery.
- `src/simulation/` — headless heuristic batches, browser worker, deterministic regression projections, and JSON/CSV/PDF exports.
- `src/solver/`, `codex/solver-fixtures/`, and `docs/solver-provenance.md` — retained historical one-spot research, tests, and provenance. They are not imported by the trainer UI; the river demo is not part of the active interface or site bundle.
- `e2e/` and `src/**/*.test.ts` — unit, action-denominator, continuous-match, persistence, failure-path, mobile viewport, and browser checks.
- `.github/workflows/ci.yml` — type checks, unit tests, static build, a seeded simulation with artifacts, and Chromium smoke tests. It does not deploy.

Chips are integer units, blinds have no rake, and the game is heads-up only.

## Rollback

Revert the implementation commit on its isolated branch with `git revert <commit-sha>`. If the pull request is still unmerged, close it and delete the implementation branch. This does not change the default branch, deployment, Pages configuration, or repository settings.
