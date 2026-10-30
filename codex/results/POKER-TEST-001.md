# POKER-TEST-001 Results

**Status: COMPLETED**

## Summary

Validated the existing one-spot river solver export with a separate exact enumerator, repaired three confirmed validation defects, and added regression coverage. The implementation keeps the pinned solver dataset and UI coverage at one exact demo spot; live hands and heuristic simulations remain uncovered.

Campaign elapsed about 21 minutes 49 seconds through PR CI confirmation (`2026-10-30 02:01:53–02:23:42 UTC`), within the four-hour limit. No connected GitHub Test Lab tool was available in this session, so validation used local runs and the repository's existing GitHub Actions workflow.

## Handoff and baseline

- Read the complete handoff `codex/handoffs/POKER-TEST-001.md` from commit `f73987109360274771c7a95f62255536d1ae8ed6`.
- The handoff commit's parent is the pinned app code baseline `39cc24fde9380e8612e340953f8f0a8d16922ecd` on `codex/poker-gto-002-implementation`.
- The current task 002 branch head when this campaign began was `34c4c4fc40e5a1255e7615864316ee9e705403ff`; compared with the required baseline it adds only `codex/results/POKER-GTO-002.md`. That later report commit was preserved as the new branch base.
- Implementation branch: `codex/poker-test-001-implementation`.
- Implementation commit: `343363450ef7d8ac8e845404c6bdf986286f299d`.
- PR: [#3 — Validate and harden the river solver integration](https://github.com/mylo123ai-hue/Poker-GTO-v1/pull/3), targeting `codex/poker-gto-002-implementation`; open and unmerged.

## Findings and repairs

1. **Exporter trusted unrelated config provenance.** At baseline commit `39cc24f`, exporting a valid raw solve with a different file containing `effective_stack = 999` exited successfully and wrote that unrelated file's SHA-256 (`d3b40693f36b978216144dc28283f25d9a5621421dff331a4f7383f4a1241486`) as the solver input provenance. The exporter now pins the config bytes to the documented fixture SHA-256 and rejects a mismatch.
2. **Exporter trusted stale numerical metadata and skipped downstream strategies.** The baseline exporter accepted root EV `[123, -123]` and a node 9 strategy probability of `−0.25`, exiting successfully. The new validator checks all five decision nodes, every combo's probability simplex, the exact range expansions and tree, independently recomputed profile and combo EV, best-response values, deviation gains, exploitability, percentage-of-pot arithmetic, and the convergence threshold.
3. **Sparse arrays bypassed exact adapter matching.** `Array.every` skips holes, so `board: Array(5)` and `oopRiverBetPercent: Array(1)` both returned `VERIFIED` at baseline. The adapter now checks that each expected index is an own array property and equals the pinned value. Regression tests confirm both requests return `UNAVAILABLE`.
4. **No solver data leaked into live hands or heuristic simulations.** Browser checks now assert that the live coach remains `APPROXIMATE` / `NOT SOLVER VERIFIED`, the current preflop live lookup is `UNSUPPORTED`, and the simulation lab explains that the separate demo is not used by simulations. Simulation coverage remains 0.

The validator is a separate implementation of standard seven-card ranking and the documented river tree. It is an independent numerical cross-check, not a formal proof of mathematical independence or a second equilibrium solver.

## Pinned source and reproducibility

- Solver source: [`ucsandman/postflop`](https://github.com/ucsandman/postflop), exact commit `5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de`, engine `0.1.0`, MIT license. Preserved license SHA-256: `4bd581dc7a60a4ffc3f1ec5c8f3bed3a681f446eff6457e6051963e83da7066d`.
- The checked-in compatibility patch SHA-256 is `e28d48c8c8532d8900b021d77077fbbbc42479a8bf0c1a7f96173985227ff04d`; it fixes upstream zero-sum deviation-gain reporting while retaining historical aggregate exploitability arithmetic. Strategy traversal is unchanged.
- Solver input fixture SHA-256: `0b19b11b96d15034a2d82b62180af748d2f217eddacdea9dca7878ec5a4ee436`.
- Packaged dataset SHA-256: `d33b3bf6eeeeeecaf2c4e59ea72cdb7d7307327b4b54eb1a99a59bdf8d62078b`.
- Sanitized pinned raw-solve reference snapshot SHA-256: `01ced9dc2a4faf39795ff1340758ac4506e3ea1481d036c894d64f06cd0e7890`; it omits only the nondeterministic `wall_seconds` field.
- Toolchain: rustc `1.99.1 (58cf8f9c3 2026-10-13)`, Cargo `1.99.1 (5f94df478 2026-08-27)`.

Reproduced from a clean detached worktree at the pinned solver commit with:

```sh
./scripts/reproduce-solver-data.sh /tmp/POKER-TEST-001-postflop /tmp/POKER-TEST-001-reproduced.json
cmp src/solver/data/river-k72-oop-a4s-v1.json /tmp/POKER-TEST-001-reproduced.json
```

The clean worktree was patched only with the checked-in patch. Release compilation took 28.74 seconds; the solve took 0.0071 seconds. Two independent raw runs matched exactly after omitting `wall_seconds`; the exported JSON matched the checked-in 2,185-byte dataset byte-for-byte.

## Independent numerical validation

The reference code expands `KK,A4s,A5s` to 11 live OOP combos and `TT,JJ` to 12 live IP combos, checks 132 compatible combo pairs, and verifies the pinned five-decision-node tree (5 decision, 0 chance, 3 fold, 4 showdown nodes). It independently ranks every seven-card hand and evaluates fold/showdown payoffs for the stated pot, stack, and action branches.

| Quantity | Independent reference | Pinned solver output |
| --- | ---: | ---: |
| OOP root range-average net EV | −0.9090905414 chips | −0.9090907 chips |
| IP root range-average net EV | +0.9090905414 chips | +0.9090903 chips |
| OOP best-response value | −0.9089332286 chips | Independently computed from the full strategy |
| IP best-response value | +0.9099054107 chips | Independently computed from the full strategy |
| OOP deviation gain | +0.0001573128 chips | +0.0001577139 chips |
| IP deviation gain | +0.0008148693 chips | +0.0008149147 chips |
| Exploitability | 0.0009721822 chips / 0.0097218217% pot | 0.00097221136 chips / 0.009722114% pot |
| Maximum action-probability sum error | 1.0188e-7 | Export tolerance is 1e-5 |

The largest observed difference from solver `f32` EV/gain/exploitability values was about `4.01e-7` chips. The reference allows `1e-5` chips and `1e-5` percentage points; normalization tolerance is `1e-5`. These tolerances exceed the measured floating-point accumulation difference while staying small relative to a chip and the configured `0.01%`-of-pot stopping target.

For the selected A♠4♠ combo, independently evaluated OOP EV is `−5.00021638` chips. It differs from the `−0.9090907` root range-average EV. The packaged combo strategy remains Check `81.23879%`, Bet 10 chips `18.761203%`; the UI labels the EV as range-average and does not present a combo EV.

Measured exploitability across the CLI's 100-iteration reports was not monotone. It first reached the `0.01%`-of-pot target at iteration 1,700 (`0.0097%`); at iteration 1,600 it was `0.0261%`. This validates the recorded stopping point for this finite profile, not convergence to an exact equilibrium or full-game GTO.

## Tests and evidence

- `npm run typecheck`: passed.
- `npm test`: 27 passed across 7 files, including independent EV/BR arithmetic, exporter failure paths, sparse-array rejection, and existing simulation/rules regressions.
- `npm run build`: passed; Vite transformed 288 modules.
- `npm run test:e2e`: 4 passed across desktop Chromium and mobile Chromium, including the solver demo, live coach, simulation disclosure, and seeded worker batch.
- `cargo test --release --locked --workspace` at the pinned patched solver source: 160 passed, 0 failed, 3 intentionally ignored (143 engine, 5 fingerprint, 5 locking, 1 milestone, 6 CLI tests). Two large evaluator checks and the full-flop solve remain ignored upstream; the latter documents minutes and about 1.5 GB memory use.
- `cargo test --offline --locked -p engine gains_are_deviation_values_in_the_chip_game`: passed with debug assertions enabled.
- Two `npm run simulate -- --hands 1000 --seed 20261030 --p0 balanced --p1 aggressive ...` runs at code SHA `343363450ef7d8ac8e845404c6bdf986286f299d` matched after excluding runtime. Each completed 1,000 hands with 0 failures; outcomes were 465/490 wins and 45 ties, net chips 0, 8,450 decisions, and 0 solver-covered decisions. Action/report files differ only in runtime fields or generated PDF metadata.

Resolved test/harness issues:

- Initial typecheck found a stale `RootCombo` type name after exporter types moved to the independent validator; it was replaced with the shared `SolverCombo` type.
- An initial test changed node 1 to a 50/50 mix and expected the root EV to change. Independent evaluation showed that mix is payoff-invariant in this exact range/tree, so the test was corrected to alter the reachable node 6 strategy and now verifies stale EV rejection.
- The first browser assertion matched multiple `APPROXIMATE` labels; it now selects the live coach badge. A following assertion expected an unavailable-text reason, but the preflop live state is correctly `UNSUPPORTED`; it now checks the actual reason. Final desktop/mobile runs passed.

GitHub Actions PR run [#40991323033](https://github.com/mylo123ai-hue/Poker-GTO-v1/actions/runs/40991323033) for implementation commit `343363450ef7d8ac8e845404c6bdf986286f299d` succeeded. Both `validate` and `browser-smoke` jobs passed.

- [`poker-gto-simulation-report` artifact](https://api.github.com/repos/mylo123ai-hue/Poker-GTO-v1/actions/artifacts/12949297554/zip): 3,434 bytes; SHA-256 `e23d23590cbacdde2dded58a56802573987d23713357781aedafc3656d7d241f`.
- [`poker-gto-browser-report` artifact](https://api.github.com/repos/mylo123ai-hue/Poker-GTO-v1/actions/artifacts/12948759671/zip): 210,964 bytes; SHA-256 `755a53c91da1f948dcf647c38dc8e67de4ed39ccaba031d8c27f40040982b50e`.

## Changed files

- `scripts/validateRiverSolution.ts`, `scripts/exportSolverData.ts`, and `codex/solver-fixtures/river-k72-oop-a4s-v1-validation.json` add independent pinned-snapshot validation and strengthen export checks.
- `src/solver/validateRiverSolution.test.ts`, `src/solver/exporter.test.ts`, and `src/solver/adapter.test.ts` cover numerical, provenance, exporter, and exact-match failure paths.
- `src/solver/adapter.ts` fixes sparse-array matching; `e2e/trainer.spec.ts` checks live and simulation solver boundaries.
- `docs/solver-provenance.md` records the independent reference method, tolerance, and snapshot.
- `codex/results/POKER-TEST-001.md` publishes this report.

## Limitations and rollback

The validation is specific to one unweighted, zero-rake river tree with no chance nodes. The reference calculations confirm the pinned exported profile and arithmetic; they do not certify other ranges, streets, action trees, opponent models, or exact equilibrium. The three ignored upstream tests were not run. No confirmed in-scope defect remains unresolved.

Rollback by reverting implementation commit `343363450ef7d8ac8e845404c6bdf986286f299d` and the subsequent results-only commit on `codex/poker-test-001-implementation`. The task 002 base branch and its published report remain unchanged. No paid API, credential inspection, HAL/VPS access, repository setting change, merge, or deployment was performed.

## Publication

- Results path: `codex/results/POKER-TEST-001.md`.
- Implementation branch: `codex/poker-test-001-implementation`.
- Implementation commit: `343363450ef7d8ac8e845404c6bdf986286f299d`.
- Pull request: [#3 — Validate and harden the river solver integration](https://github.com/mylo123ai-hue/Poker-GTO-v1/pull/3), open and unmerged.
