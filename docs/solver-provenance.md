# Solver provenance and coverage

## What this application ships

There is no solver binary, strategy dataset, solver range, action-frequency table, or solver expected-value data in this repository. [`public/solver-manifest.json`](../public/solver-manifest.json) is the versioned manifest and declares zero verified spots. `lookupSolverSpot` returns `UNAVAILABLE` for an otherwise supported spot and `UNSUPPORTED` outside the documented abstraction. Neither response contains invented frequencies or values.

The live coach and four opponents use authored heuristics. The coach labels its advice `APPROXIMATE`; the opponent profiles describe behavior, not equilibrium strategies. The equity display uses deterministic Monte Carlo samples against a *uniform random legal hand* and never reads the actual opponent cards. The sample count and model are shown beside the estimate.

## Solver projects reviewed

The following public projects were reviewed on 2026-10-30. Their code was not copied into this browser application and no strategy output was imported.

| Project | License and verified description | Integration decision |
| --- | --- | --- |
| [noambrown/poker_solver](https://github.com/noambrown/poker_solver/tree/6a10442877ffc8fd28af93e16e279b9bbdd97b2a) | Inspected repository commit `6a10442877ffc8fd28af93e16e279b9bbdd97b2a`; README blob `53c0e8f9969c074f75326c9056fd99277fbcf1f0`; MIT license blob `8267f597f1bc192076149002cb89af987de291e2`. README describes a no-limit Texas Hold'em **river subgame** solver with CFR variants, Python reference code, and optimized C++. | Its documented JSON is a solver *input* containing board, pot, stack, bet sizes, and weighted hand ranges; it is not a packaged, browser-ready solved strategy export. The river-only scope does not verify full-game hand coverage, so the source is not connected to the browser coach. |
| [ericgjackson/slumbot2019](https://github.com/ericgjackson/slumbot2019/tree/a74c99dd5e6e2fb50118e3990a25210e9dd0f6b3) | Inspected repository commit `a74c99dd5e6e2fb50118e3990a25210e9dd0f6b3`; README blob `d716702c79bd349a3f785362027565cab1f27e7f`; MIT license blob `736aa575f148fcdf673d5477d857871fa017a208`. README describes CFR+/MCCFR, multiple betting/card abstractions, endgame resolving, and C++ build instructions. | The README documents generated files and C++ run commands, but not a compact, static strategy export that matches the trainer's 100 BB game. No compatible strategy package was validated for redistribution, so the solver is not integrated. |
| [Fossana/cplusplus-cfr-poker-solver](https://github.com/Fossana/cplusplus-cfr-poker-solver/tree/d1cec96ba51743b86f422875d4258e0b46a3e166) | Inspected default-branch commit `d1cec96ba51743b86f422875d4258e0b46a3e166`; GitHub repository metadata reported no license (`license: null`) when checked. | No license grant was found, so neither code nor outputs were used. |

License references: [noambrown/poker_solver LICENSE](https://github.com/noambrown/poker_solver/blob/main/LICENSE) and [ericgjackson/slumbot2019 LICENSE](https://github.com/ericgjackson/slumbot2019/blob/master/LICENSE). A repository's code license does not automatically establish the license or accuracy of a separately produced strategy dataset. The project therefore makes no GTO claim based on either source.

## Rules abstraction and unsupported spots

The trainer models heads-up no-limit Hold'em, two players, 100 BB starting effective stacks, 0.5/1 BB blinds, integer half-BB chip units, zero rake, all four streets, arbitrary effective-stack raises, and short all-ins. If a call is shorter than an unmatched wager, excess chips are returned before showdown; multiway side pots do not arise in a two-player game. Each hand resets to the configured starting stacks. The current engine and authored opponent profiles do not simulate multiway pots, rake, tournaments, or real-money play.

The solver adapter intentionally has no usable spot rows today. If a future licensed dataset is added, its provenance, solver version, parameters, stack depth, rake, betting tree, export format, checksum, and fixture spots must be added before coverage can be reported as verified.
