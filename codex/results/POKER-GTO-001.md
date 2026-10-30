# POKER-GTO-001 implementation results

**Status: COMPLETED** — all bounded acceptance criteria are implemented. Solver-backed strategy coverage is deliberately zero; the handoff explicitly allows this outcome when compatible, redistributable outputs cannot be verified. No GTO accuracy claim is made.

## Handoff and delivery

- Handoff revision read in full: [`codex/handoffs/POKER-GTO-001.md`](../handoffs/POKER-GTO-001.md), commit `092536685cb54f57ffb4a1e9d8c9619db2ba04c6` on `codex/poker-gto-001-handoff`.
- Implementation branch: `codex/poker-gto-001-implementation`.
- Implementation code commit: `bf8c52fbab937cf738c666f1a8b7d53c73b759a7`.
- Pull request: [#1 — Implement POKER-GTO-001 heads-up trainer](https://github.com/mylo123ai-hue/Poker-GTO-v1/pull/1), open and unmerged, targeting `main`.
- Results path: `codex/results/POKER-GTO-001.md`.

## Acceptance evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| Static build and playable heads-up hand flow | PASS | `npm run build` succeeds. [`src/poker/engine.ts`](../../src/poker/engine.ts) implements seeded dealing, heads-up positions/blinds, legal full and short all-in sizing, all streets, folds, calls/checks, showdown/ties, and unmatched-chip refunds. `src/poker/engine.test.ts` checks deterministic deals, blind/action order, minimum raises, short all-ins, folds, showdown chip conservation, refunds, and invalid actions. |
| Four selectable opponents and live coach | PASS | Tight, Calling station, Aggressive, and Balanced profiles have separate deterministic rules in [`src/poker/ai.ts`](../../src/poker/ai.ts). The coach returns concise heuristic advice in [`src/coach/coach.ts`](../../src/coach/coach.ts). Both receive a `PlayerView` containing only the acting player's cards and public board. Browser checks confirm opponent cards remain hidden before showdown; unit tests check the private-card boundary. |
| Metrics and solver boundary | PASS | The coach is labeled `APPROXIMATE`; Monte Carlo is explicitly against a uniform random legal hand; pot odds are exact current-call arithmetic. Solver action frequencies and EV are `UNAVAILABLE` / null. [`public/solver-manifest.json`](../../public/solver-manifest.json) declares zero verified spots, and [`src/solver/adapter.ts`](../../src/solver/adapter.ts) returns `UNAVAILABLE` or `UNSUPPORTED` without fabricating values. |
| Reproducible headless reports | PASS | A 1,000-hand batch completed with seed `20261030`; two independent CLI runs produced identical game results after excluding runtime. Committed JSON, CSV, and one-page charted PDF are under [`reports/POKER-GTO-001/`](../../reports/POKER-GTO-001/). Results and hashes are below. |
| Automated tests and CI | PASS | Local typecheck, 19 unit/integration tests, production build, and 4 desktop/mobile Chromium checks passed. GitHub Actions push run #1 and PR run #2 each completed both `validate` and `browser-smoke` jobs successfully on code commit `bf8c52f`. Both uploaded `poker-gto-simulation-report` artifacts; links and digests are below. |
| GitHub Pages compatibility without deployment | PASS | Vite builds static `dist/` output with relative asset paths (`base: "./"`). The Actions workflow runs checks and uploads reports; it contains no deployment job. No Pages deployment, settings change, paid service, live API, or credential use occurred. |
| Isolated branch and unmerged pull request | PASS | Code is committed on the isolated implementation branch. PR #1 is open and unmerged. |

## Solver provenance and validated coverage

No solver code, strategy table, range, or solver output was imported. Review details are recorded in [`docs/solver-provenance.md`](../../docs/solver-provenance.md).

- [noambrown/poker_solver](https://github.com/noambrown/poker_solver/tree/6a10442877ffc8fd28af93e16e279b9bbdd97b2a): reviewed commit `6a10442877ffc8fd28af93e16e279b9bbdd97b2a`, README blob `53c0e8f9969c074f75326c9056fd99277fbcf1f0`, and MIT license blob `8267f597f1bc192076149002cb89af987de291e2`. The documented solver is river-subgame code; its JSON describes solver inputs, not a compatible, verified full-game strategy export.
- [ericgjackson/slumbot2019](https://github.com/ericgjackson/slumbot2019/tree/a74c99dd5e6e2fb50118e3990a25210e9dd0f6b3): reviewed commit `a74c99dd5e6e2fb50118e3990a25210e9dd0f6b3`, README blob `d716702c79bd349a3f785362027565cab1f27e7f`, and MIT license blob `736aa575f148fcdf673d5477d857871fa017a208`. Its documented C++ solver and generated files did not provide a validated browser-ready policy for this trainer's abstraction.
- [Fossana/cplusplus-cfr-poker-solver](https://github.com/Fossana/cplusplus-cfr-poker-solver/tree/d1cec96ba51743b86f422875d4258e0b46a3e166): reviewed commit `d1cec96ba51743b86f422875d4258e0b46a3e166`; GitHub reported no repository license, so neither its code nor outputs were used.

Trainer rules abstraction: heads-up no-limit Hold'em, two players, 100 BB starting stacks, 0.5/1 BB blinds, integer half-BB chip units, zero rake, four streets, variable effective-stack raises, and short all-ins. A short call returns unmatched excess before showdown; multiway side pots are outside this heads-up game. No solver dataset met the compatibility and verified-coverage bar. Validated solver coverage is **0 verified spots out of 8,450 simulated decisions (0%)**. Solver data SHA: **none** (`null`); solver agreement and solver EV loss: **not computed**.

## Simulation results and artifacts

Command:

```sh
npm run simulate -- --hands 1000 --seed 20261030 --p0 balanced --p1 aggressive --out reports/POKER-GTO-001
```

The reports identify code SHA `bf8c52fbab937cf738c666f1a8b7d53c73b759a7`, no solver data SHA, 100 BB starting stacks, and 1/2-chip blinds.

| Measure | Result |
| --- | ---: |
| Hands completed / failures | 1,000 / 0 |
| Runtime for committed sample | 994.0 ms |
| P0 wins / P1 wins / ties | 465 / 490 / 45 |
| Showdowns / folds | 958 / 42 |
| Average pot | 17.563 chips |
| Net chips P0 / P1 / total | +278 / −278 / 0 |
| Eligible decisions / verified spots / coverage | 8,450 / 0 / 0% |

An independent repeat with the same seed and profiles produced identical outcomes, chip results, and action counts. Runtime varied (915.3 ms and 1,027.8 ms in the two comparison runs). Frequencies are empirical behavior of the selected heuristic profiles, not solver frequencies: P0 Balanced folded 42, checked 2,745, called 1,506, and raised 166 times; P1 Aggressive folded 0, checked 2,397, called 529, and raised 1,065 times.

| Artifact | SHA-256 |
| --- | --- |
| [`summary.json`](../../reports/POKER-GTO-001/summary.json) | `e5cf49fef1a74657eb8b6c8789acb37512a5e5dc6e4c861efde9b0bb5e9899e2` |
| [`actions.csv`](../../reports/POKER-GTO-001/actions.csv) | `676c50864e05ee3f5e4f99e2c2401165c08da76c11ac312e6e1fd34baeeca826` |
| [`report.pdf`](../../reports/POKER-GTO-001/report.pdf) | `94b123ef158e14d33147f7055dd56f7e07255fe81c1979334732f7b9909be2d4` |

The PDF was confirmed as a one-page PDF and text extraction verified that seed, runtime, code/data SHA, failure count, action frequencies, zero solver coverage, and caveats are present.

## Tests and CI

| Command / run | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 5 test files, 19 tests |
| `npm run build` | PASS — static Vite build |
| `npx playwright install chromium` | PASS |
| `npm run test:e2e` | PASS — 4 tests across desktop and Pixel 7 Chromium; hand flow, hidden cards, worker simulation, and PDF download |
| Seeded 1,000-hand CLI run, repeated twice | PASS — 1,000 hands each, zero failures, deterministic game results |

GitHub Actions runs for code commit `bf8c52fbab937cf738c666f1a8b7d53c73b759a7`:

- [Run #1 — push](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40982393936): `validate` and `browser-smoke` succeeded. Uploaded artifact `poker-gto-simulation-report`, SHA-256 `65509a927d752ff8d886f6f37f36eceea331796b305aad09aec345b44e0fe9f9`.
- [Run #2 — pull request](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40982406625): `validate` and `browser-smoke` succeeded. Uploaded artifact `poker-gto-simulation-report`, SHA-256 `23034f6a02d0390aa603c095461d80e2961fbb04e17ef051fb885324b8f7dc40`.

### Resolved validation issues

- Initial short-stack testing exposed that an all-in raiser was being run out before the opponent could call or fold. The betting-round transition was corrected and covered by short-stack and chip-conservation tests.
- The first profile-distinction fixture used a weak A-2 hand and did not produce the intended seeded raise; it was replaced with a strong pocket-pair spot and controlled randomness so profile differences are tested deterministically.
- The first mobile browser project selected iPhone/WebKit while only Chromium was installed. It was changed to Pixel 7/Chromium; both desktop and mobile projects now pass.
- One verification batch overlapped `npm ci` with typecheck/test/build commands, temporarily removing modules while they ran. After the clean install completed, checks were rerun against the stable dependency tree.
- TypeScript caught an optional undealt board card in the empty-table placeholder branch. The branch was corrected; the final typecheck, build, unit tests, and browser suite all passed.

No unresolved test, simulation, or workflow failures remain.

## Risks and rollback

- The coach and four opponent profiles are authored heuristics; they are not GTO strategies. Zero solver coverage means no strategy agreement or solver EV-loss claim is available.
- The 96-sample equity display is approximate versus a uniform random legal hand, not an estimated opponent range. Simulation results measure only the selected profiles and seed.
- Rules are heads-up, zero-rake, and play-money only; the trainer resets both stacks each hand and does not model multiway pots, tournaments, or real-money play.
- To roll back before merge, close PR #1. To retain history but remove the proposal from a working branch, revert the results/artifact commit and then implementation commit (newest first). No deployment needs rollback.

## File groups

- `src/poker/` — rules, cards, deterministic shuffle, evaluator, equity estimate, and four opponents.
- `src/coach/`, `src/solver/`, `public/solver-manifest.json` — approximate coach, explicit coverage adapter, and empty verified-data manifest.
- `src/simulation/`, `scripts/simulate.ts`, `reports/POKER-GTO-001/` — worker/CLI simulation and JSON/CSV/PDF exports.
- `src/ui/`, `src/styles.css`, `index.html`, `vite.config.ts` — static responsive trainer UI.
- `src/**/*.test.ts`, `e2e/`, `.github/workflows/ci.yml` — automated checks and non-deploying CI.
- `README.md`, `docs/solver-provenance.md` — run instructions, accuracy boundaries, sources, and rollback guidance.
