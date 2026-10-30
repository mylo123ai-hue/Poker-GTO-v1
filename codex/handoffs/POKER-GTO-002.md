# POKER-GTO-002 — First verified solver-backed GTO spot

## GOAL
Deliver the smallest genuine, independently reproducible, solver-backed postflop GTO demonstration in the existing Poker-GTO-v1 browser trainer, suitable for static GitHub Pages hosting. The user must be able to inspect one real solved decision with legal action frequencies and EV, with accurate provenance and limitations. Prefer a licensed existing solver, not a homegrown poker solver.

## SCOPE
- Start from PR #1 implementation commit d1074d6609bfc6be8c50fdbecab7c3c1990108c5, inherited by this handoff. Preserve game, four opponents, approximate coach, simulations, reports, and tests.
- Investigate and verify a usable, redistributable open-source postflop solver; evaluate ucsandman/postflop (Rust/WASM) first, but choose another better-supported lawful alternative if necessary. Verify actual license, pinned upstream revision, execution environment, and correctness claims. Avoid assuming WebAssembly runtime is needed in production.
- Choose one tractable heads-up turn or river subgame; document explicit board, hero and villain ranges, stacks, pot, betting history/tree, allowed bet sizes, rake, card blockers, equilibrium approximation/convergence, and strategy assumptions. Generate reproducible solver outputs offline or in CI, export compact versioned static dataset, and document provenance, generation command, checksums, and limitations.
- Integrate into existing trainer as an explicit demo/compatible spot with correct state matching. If the live game cannot reach that exact abstraction, expose an honest separate solver demonstration rather than claiming arbitrary live hands are solved. No silent extrapolation to unverified spots.
- Show real supported action frequencies and EV with units and player perspective, plus recommended action, solver source, coverage status, and compact explanation. Distinguish solver EV from equity, exploitability, and approximate coaching. Keep unsupported spots UNAVAILABLE/APPROXIMATE and avoid false precision.
- Add independent validation: action probabilities sum to 1 within tolerance, legality, range/blocker consistency, determinism/reproducibility, matching exact scenario, incompatible-state rejection, source/provenance checks, browser desktop/mobile, existing regressions, static build and resource budgets. Ensure zero verified solver decisions never counts as success for this task.
- Run safe tests via GitHub Actions and publish relevant test evidence/artifacts. No secrets or paid APIs. If solver generation exceeds standard GitHub-hosted resources, allow a reproducible pre-generated fixture with honest provenance, and record resource limits.
- Record remaining gaps, extension path to more postflop spots, and rollback.

## DO NOT
Do not merge PR #1 or any new PR; do not deploy/publish to GitHub Pages, change repository settings, access owner PC, use credentials, paid services, or external live AI. Do not change unrelated repos, weaken existing tests, invent GTO percentages/EV, or claim complete-game GTO coverage. Do not introduce code with unverified redistribution rights. Preserve all prior code unless necessary for this bounded integration.

## DONE WHEN
- At least ONE exact, reproducible, legally sourced postflop solver-backed decision is demonstrated in the running browser UI, with solver-calculated action frequencies and EV (or clearly document a BLOCKED/PARTIAL outcome if independently verified EV cannot be provided).
- Exact solver provenance, license, assumptions, pinned source, commands, hashes, test evidence and covered/unsupported scope are recorded.
- Typecheck, unit/integration, browser, build and seeded simulation regressions pass, and GitHub Actions evidence is linked.
- Implementation is committed on an isolated branch with an OPEN, UNMERGED PR; no Pages deployment.

## RETURN
Publish `codex/results/POKER-GTO-002.md` on an accessible implementation branch. Include COMPLETED/PARTIAL/BLOCKED, summary, changed files, SHAs, exact solver source/version/license, commands and results, number of verified spots and validation evidence, CI run/artifact links, resource use, risks, limitations, rollback, implementation branch and unmerged PR URL. Repair within this scope autonomously; do not request approval for routine bounded fixes. Stop after publishing results and PR; owner will request Sync.
