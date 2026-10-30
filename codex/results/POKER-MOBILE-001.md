# POKER-MOBILE-001 results

**Status: COMPLETED** — all handoff acceptance criteria passed in local validation and the implementation PR checks.

## Handoff and delivery

- Authoritative handoff: [`codex/handoffs/POKER-MOBILE-001.md`](../handoffs/POKER-MOBILE-001.md), read from branch `codex/poker-mobile-001-handoff` at `191e759f8196ab1620d4f0c1aeccb1c7154b36d0`.
- Base at handoff creation: `770b7e717322f1bda3467019c16cab0f3636d18d`.
- Implementation branch: `codex/poker-mobile-001-implementation`.
- Implementation commit: `5689ca44921bd73dc6781dbfaad268a9e2f18bb1` (`feat: build mobile-first poker practice trainer`).
- Simulation-artifact commit: `5b7cae1514d46eebbc1af4bc090e6d48ff0af1fa` (`test: archive reproducible poker simulations`).
- Follow-up regression-test commit: `5a0b156c6a6e3861a2d61723ff69e5d326ee3d79` (`test: cover match reset and position metrics`).
- Pull request: [#4 — feat: build mobile-first heads-up poker trainer](https://github.com/mylo123ai-hue/Poker-GTO-v1/pull/4), targeting `main`; open and unmerged at publication.

## Acceptance evidence

| Handoff criterion | Status | Evidence |
| --- | --- | --- |
| Continuous legal heads-up matches through elimination, with carried stacks, alternating button/blinds, all-ins, settlement, ties, and chip conservation | **PASS** | `src/poker/engine.test.ts` covers configurable/short blinds, invalid and short all-in raises, short-stack runout, refunds, ties and conservation. `src/poker/match.test.ts` covers stack carry, button/action order, settings and elimination. Unit and browser tests verify a new match resets to hand 001 while retaining completed-hand history. The repeated seeded tournament below completed 10/10 matches over 231 hands with no failures and conserved chips. |
| Mobile-first play controls and responsive table, without blocking coaching or horizontal overflow | **PASS** | `e2e/trainer.spec.ts` exercises keyboard action, touch-sized controls, and 320×640, 390×844, 768×1024 and 1366×900 layouts. Every viewport kept the document free of horizontal overflow and the call target at least 44px high. The final phone layout was visually inspected after removing a sticky-panel overlap. |
| Four heuristic opponents, privacy-limited guidance, and recovery from a stalled opponent | **PASS** | Existing four profiles remain; `src/poker/ai.test.ts` checks deterministic, view-limited decisions. Browser tests confirm opponent cards stay hidden before showdown, refresh resumes an interrupted hand, corrupt storage recovers, and the stalled-opponent retry completes. |
| Beginner, Practice and Challenge coaching; pot odds, made-hand category, contextual and bet-size guidance, equity estimate, history/replay | **PASS** | `src/coach/coach.test.ts` checks approximate-only labeling, exact call-price pot odds, made-hand context, reproducible equity sampling and uncertainty bounds. Browser tests exercise all coaching modes, post-hand comparison and replay while opponent cards remain hidden before showdown. |
| Sample-aware player metrics, progress, position splits and common-leak prompts | **PASS** | `src/poker/persistence.test.ts` checks VPIP/PFR, 3-bet, c-bet/fold-to-c-bet denominators, aggression, WTSD, W$SD share, BB/100, position splits, zero-sample nulls and the 20-hand prompt threshold. Data stays in bounded local storage; no telemetry is added. |
| Remove the fixed solver demo from the active UI and runtime; state the accuracy boundary honestly | **PASS** | The demo component and public manifest are removed from the active app/site. Its manifest was moved unchanged to `codex/solver-fixtures/`; historical solver source, license, data, provenance and adapter tests remain. `scripts/checkPagesBuild.mjs` rejects solver-adapter/demo identifiers in built browser assets. The UI, coach and reports identify guidance as heuristic/approximate and make no solver-backed or optimal-play claim. |
| Produce a GitHub Pages-compatible static build and document its limits | **PASS** | Vite uses `base: "./"`; `npm run build` and `npm run check:pages-build` pass and verify relative assets, the simulation worker, and absence of the retired demo asset. Deployment and Pages settings were not touched. |
| Run regression tests and reproducible synthetic simulations; publish the report and one unmerged PR | **PASS** | All local commands below pass. GitHub Actions push and pull-request runs at `5b7cae1514d46eebbc1af4bc090e6d48ff0af1fa` both concluded successfully. PR #4 is open and unmerged; this report and the two JSON simulation artifacts are on its implementation branch. |

## Automated test results

All commands ran from the repository root on the implementation tree. The latest full local run used implementation commit `5689ca44921bd73dc6781dbfaad268a9e2f18bb1` plus regression-test commit `5a0b156c6a6e3861a2d61723ff69e5d326ee3d79`; the simulation-artifact commit only adds JSON evidence.

| Command | Result |
| --- | --- |
| `npm run typecheck` | **PASS** — TypeScript completed without errors. |
| `npm test -- --reporter=dot` | **PASS** — 9 test files, 39 tests. |
| `npm run build` | **PASS** — 288 modules transformed; relative asset bundle and worker emitted. |
| `npm run check:pages-build` | **PASS** — relative JS/CSS paths, simulation worker present, retired demo asset absent. |
| `npm run test:e2e` | **PASS** — 14 tests across desktop Chromium and Pixel 7 emulation, including keyboard, mobile sizes, local-storage corruption, match elimination, coaching, replay, AI retry and simulation export. |

GitHub Actions passed both jobs (`validate`, `browser-smoke`) for both the initial implementation/artifact head and the follow-up reset/metrics regression-test head:

- Push run: [40998610492](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40998610492) — success.
- Pull-request run: [40998629628](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40998629628) — success.
- Follow-up push run: [40999036112](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40999036112) — success at `5a0b156c6a6e3861a2d61723ff69e5d326ee3d79`.
- Follow-up pull-request run: [40999040930](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40999040930) — success at `5a0b156c6a6e3861a2d61723ff69e5d326ee3d79`.

## Reproducible simulations and artifacts

### Continuous matches

Ran twice with the same arguments and compared the raw JSON byte-for-byte:

```sh
npm run simulate:matches -- --matches 10 --seed 20261030 --stack 40 --small-blind 1 --big-blind 2 --p0 balanced --p1 aggressive --out /tmp/poker-mobile-match-5689-a.json
npm run simulate:matches -- --matches 10 --seed 20261030 --stack 40 --small-blind 1 --big-blind 2 --p0 balanced --p1 aggressive --out /tmp/poker-mobile-match-5689-b.json
cmp -s /tmp/poker-mobile-match-5689-a.json /tmp/poker-mobile-match-5689-b.json
```

Both runs completed 10/10 matches and 231 hands, with P0 winning 6, P1 winning 4, an average 23.1 hands to elimination, `chipsConserved: true`, and no failures. The compared artifact SHA-256 is `70071b018c1c65bdbd58b97312d67d3fc518ec4098c0650a6e264703d3ed1907`.

### Existing per-hand heuristic simulation

```sh
npm run simulate -- --hands 1000 --seed 20261030 --p0 balanced --p1 aggressive --out /tmp/poker-mobile-hands-5689ca4
```

Completed 1,000/1,000 hands with zero failures and total net chips of zero. Outcomes were 465 P0 wins, 490 P1 wins and 45 ties. The output records implementation `codeSha` `5689ca44921bd73dc6781dbfaad268a9e2f18bb1`; its runtime was about 2.04 seconds in this run.

Committed evidence:

- [`codex/results/artifacts/POKER-MOBILE-001-match-simulation.json`](artifacts/POKER-MOBILE-001-match-simulation.json) — SHA-256 `70071b018c1c65bdbd58b97312d67d3fc518ec4098c0650a6e264703d3ed1907`.
- [`codex/results/artifacts/POKER-MOBILE-001-hand-simulation-summary.json`](artifacts/POKER-MOBILE-001-hand-simulation-summary.json) — SHA-256 `ffe22e414d39426c321cd88554c8aceec3f74859dafd61a030fc2e6ac96a2016`.

These simulations describe the seeded authored heuristics. They do not measure expected value against a solver, exploitability, equilibrium convergence or strategy quality.

## Solver provenance and coverage boundary

No solver was run, integrated into live decisions, or used to grade the trainer in this task. The mobile trainer has **zero solver-backed live spots** and makes no GTO accuracy claim. Historical research remains separate from the application: the one preserved river fixture was generated with MIT-licensed `ucsandman/postflop` at pinned commit `5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de`; the historical compact data SHA-256 is `d33b3bf6eeeeeecaf2c4e59ea72cdb7d7307327b4b54eb1a99a59bdf8d62078b`. Its configuration, local compatibility patch and license digests are recorded in [`docs/solver-provenance.md`](../../docs/solver-provenance.md). The older one-spot research coverage must not be read as trainer coverage.

## Changes and development findings

- Added configurable continuous match state, legal heads-up blind/action transitions, stack carry, deterministic match simulation, replayable local session recovery, bounded history, sample-aware statistics and lightweight heuristic coaching.
- Reworked the active trainer and styles for small screens through desktop; kept the simulation lab and four opponent profiles.
- Removed the active solver demo component and public manifest, relocating the unchanged manifest to the historical fixtures. Removed solver metadata from heuristic simulation reports and bumped their schema to version 2.
- Added unit and Playwright regression coverage, a Pages-build guard, and CI steps for path validation and seeded match runs. Updated README and historical solver documentation to distinguish research artifacts from app behavior.
- Visual review found the mobile sticky action panel obscured the table's pot/cards; switching it to normal page flow fixed the overlap. An early tie-test fixture had a 3-chip accounting mismatch; the fixture was corrected to represent its four committed chips. A VPIP test initially counted a big-blind check as voluntary entry; that expectation was corrected to match VPIP's definition. The first reset browser assertion expected `MATCH 02`; it was corrected because the default practice match is already counted, and both desktop and mobile reset checks now pass. All final suites pass.

## Risks and limitations

- Opponent and coach actions are authored heuristics. The 96-trial equity tool samples a uniformly random legal opponent hand and reports an approximate sampling range; it does not use a profile-specific range or future-street model.
- Statistics and leak prompts are descriptive and noisy at small samples. They are not diagnoses or quality grades. At most 500 hands, 2,000 own decisions and 100 match results are retained locally.
- The app is client-only. Browser storage and seeded game state can be inspected or changed by the local user; there is no backend, account, telemetry, or cryptographic secrecy. UI and coaching views conceal opponent hole cards until showdown.
- The game is heads-up, uses integer play-money chips and has no rake. Responsive behavior was tested in Chromium/Pixel emulation, not on physical iOS or Android devices. The static path was verified without deploying a site.

## Rollback and publication state

The PR remains open and unmerged; no deployment, Pages enablement, repository setting, credential or security change was made. To discard the proposal before merge, close PR #4 and delete branch `codex/poker-mobile-001-implementation`; `main` remains unchanged. If a revert is preferred on the branch, revert the implementation commit `5689ca44921bd73dc6781dbfaad268a9e2f18bb1` and the simulation-artifact commit `5b7cae1514d46eebbc1af4bc090e6d48ff0af1fa` (plus the later results-publication commit containing this file).
