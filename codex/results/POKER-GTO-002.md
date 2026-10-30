# POKER-GTO-002 Results

**Status: COMPLETED**

## Summary

Added one independently reproducible, MIT-sourced river decision to a separate solver demo in the browser trainer. The demo shows the exact board, ranges, action tree, combo, action frequencies, highest-frequency action, range-average EV, measured exploitability, provenance, and limitations. It does not supply solver advice to arbitrary live hands or heuristic simulations. The solver adapter remains fail-closed for every unmatched state.

## Handoff criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| One legally sourced, reproducible postflop solver decision | Pass | Pinned `ucsandman/postflop` commit, MIT license, local patch, input fixture, exporter, and deterministic output are recorded below and in [`docs/solver-provenance.md`](../../docs/solver-provenance.md). |
| Real action frequencies and EV with correct scope | Pass | The exact OOP A♠4♠ river decision has two legal actions and the root range-average net EV is labeled as such. The UI does not present it as combo-specific EV. |
| Exact state match and no extrapolation | Pass | One verified demo spot. A different combo, board, range, stack, pot, history, sizing, rake, or unsupported game variant is unavailable or unsupported. Live and simulation decision coverage remains zero. |
| Probability, legality, blockers, provenance, and determinism checks | Pass | Adapter tests validate these properties; independent solver runs and a clean pinned-checkout reproduction produced the same dataset checksum. |
| Existing application regressions and browser coverage | Pass | Typecheck, unit tests, production build, seeded simulations, and desktop/mobile browser checks passed locally and in GitHub Actions. |
| Open unmerged PR and published results | Pass | Branch `codex/poker-gto-002-implementation`; PR [#2](https://github.com/mylo123ai-hue/Poker-GTO-v1/pull/2) is open and unmerged. This report is published on that branch. |

## Solver provenance and solved spot

- Source: [`ucsandman/postflop`](https://github.com/ucsandman/postflop), commit [`5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de`](https://github.com/ucsandman/postflop/tree/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de), dated 2026-09-02; native Rust heads-up postflop DCFR solver, engine version `0.1.0`.
- License: MIT. The pinned license blob is `b4d61aedc881cdf35e0de23d41fac64af713a31e`; the preserved license file SHA-256 is `4bd581dc7a60a4ffc3f1ec5c8f3bed3a681f446eff6457e6051963e83da7066d`. The pinned README blob is `66777e4b0fb70d30af4ec142cbee85fcaa01a90a`.
- Compatibility correction: upstream's zero-sum `ExploitReport.gain` incorrectly stored best-response payoffs rather than unilateral gains. The checked-in patch computes `BR − profile EV` for each player and preserves historical zero-sum aggregate `BR(0) + BR(1)` arithmetic so exploitability fingerprints and stopping behavior remain stable. Strategy traversal was not changed. Patch SHA-256: `e28d48c8c8532d8900b021d77077fbbbc42479a8bf0c1a7f96173985227ff04d`.
- Input fixture: [`codex/solver-fixtures/river-k72-oop-a4s-v1.toml`](../solver-fixtures/river-k72-oop-a4s-v1.toml), SHA-256 `0b19b11b96d15034a2d82b62180af748d2f217eddacdea9dca7878ec5a4ee436`.
- Solved state: river board K♠ 7♦ 2♣ 8♥ 3♦; OOP to act with A♠4♠; OOP range `KK,A4s,A5s` (11 live combos), IP range `TT,JJ` (12 live combos), uniform live-combo weights; 20-chip effective stack, 10-chip pot, no rake, no prior actions. OOP can check or bet 100% pot; IP can bet 100% pot after a check or raise 100% pot after a bet; one raise maximum. Explicit all-in sizing is disabled with a 67% all-in threshold.
- Solve: DCFR α=1.5, β=0, γ=2; exact search without chance sampling; stop at 0.01% of pot, maximum 2,000 iterations. It stopped at 1,700 iterations after measuring exploitability `0.00097221136` chips (`0.009722114%` of the 10-chip starting pot). This is a finite solver profile and measured profile metric, not an exact-equilibrium or full-game GTO claim.
- Tree/resource measurements: 12 nodes (5 decision, 0 chance, 3 fold, 4 showdown), 1,008 bytes of regret/strategy storage, and 0 bytes of chance maps. On the final clean-checkout reproduction, release compilation took 14.72 seconds and the solve itself took 0.0081 seconds. The native solver is not shipped in the browser.

The OOP root strategy for A♠4♠ is **Check 81.23879%** and **Bet 10 chips 18.761203%**; the demo recommends Check as the higher-frequency action. OOP's root range-average net EV is **−0.9090907 chips** for the full 11-combo range. It is not A♠4♠'s combo-specific EV, pot-share EV, or a prediction against a real opponent.

The static JSON dataset is 2,185 bytes with SHA-256 `d33b3bf6eeeeeecaf2c4e59ea72cdb7d7307327b4b54eb1a99a59bdf8d62078b`. The manifest records one verified demo spot, while live-hand and simulation coverage are both zero. The production build's main JavaScript bundle is 270,840 bytes (84,506 bytes gzip), CSS is 22,712 bytes, and the solver data is 2,185 bytes.

## Reproduction

The committed script checks out the pinned source revision, applies and verifies the exact local patch, runs the solver CLI, validates its output, and exports canonical JSON while excluding nondeterministic wall time:

```sh
git clone https://github.com/ucsandman/postflop.git /tmp/postflop
git -C /tmp/postflop checkout --detach 5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de
npm ci
./scripts/reproduce-solver-data.sh /tmp/postflop /tmp/river-k72-reproduced.json
cmp src/solver/data/river-k72-oop-a4s-v1.json /tmp/river-k72-reproduced.json
```

The offline toolchain used rustc `1.99.1` and Cargo `1.99.1`. Two independent solver exports and a fresh pinned-checkout replay compared byte-for-byte and yielded the dataset SHA-256 above.

## Tests, failures, and repairs

- `npm run typecheck`: passed.
- `npm test`: 21 tests passed across 5 files.
- `npm run build`: passed. Vite transformed 288 modules.
- `npm run test:e2e`: 4 desktop/mobile checks passed.
- `cargo test --release --locked --workspace` at the pinned solver source with the documented patch: 160 passed, 0 failed, 3 intentionally ignored. This includes 143 engine tests, 5 fingerprint tests, 5 locking tests, 1 milestone test, and 6 CLI integration tests. Two expensive evaluator checks and the full-flop solve are ignored upstream; the latter documents minutes and about 1.5 GB memory use.
- `cargo test --offline --locked -p engine gains_are_deviation_values_in_the_chip_game`: passed with debug assertions enabled.
- Two 1,000-hand simulations with seed `20261030`, profiles `balanced` and `aggressive`, and code SHA `39cc24fde9380e8612e340953f8f0a8d16922ecd` matched after excluding runtime. Both completed 1,000 hands with 0 failures, 465/490/45 wins/losses/ties, net chips 0, 8,450 decisions, and 0 solver-covered decisions. The solver dataset was not used by either simulation.

Resolved issues during validation:

1. The unmodified upstream debug suite first reported 20 failures (124 passed, 2 ignored), all caused by the incorrect zero-sum gain assertion. The local patch corrected the gain calculation and added a regression test.
2. An intermediate patch summed the corrected gains for zero-sum exploitability and changed exact fingerprint outputs through `f32` rounding. The final patch retains upstream's historical `BR(0) + BR(1)` aggregate while separately computing true individual gains; fingerprints then passed.
3. The first browser run had two failures because the text locator for “Check” matched both the recommendation and action list. The assertion is now scoped to the legal action list; desktop and mobile checks pass.
4. After formatting the local solver patch with zero context to keep repository whitespace checks clean, a clean replay showed `git apply` needs `--unidiff-zero`. The reproduction script now supplies that flag; a clean pinned checkout reproduced the expected checksum.

## GitHub Actions and artifacts

PR validation run [#40986665591](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40986665591) for code commit `39cc24fde9380e8612e340953f8f0a8d16922ecd` succeeded. Both `validate` and `browser-smoke` jobs passed, including typecheck, unit tests, build, seeded 1,000-hand simulation, and Playwright desktop/mobile checks.

- [`poker-gto-simulation-report` artifact](https://api.github.com/repos/mylo123ai-hue/Poker-GTO-v1/actions/artifacts/12947755615/zip): 3,442 bytes; SHA-256 `be2e61757afdffbaa365247dac54f507d1a6a343dbc03ec2366008df478112c1`.
- [`poker-gto-browser-report` artifact](https://api.github.com/repos/mylo123ai-hue/Poker-GTO-v1/actions/artifacts/12946988522/zip): 221,064 bytes; SHA-256 `221d16a4c9926e0c3c15173711283da8a7498e48523c18e1998effbdcd4cf39e`.

## Changed files

- UI: `src/ui/SolverDemo.tsx`, `src/ui/App.tsx`, `src/styles.css`.
- Solver matching and tests: `src/solver/adapter.ts`, `src/solver/adapter.test.ts`, `src/solver/data/river-k72-oop-a4s-v1.json`, `public/solver-manifest.json`.
- Reproducibility and provenance: `scripts/exportSolverData.ts`, `scripts/reproduce-solver-data.sh`, `codex/solver-fixtures/river-k72-oop-a4s-v1.toml`, `codex/patches/ucsandman-postflop-5fc7ee3-fix-zero-sum-gains.patch`, `codex/third-party/ucsandman-postflop-LICENSE.txt`, `docs/solver-provenance.md`, `README.md`.
- Coverage and browser reporting: `src/simulation/simulate.ts`, `src/simulation/simulationReport.ts`, `e2e/trainer.spec.ts`, `playwright.config.ts`, and the `solver:export` package script.

## Risks, extension, and rollback

Coverage is intentionally narrow: one exact combo decision in one zero-rake river subgame. Ranges, blockers, action sizes, position, prior history, and stack/pot assumptions affect the result. The measured exploitability applies to the exported finite profile and abstraction; it does not certify full-game equilibrium. The range-average EV and combo action frequencies have different scopes, which the UI labels.

To extend coverage, solve and independently validate additional explicit fixtures, then add exact state matching and a separate coverage count for each supported spot. Do not broaden lookup beyond validated states.

Rollback by reverting the task 002 implementation commit `66a6a301f60529f3c127ea84c652d28214f6fc60` and the subsequent results-only commit on `codex/poker-gto-002-implementation`. This removes the solver demo, static data, adapter coverage, and local solver patch without changing the task 001 base branch. No merge, Pages deployment, repository setting change, paid service, or credential access was performed.

## Branch and pull request

- Handoff read in full from `codex/handoffs/POKER-GTO-002.md` at exact commit `e92afc39f07f6ad40ca32bf04885c1b651df0247`.
- Implementation branch: `codex/poker-gto-002-implementation`.
- Implementation code commit: `66a6a301f60529f3c127ea84c652d28214f6fc60`.
- PR head when CI ran: `39cc24fde9380e8612e340953f8f0a8d16922ecd`.
- Pull request: [#2 — Add one verified solver-backed river demo](https://github.com/mylo123ai-hue/Poker-GTO-v1/pull/2), targeting `codex/poker-gto-001-implementation`; open and unmerged.
- Results path: `codex/results/POKER-GTO-002.md`.
