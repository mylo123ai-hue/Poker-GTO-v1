# POKER-GTO-001 — Autonomous first implementation

## GOAL
Build a desktop-first, GitHub Pages-compatible heads-up No-Limit Texas Hold'em GTO demonstration/trainer in this repository, with reproducible automated testing and honest solver provenance. Codex chooses implementation methods and can repair defects within scope.

## SCOPE
- Inspect repository and select simplest maintainable static-browser architecture; React/TypeScript is preferred, but no backend, paid services, live APIs or external credentials.
- Implement a correct heads-up play-money poker engine: dealing, blinds, positions, legal action sizing, betting rounds, all-in, side-pot rules if relevant, showdown, ties, reset and reproducible seeds. One human versus one selectable AI; four difficulty profiles with demonstrable distinct behavior.
- Create desktop-first poker table with clear controls, accessible card/action state, live coach and expandable GTO metrics. Coach recommends an action with 1–2 sentence rationale; optional detailed ranges, action frequencies, equity, pot odds, EV and strategy provenance. Never inspect opponent hole cards in coaching or AI decisions.
- Investigate open-source heads-up GTO solvers/strategy datasets and license, maintainability, compatibility and export format. Prefer reuse of verified solver outputs offline, shipped as compact versioned data with source/parameters/license and test fixtures. Integrate only legally redistributable data. If genuine solver-backed coverage cannot be verified, implement an honest limited-coverage coaching adapter and mark uncovered spots as heuristic/unavailable; do not fabricate GTO numbers or claim full-game GTO.
- Define explicit supported solver abstraction (stack depths, rake assumptions, betting tree, sizes, positions, streets) and reject/match unsupported spots transparently. Keep poker rules, AI behavior, solver reference and presentation separated.
- Implement high-speed headless simulation with reproducible seeds and batch sizes from hundreds to thousands of hands, no UI rendering per hand. Export machine-readable results and PDF reports/charts with game outcome distributions, decision frequencies, agreement/EV-loss metrics only where valid solver references exist, solver coverage, run seed, code/data SHAs, runtime, failures and caveats.
- Add GitHub Actions CI for build, type/static checks, unit/integration, deterministic simulation regression, failure-path/privacy checks, and browser smoke tests where feasible. Evidence artifacts include reports and logs without secrets. Ensure GitHub Pages-compatible static build and documented deployment configuration; do not deploy.
- Include documentation for architecture, how to run, source/license provenance, verified vs approximate metrics, test commands, limitations, and rollback.

## DO NOT
Do not merge PR, deploy or publish Pages, spend money, use live paid APIs, access credentials, touch unrelated repositories or external machines, change GitHub settings/security, or expand scope. Do not claim simulation volume alone validates GTO. Do not import incompatible or unlicensed solver data. No real-money gambling.

## DONE WHEN
- Build succeeds and playable heads-up hand flow works with legal actions, deterministic rules tests and four selectable opponent profiles.
- Live coach presents concise rationale; metrics expandable and clearly distinguish VERIFIED SOLVER / APPROXIMATE / UNAVAILABLE with no invented probabilities.
- Headless simulation produces reproducible multi-hundred/thousand-hand batch results, JSON/CSV and PDF charts; metrics clearly scoped to actual validated coverage.
- CI executes relevant automated tests; failing or blocked checks documented with evidence and corrective work within scope.
- All imported solver assets have license/provenance and spot-coverage checks; if none suitable, report limitation clearly and retain safe fallback.
- Changes committed to isolated implementation branch with one unmerged PR; no deployment.

## RETURN
Publish `codex/results/POKER-GTO-001.md` on accessible implementation branch with COMPLETED / PARTIAL / BLOCKED, summary, file list, commits, criterion-by-criterion evidence, solver provenance/coverage, test commands and PASS/FAIL/BLOCKED/NOT TESTED, Actions runs/artifacts, simulation seeds/results, defects, risks, rollback, PR URL, branch and SHA. Return exact results path, branch, SHA and PR. Missing results = BLOCKED.
