import { lookupSolverSpot, SOLVER_DEMO_REQUEST, SOLVER_DEMO_SCENARIO } from "../solver/adapter";

function cardLabel(card: string): string {
  const suit = card.slice(-1);
  const mark = suit === "s" ? "♠" : suit === "h" ? "♥" : suit === "d" ? "♦" : "♣";
  return `${card.slice(0, -1)}${mark}`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function SolverDemo() {
  const result = lookupSolverSpot(SOLVER_DEMO_REQUEST);

  return (
    <section className="solver-demo" aria-label="Verified solver demo">
      <div className="solver-demo-heading">
        <div>
          <p className="eyebrow">ONE EXACT, PRE-GENERATED DECISION</p>
          <h2>Solver-backed river demo</h2>
          <p>Separate from the live hand and heuristic coach. It matches only the scenario shown here.</p>
        </div>
        <span className="solver-verified-badge">{result.status === "VERIFIED" ? "SOLVER VERIFIED" : result.status}</span>
      </div>

      {result.status === "VERIFIED" ? <>
        <div className="solver-demo-scenario">
          <div className="solver-demo-board">
            <span>RIVER BOARD</span>
            <div aria-label={`Board ${SOLVER_DEMO_SCENARIO.board.map(cardLabel).join(" ")}`}>
              {SOLVER_DEMO_SCENARIO.board.map((card) => <b key={card}>{cardLabel(card)}</b>)}
            </div>
          </div>
          <div><span>HERO DECISION</span><b>OOP · {cardLabel("As")} {cardLabel("4s")}</b></div>
          <div><span>OOP RANGE</span><b>{SOLVER_DEMO_SCENARIO.oopRange}</b></div>
          <div><span>IP RANGE</span><b>{SOLVER_DEMO_SCENARIO.ipRange}</b></div>
          <div><span>STARTING POT</span><b>{SOLVER_DEMO_SCENARIO.startingPotChips} chips</b></div>
          <div><span>EFFECTIVE STACK</span><b>{SOLVER_DEMO_SCENARIO.effectiveStackChips} chips</b></div>
          <div><span>ALL-IN THRESHOLD</span><b>{SOLVER_DEMO_SCENARIO.allinThresholdPercent}%</b></div>
        </div>

        <div className="solver-demo-results">
          <div>
            <p className="solver-result-label">SOLVER ACTION MIX · THIS COMBO</p>
            <ul className="solver-action-list">
              {result.actionFrequencies.map((action) => <li key={action.kind}>
                <div className="solver-action-line"><span>{action.action}</span><b>{percent(action.frequency)}</b></div>
                <span className="solver-frequency-track" aria-hidden="true"><span style={{ width: percent(action.frequency) }} /></span>
              </li>)}
            </ul>
            <p className="solver-recommendation">Recommendation from this mix: <strong>{result.recommendedAction}</strong> (highest frequency)</p>
          </div>
          <div className="solver-result-metrics">
            <div><span>Root range-average EV · OOP</span><b>{result.expectedValue.chips.toFixed(3)} chips</b><small>Net chip EV against the solver profile; not this combo's EV.</small></div>
            <div><span>Measured exploitability</span><b>{result.measuredExploitabilityPercentOfPot.toFixed(4)}% of pot</b><small>{result.measuredExploitabilityChips.toFixed(6)} chips · measured after {result.iterations.toLocaleString()} DCFR iterations.</small></div>
          </div>
        </div>

        <div className="solver-demo-assumptions">
          <p><strong>Scenario:</strong> 5-card river board, no prior action modeled, OOP acts first, 20-chip effective stack, 10-chip pot, zero rake and a 67% all-in threshold. OOP may check or bet 100% pot; IP may bet 100% pot and raise 100% pot; one raise allowed. Ranges are unweighted.</p>
          <p><strong>Coverage:</strong> one combo-level decision for A♠4♠ from OOP range KK, A4s, A5s versus IP range TT, JJ. Board blockers are applied by the solver. All other hands, trees, streets and live states return unavailable or unsupported.</p>
          <p><strong>Accuracy:</strong> this is the pinned solver's approximate strategy after a finite solve. The reported exploitability is the solver's measured profile metric, not a claim of exact equilibrium or full-game GTO.</p>
        </div>

        <div className="solver-demo-provenance">
          <span>Solver {result.source.engineVersion} · {result.source.license} · {result.datasetId}</span>
          <a href={`${result.source.repository}/tree/${result.source.commit}`} target="_blank" rel="noreferrer">Source {result.source.commit.slice(0, 12)} ↗</a>
        </div>
      </> : <p role="status">{result.reason}</p>}
    </section>
  );
}
