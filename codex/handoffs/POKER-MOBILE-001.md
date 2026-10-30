# POKER-MOBILE-001 — Mobile-first full heads-up trainer

## GOAL
Evolve the existing Poker-GTO-v1 React/TypeScript app into a polished, mobile-first, fully playable heads-up no-limit Texas Hold'em trainer hosted as static assets on GitHub Pages. Reuse the existing engine, AI profiles, coaching, statistics, tests and history; do not rebuild unnecessarily. No live GTO solver, backend, accounts or paid API.

## SCOPE
- Inspect current app and preserve working behavior. Implement continuous heads-up matches: configurable starting stacks/blinds, correctly alternating button and heads-up blinds, preflop/postflop action order, all streets, legal bets/raises/min-raises/all-ins, short-stack handling, pot settlement, showdown/ties, chip conservation, next-hand continuity and match-end on elimination. Prefer existing rules and avoid unnecessary complexity. Handle interrupted match restoration and reset.
- Mobile-first clean interface: portrait small-phone priority, adaptive tablet/desktop, readable cards/stacks/pot, large thumb-accessible Fold/Check/Call/Bet/Raise controls, safe-area support, accessible focus/labels/contrast, compact bet-size presets plus valid input, no horizontal scrolling or blocking coaching. Restraint in animations and reduced-motion support.
- Keep/improve four heuristic opponent personalities. No claims of optimal or GTO play. Avoid exposing hidden opponent information.
- Lightweight coaching: exact pot odds and current made-hand category; position, preflop starting-hand guidance, contextual rule-based hints, bet-size explanations, opponent observations, optional capped browser-side Monte Carlo equity estimates clearly marked with range assumptions/uncertainty, hand review/replay and common-leak indicators. Offer Beginner (automatic), Practice (on-demand), Challenge (post-hand) modes. If any estimate is too costly/unreliable, omit it with clear status instead of inventing precision.
- Metrics: VPIP, PFR, 3-bet opportunities, aggression, continuation-bet opportunities, folds to c-bets, WTSD, W$SD, BB/100, position splits, match results and coaching progress. Use correct denominators, explicit sample sizes and insufficient-sample states; store locally, with no telemetry. Keep detailed metrics off the playing table.
- Remove the fixed river solver demo from active UI/navigation and all browser runtime references, obsolete marketing/GTO accuracy claims and unnecessary solver runtime imports. Preserve historical provenance, research and commits where practical; do not delete unrelated tests/data solely to erase history. Update README to reflect actual capabilities and limitations.
- Ensure GitHub Pages project-path-compatible static build (including asset/base path) and document deployment procedure. DO NOT deploy, enable Pages, change settings or publish. Offline/PWA is optional only if reliable and small.
- Keep changes scoped to this repo and task. Codex selects implementation methods and may repair issues uncovered within scope.

## DO NOT
Do not launch paid/live AI or external solver, introduce a backend or user data service, use real-money features, access HAL/OpenClaw VPS/owner PC, change credentials/security settings, merge, deploy, publish, spend or touch unrelated repos. Do not present heuristics/equity approximations as solver-backed GTO. Do not discard existing code/tests without justified evidence.

## DONE WHEN
- Full heads-up match plays legally from first deal through elimination, with chip conservation, blinds/button and turn order correct across multiple hands; AI turns resolve and player can resume/reset.
- Responsive mobile gameplay verified at narrow phone, common phone, tablet and desktop sizes; controls usable with touch and keyboard; coaching doesn't obscure actions.
- Coaching modes, pot odds, explainable guidance, hand review and statistics function without a backend; accuracy/denominator/sample-size tests cover critical claims.
- Existing tests retained/adapted; relevant unit/integration, deterministic match simulations, build/typecheck and Playwright mobile browser/failure-path/regression tests pass or are reported as failures. Test invalid raises, all-ins, ties, short stacks, refresh/resume, AI stalls, local-storage corruption, narrow viewport and zero/low sample metrics. Use synthetic data only.
- Static GitHub Pages build path verified without deployment; no solver demo visible and no false solver claims. Record test commands, results, SHAs, known gaps, rollback.
- Open ONE unmerged PR; publish codex/results/POKER-MOBILE-001.md on an accessible branch with summary, changed files, commits, criterion-by-criterion evidence, tests (PASS/FAIL/BLOCKED/NOT TESTED), PR/branch, risks, rollback and status COMPLETED/PARTIAL/BLOCKED. Return exact results path, branch, SHA and PR URL.

## RETURN
Report exact implementation branch and commit SHA, unmerged PR URL, results document path/branch/SHA, test evidence, risks and rollback. Stop after publishing; owner decides on merge and deployment separately.

## BASELINE
Repository: mylo123ai-hue/Poker-GTO-v1
Verified main SHA at handoff creation: 770b7e717322f1bda3467019c16cab0f3636d18d
Task branch: codex/poker-mobile-001-handoff
