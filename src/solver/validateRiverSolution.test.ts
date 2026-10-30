import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  rankSeven,
  validateRiverSolution,
  type RawRiverSolution,
} from "../../scripts/validateRiverSolution";

const snapshotUrl = new URL("../../codex/solver-fixtures/river-k72-oop-a4s-v1-validation.json", import.meta.url);
const configUrl = new URL("../../codex/solver-fixtures/river-k72-oop-a4s-v1.toml", import.meta.url);
const snapshotBytes = readFileSync(snapshotUrl);
const configBytes = readFileSync(configUrl);
const snapshotSha256 = createHash("sha256").update(snapshotBytes).digest("hex");
const configSha256 = createHash("sha256").update(configBytes).digest("hex");
const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as RawRiverSolution;

function cloneSnapshot(): RawRiverSolution {
  return JSON.parse(JSON.stringify(snapshot)) as RawRiverSolution;
}

describe("independent validation of the pinned river solve", () => {
  it("uses an independent seven-card evaluator for standard hand rankings", () => {
    expect(rankSeven(["As", "Ks", "Qs", "Js", "Ts", "2d", "3c"])[0]).toBe(8);
    expect(rankSeven(["Kc", "Kd", "Kh", "Ks", "2d", "3h", "4c"])[0]).toBe(7);
    expect(rankSeven(["2h", "3d", "4s", "5c", "6c", "As", "Ad"])[0]).toBe(4);
    expect(rankSeven(["As", "Ad", "Kc", "Kd", "7h", "4s", "2c"])[0]).toBe(2);
  });

  it("re-expands ranges and independently reproduces EV, best responses, and exploitability", () => {
    expect(snapshotSha256).toBe("01ced9dc2a4faf39795ff1340758ac4506e3ea1481d036c894d64f06cd0e7890");
    const metrics = validateRiverSolution(snapshot, configSha256);

    expect(metrics.pairCount).toBe(132);
    expect(metrics.maximumProbabilitySumError).toBeLessThan(1e-5);
    expect(metrics.oopRangeEv).toBeCloseTo(-0.9090907, 5);
    expect(metrics.ipRangeEv).toBeCloseTo(0.9090903, 5);
    expect(metrics.oopBestResponse).toBeCloseTo(-0.908933, 5);
    expect(metrics.ipBestResponse).toBeCloseTo(0.909905, 5);
    expect(metrics.oopDeviationGain).toBeCloseTo(0.0001577, 5);
    expect(metrics.ipDeviationGain).toBeCloseTo(0.0008149, 5);
    expect(metrics.exploitabilityChips).toBeCloseTo(0.0009722, 5);
    expect(metrics.exploitabilityPercentOfPot).toBeCloseTo(0.009722, 5);

    // This combo loses its full five-chip starting stake under the opponent profile,
    // while the reported EV is the average across all eleven OOP range combos.
    expect(metrics.a4sComboEv).toBeCloseTo(-5.000216, 5);
    expect(Math.abs(metrics.a4sComboEv - metrics.oopRangeEv)).toBeGreaterThan(4);
  });

  it("fails closed for mismatched provenance, ranges, strategies, and stale numerical results", () => {
    expect(() => validateRiverSolution(snapshot, "0".repeat(64))).toThrow(/config checksum/);

    const wrongRange = cloneSnapshot();
    wrongRange.root_combos[0][0].cards = "2h3h";
    expect(() => validateRiverSolution(wrongRange, configSha256)).toThrow(/configured range/);

    const invalidDownstreamStrategy = cloneSnapshot();
    const node9 = invalidDownstreamStrategy.nodes.find((node) => node.node === 9)!;
    node9.strategy[0] = -0.25;
    expect(() => validateRiverSolution(invalidDownstreamStrategy, configSha256)).toThrow(/invalid probability/);

    const illegalTree = cloneSnapshot();
    illegalTree.nodes.find((node) => node.node === 6)!.actions[2] = { kind: "Raise", amount: 20 };
    expect(() => validateRiverSolution(illegalTree, configSha256)).toThrow(/illegal actions/);

    const staleDownstreamStrategy = cloneSnapshot();
    const node6 = staleDownstreamStrategy.nodes.find((node) => node.node === 6)!;
    node6.strategy = [...Array(node6.combo_count).fill(1), ...Array(node6.combo_count * 2).fill(0)];
    expect(() => validateRiverSolution(staleDownstreamStrategy, configSha256)).toThrow(/range-average EV/);

    const staleEv = cloneSnapshot();
    staleEv.meta.root_evs.zero_sum = [123, -123];
    expect(() => validateRiverSolution(staleEv, configSha256)).toThrow(/range-average EV/);

    const staleGain = cloneSnapshot();
    staleGain.meta.gain = [0, 0];
    expect(() => validateRiverSolution(staleGain, configSha256)).toThrow(/gain disagrees/);

    const staleExploitability = cloneSnapshot();
    staleExploitability.meta.exploitability_chips = 0.1;
    expect(() => validateRiverSolution(staleExploitability, configSha256)).toThrow(/exploitability disagrees/);

    const missedConvergenceTarget = cloneSnapshot();
    missedConvergenceTarget.meta.exploitability_pct_of_pot = 0.011;
    expect(() => validateRiverSolution(missedConvergenceTarget, configSha256)).toThrow(/stopped before its target/);
  });
});
