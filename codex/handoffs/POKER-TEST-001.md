# POKER-TEST-001 — Autonomous solver validation and bounded repair

## GOAL
Independently validate the existing one-spot heads-up river solver integration in Poker GTO Trainer, correct genuine defects discovered, and publish reproducible evidence. This is a maximum four-hour autonomous Codex Cloud work session, subject to actual platform execution limits; it is NOT a requirement to occupy four hours or a promise of uninterrupted runtime.

## SCOPE
- Repository: mylo123ai-hue/Poker-GTO-v1.
- Baseline: exact code SHA `39cc24fde9380e8612e340953f8f0a8d16922ecd` on `codex/poker-gto-002-implementation`. Confirm branch and SHA relationship; if diverged, report and preserve history, avoid silently overwriting later changes.
- Pin upstream `ucsandman/postflop` SHA `5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de`, the checked-in compatibility patch, fixture, toolchain, and dataset hash.
- Reproduce packaged river solution from a clean pinned solver checkout, including deterministic exports and hash comparison; capture commands and environments.
- Independently validate legal action trees, blockers, combo/range weighting, strategy normalization, payoffs, root range-average EV vs combo EV, best-response gains and exploitability arithmetic, convergence, repeatability, and failure-path rejection. Prefer independent analytical checks or small reference games over merely comparing the implementation with itself. Record numerical tolerances and their justification.
- Exercise invalid/unsupported states and verify no solver-backed advice leaks into arbitrary live hands or heuristic simulations.
- Run existing typecheck, unit, build, seeded simulation, and desktop/mobile browser checks; inspect UI scope and provenance labels.
- Fix confirmed solver/adapter/exporter/test/UI correctness defects within this scope, with regression tests. Re-run affected checks after repairs. Keep the existing application and PR history intact.
- If supported by existing approved GitHub Test Lab infrastructure, reuse it without modifying unrelated projects; otherwise use existing Poker GTO GitHub Actions and report the limitation.
- Track elapsed time and stop within four hours when possible; prioritize correctness and evidence, not artificial work or a specific number of defects.

## DO NOT
- Do not launch paid APIs, live AI calls, external metered services, or access credentials.
- Do not access HAL, Tailscale, VPS, production, OpenClaw Lab or real user data.
- Do not merge, deploy, change repo settings/security, modify secrets, or alter unrelated repositories.
- Do not replace the solver architecture, expand to new streets or a broad scenario library, or claim full-game GTO.
- Do not fabricate tests, run outcomes, mathematical independence, or coverage.
- No automatic paid retries; all testing uses local/free CI resources and synthetic inputs.
- If blocked by environment limits, dependency integrity, time budget or required authority, fail closed and report PARTIAL/BLOCKED.

## DONE WHEN
- A dedicated implementation branch and **unmerged PR** contain only bounded fixes and/or improved validation tests.
- Each criterion has evidence with commands, pinned app/solver SHAs, toolchain, numerical tolerance, result PASS/FAIL/BLOCKED/NOT TESTED, logs/artifacts, known limitations and rollback.
- Confirm the previously verified single river demo remains exact-match only; independently assess the EV and exploitability calculation, and distinguish measured finite-profile exploitability from proof of full-game equilibrium.
- Existing application regression checks are reported accurately. Defects not repaired are explicitly listed.
- Publish `codex/results/POKER-TEST-001.md` on an accessible branch with status **COMPLETED / PARTIAL / BLOCKED**; include PR URL, branch, commit SHAs, files, tests, findings, repairs, risks, rollback, elapsed time and any platform runtime limitation.

## RETURN
Return the exact results file path, branch, SHA, unmerged PR URL, concise validation findings, and any blocked checks. Stop after publishing. The owner will request Sync separately.
