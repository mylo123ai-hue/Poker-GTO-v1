# Historical solver provenance (offline research)

## Scope and current application behavior

This document preserves the provenance and validation record for the one river spot shipped by earlier versions. The mobile trainer no longer shows that demo, loads its data, or imports the solver adapter. The retained dataset, manifest and adapter tests are research artifacts and are not included in the static Pages build.

The old adapter required an exact match to the dataset's complete state and `A♠4♠` combo to return `VERIFIED`; different boards, ranges, stack, pot, position, prior actions, bet sizes, all-in rules or combos returned `UNAVAILABLE`. Multiway, non-river and raked requests returned `UNSUPPORTED`. None of those lookups are part of live trainer decisions.

## Solver source and local correction

The data was generated with [ucsandman/postflop](https://github.com/ucsandman/postflop) at commit [`5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de`](https://github.com/ucsandman/postflop/tree/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de), dated 2026-09-02. The pinned README identifies a Rust heads-up postflop solver using Discounted CFR, a measured best-response exploitability calculation and native CLI. Its README blob is `66777e4b0fb70d30af4ec142cbee85fcaa01a90a` and its MIT license blob is `b4d61aedc881cdf35e0de23d41fac64af713a31e`.

The upstream MIT license is preserved at [`codex/third-party/ucsandman-postflop-LICENSE.txt`](../codex/third-party/ucsandman-postflop-LICENSE.txt). Its SHA-256 is `4bd581dc7a60a4ffc3f1ec5c8f3bed3a681f446eff6457e6051963e83da7066d`. No solver runtime or solver implementation is shipped in the browser. The exported scenario and manifest remain in the repository as historical research files, not site assets.

The first unmodified source test run exposed an upstream reporting bug: zero-sum `ExploitReport.gain` was set to each player's best-response payoff, although a best-response payoff can be negative and is not the player's unilateral gain. This also tripped the debug assertion in 20 tests. The local compatibility patch [`codex/patches/ucsandman-postflop-5fc7ee3-fix-zero-sum-gains.patch`](../codex/patches/ucsandman-postflop-5fc7ee3-fix-zero-sum-gains.patch) computes each gain as `BR − profile EV`, fixes the source test that encoded the incorrect assumption, and updates the associated comments. For zero-sum games it retains the historical `BR(0) + BR(1)` aggregate exploitability calculation, preserving the upstream exact fingerprints and stopping behavior. The patch SHA-256 is `e28d48c8c8532d8900b021d77077fbbbc42479a8bf0c1a7f96173985227ff04d`. The solver strategy traversal was not changed.

## Exact solver spot

The reproducible input is [`codex/solver-fixtures/river-k72-oop-a4s-v1.toml`](../codex/solver-fixtures/river-k72-oop-a4s-v1.toml), SHA-256 `0b19b11b96d15034a2d82b62180af748d2f217eddacdea9dca7878ec5a4ee436`.

| Assumption | Solved value |
| --- | --- |
| Game | Heads-up no-limit Hold'em, river-only subgame |
| Board | K♠ 7♦ 2♣ 8♥ 3♦ |
| Acting player and combo | OOP, A♠4♠ |
| OOP range | `KK,A4s,A5s` (11 live combos after board blockers) |
| IP range | `TT,JJ` (12 live combos after board blockers) |
| Range weights | Uniform among live combos in each listed range |
| Effective stack / starting pot | 20 / 10 solver chips |
| Rake | 0%, cap 0 chips |
| Prior betting history | None; solve starts at the river root |
| OOP river actions | Check, bet 100% of the 10-chip pot |
| IP river actions | Bet 100% pot after a check; raise 100% pot after a bet |
| Raise cap / all-in threshold | One raise; 67% threshold; explicit all-in sizing disabled |
| DCFR parameters | α 1.5, β 0, γ 2; exact search; no chance sampling |
| Stopping | 0.01% of pot target, at most 2,000 iterations |

The solver generated 12 tree nodes (5 decision, 0 chance, 3 fold, 4 showdown). It measured 1,008 bytes for regret and strategy storage and 0 bytes for chance maps. The selected combo is present in OOP's root range and shares no card with the board. The exporter checks every OOP and IP root combo for board conflicts and uniqueness, validates each root-combo strategy sums to 1 within `1e-5`, and requires the root actions to be exactly legal `Check` and `Bet 10 chips`.

## Solver output and accuracy limits

At OOP's root for A♠4♠ the solver's average strategy is:

| Legal action | Frequency |
| --- | ---: |
| Check | 81.23879% |
| Bet 10 chips | 18.761203% |

The static demo recommends **Check** as the highest-frequency action and displays both frequencies. The data records the solver's root range-average net EV for OOP as `−0.9090907 chips`. That value is for OOP's full 11-combo range against the solver profile; it is not A♠4♠'s combo-specific EV and it is not pot-share EV.

After 1,700 DCFR iterations, the solver measured exploitability at `0.00097221136 chips`, or `0.009722114%` of the starting pot. This reached the configured `0.01% of pot` reporting threshold. This is one finite solver profile and a measured profile metric. It is not a claim of exact equilibrium, full-game GTO, postflop coverage beyond this root decision, or accuracy against real opponents.

## Independent numerical validation

[`scripts/validateRiverSolution.ts`](../scripts/validateRiverSolution.ts) independently expands the pinned ranges, evaluates seven-card hands, enumerates the 132 compatible combo pairs and recomputes profile EV, per-combo EV, both best responses, deviation gains and exploitability for the five-node betting tree. It does not call the Rust solver or its evaluator. The sanitized pinned raw-output snapshot [`codex/solver-fixtures/river-k72-oop-a4s-v1-validation.json`](../codex/solver-fixtures/river-k72-oop-a4s-v1-validation.json) omits only measured `wall_seconds`; SHA-256 `01ced9dc2a4faf39795ff1340758ac4506e3ea1481d036c894d64f06cd0e7890`.

The independent double-precision calculation differs from the solver's `f32` values by less than `5e-7` chips for EV, gains and exploitability. The validator allows `1e-5` chips and `1e-5` percentage points, and strategy normalization uses `1e-5`; these limits exceed the observed rounding differences while remaining small relative to a chip and the configured `0.01%`-of-pot target. The selected A♠4♠ combo EV independently evaluates to `−5.00021638` chips, distinct from the `−0.9090907` full-range EV shown in the demo. This is a separate implementation check, not a proof of mathematical independence or a second equilibrium solver.

The canonical export intentionally excludes the CLI's measured `wall_seconds`; therefore two solves with the same pinned source, patch, config, toolchain and thread count produce byte-identical packaged data. The 2,185-byte JSON file [`src/solver/data/river-k72-oop-a4s-v1.json`](../src/solver/data/river-k72-oop-a4s-v1.json) has SHA-256 `d33b3bf6eeeeeecaf2c4e59ea72cdb7d7307327b4b54eb1a99a59bdf8d62078b`. The public manifest records this digest and the source config digest.

## Reproduction

With Node/npm and the Rust toolchain installed, run:

```sh
git clone https://github.com/ucsandman/postflop.git /tmp/postflop
git -C /tmp/postflop checkout --detach 5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de
npm ci
./scripts/reproduce-solver-data.sh /tmp/postflop /tmp/river-k72-reproduced.json
cmp src/solver/data/river-k72-oop-a4s-v1.json /tmp/river-k72-reproduced.json
```

The script checks the source commit, applies the checked-in local patch to a clean checkout, verifies that no other tracked source changes are present, then runs:

```sh
cargo run --release --locked -p solver-cli -- solve \
  --config codex/solver-fixtures/river-k72-oop-a4s-v1.toml \
  --report-every 100 --threads 1 --out <temporary-solver-output.json>
```

It then uses `scripts/exportSolverData.ts` to validate the solver output and write the deterministic compact JSON. Two independent exports in this run compared byte-for-byte and both hashed to `d33b3bf6eeeeeecaf2c4e59ea72cdb7d7307327b4b54eb1a99a59bdf8d62078b`.

## Other reviewed projects

Prior review of [noambrown/poker_solver](https://github.com/noambrown/poker_solver/tree/6a10442877ffc8fd28af93e16e279b9bbdd97b2a) found an MIT-licensed river solver but no packaged strategy export for this trainer. [ericgjackson/slumbot2019](https://github.com/ericgjackson/slumbot2019/tree/a74c99dd5e6e2fb50118e3990a25210e9dd0f6b3) has an MIT-licensed C++ CFR project but no verified static data matching the trainer. [Fossana/cplusplus-cfr-poker-solver](https://github.com/Fossana/cplusplus-cfr-poker-solver/tree/d1cec96ba51743b86f422875d4258e0b46a3e166) had no license declared at the time of review, so no code or output from it was used.

## Remaining risks and rollback

- Only one combo-level river decision is shipped. All other hands, ranges, positions, histories, bet trees, stack/pot sizes, rake settings, streets, live hands and simulations remain uncovered.
- The strategy and EV depend on the stated ranges and abstraction. A different opponent range, prior street, rake or sizing tree can change them.
- Earlier demo views distinguished combo frequencies from range-average EV; these historical values are not shown by the mobile trainer.
- The upstream solver is an open-source research tool. The result is solver-produced with measured exploitability, not a guarantee that either player is unexploitable in a larger game.

The POKER-MOBILE-001 change removes the demo from the active interface and bundle while retaining this provenance, source data and research tests. Reverting its implementation commit restores the prior application interface; it does not alter deployment or repository settings.
