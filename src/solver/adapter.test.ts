import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  lookupSolverSpot,
  SOLVER_DEMO_REQUEST,
  SOLVER_DEMO_SCENARIO,
  VERIFIED_SOLVER_SPOT_COUNT,
} from "./adapter";

const sourcePath = new URL("./data/river-k72-oop-a4s-v1.json", import.meta.url);
const manifestPath = new URL("../../codex/solver-fixtures/river-k72-oop-a4s-v1-manifest.json", import.meta.url);
const configPath = new URL("../../codex/solver-fixtures/river-k72-oop-a4s-v1.toml", import.meta.url);
const patchPath = new URL("../../codex/patches/ucsandman-postflop-5fc7ee3-fix-zero-sum-gains.patch", import.meta.url);
const licensePath = new URL("../../codex/third-party/ucsandman-postflop-LICENSE.txt", import.meta.url);

describe("solver coverage adapter", () => {
  it("returns the pinned solver frequencies and metrics for the exact demo request", () => {
    const lookup = lookupSolverSpot(SOLVER_DEMO_REQUEST);
    expect(lookup.status).toBe("VERIFIED");
    if (lookup.status !== "VERIFIED") return;

    expect(lookup.datasetId).toBe("river-k72-oop-a4s-v1");
    expect(lookup.actionFrequencies.map(({ action }) => action)).toEqual(["Check", "Bet 10 chips"]);
    expect(lookup.actionFrequencies.every(({ frequency }) => Number.isFinite(frequency) && frequency >= 0 && frequency <= 1)).toBe(true);
    expect(lookup.actionFrequencies.reduce((sum, { frequency }) => sum + frequency, 0)).toBeCloseTo(1, 5);
    expect(lookup.expectedValue.perspective).toBe("OOP");
    expect(lookup.expectedValue.scope).toContain("range-average");
    expect(Number.isFinite(lookup.expectedValue.chips)).toBe(true);
    expect(lookup.measuredExploitabilityPercentOfPot).toBeGreaterThanOrEqual(0);
    expect(lookup.source.commit).toBe("5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de");
    expect(VERIFIED_SOLVER_SPOT_COUNT).toBe(1);
  });

  it("rejects any change to the exact board, ranges, stack, pot, history, action tree, position or combo", () => {
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, board: ["Ks", "7d", "2c", "8h", "4d"] }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, board: Array(5) as string[] }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, oopRange: "KK,A4s" }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, ipRange: "TT,JJ,QQ" }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, effectiveStackChips: 19 }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, startingPotChips: 9 }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, rakeCapChips: 1 }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, allinThresholdPercent: 50 }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, positionToAct: "IP" }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, history: ["check"] }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, raiseCap: 2 }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, oopRiverBetPercent: [] } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, oopRiverBetPercent: Array(1) as number[] } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, oopRiverBetAllIn: true } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, oopRiverRaisePercent: [100] } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, oopRiverRaiseAllIn: true } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, ipRiverBetPercent: [] } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, ipRiverBetAllIn: true } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, ipRiverRaisePercent: [] } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, actions: { ...SOLVER_DEMO_SCENARIO.actions, ipRiverRaiseAllIn: true } }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, combo: "As5s" }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, combo: undefined }).status).toBe("UNAVAILABLE");
  });

  it("marks unsupported game variants separately from compatible but uncovered spots", () => {
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, players: 3 }).status).toBe("UNSUPPORTED");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, street: "flop" }).status).toBe("UNSUPPORTED");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, rakePercent: 5 }).status).toBe("UNSUPPORTED");
    expect(lookupSolverSpot({ players: 2, street: "river", effectiveStackChips: 200, rakePercent: 0 }).status).toBe("UNAVAILABLE");
    expect(lookupSolverSpot({ ...SOLVER_DEMO_REQUEST, effectiveStackChips: -1 }).status).toBe("UNSUPPORTED");
  });

  it("ships a checksummed, legal, blocker-consistent single-combo fixture with solver provenance", () => {
    const bytes = readFileSync(sourcePath);
    const dataset = JSON.parse(bytes.toString("utf8")) as {
      schemaVersion: number;
      datasetId: string;
      solver: { commit: string; license: string };
      scenario: { board: string[]; oopRange: string; ipRange: string };
      decision: { combo: string; rootComboCount: number; opponentComboCount: number; actions: Array<{ action: string; frequency: number }> };
      result: { expectedValue: { perspective: string; payoffUnit?: string }; payoffUnit: string };
      provenance: { sourceConfigSha256: string };
    };
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      verifiedDatasets: Array<{
        datasetId: string;
        sourcePath: string;
        sha256: string;
        source: { commit: string; engineVersion: string; license: string; localPatchSha256: string };
      }>;
      coverage: {
        verifiedSpotCount: number;
        actionFrequenciesAvailable: boolean;
        expectedValuesAvailable: boolean;
        simulationCoveredDecisionCount: number;
        liveHandDecisionCount: number;
      };
    };
    const entry = manifest.verifiedDatasets.find((item) => item.datasetId === dataset.datasetId);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const configDigest = createHash("sha256").update(readFileSync(configPath)).digest("hex");
    const patchDigest = createHash("sha256").update(readFileSync(patchPath)).digest("hex");
    const licenseDigest = createHash("sha256").update(readFileSync(licensePath)).digest("hex");
    const boardCards = new Set(dataset.scenario.board);
    const heroCards = dataset.decision.combo.match(/[2-9TJQKA][cdhs]/g) ?? [];

    expect(dataset.schemaVersion).toBe(1);
    expect(dataset.solver.commit).toBe("5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de");
    expect(dataset.solver.license).toBe("MIT");
    expect(dataset.scenario.board).toHaveLength(5);
    expect(boardCards.size).toBe(5);
    expect(heroCards).toHaveLength(2);
    expect(heroCards.some((card) => boardCards.has(card))).toBe(false);
    expect(dataset.decision.rootComboCount).toBe(11);
    expect(dataset.decision.opponentComboCount).toBe(12);
    expect(dataset.scenario.oopRange).toBe("KK,A4s,A5s");
    expect(dataset.scenario.ipRange).toBe("TT,JJ");
    expect(dataset.decision.actions.map(({ action }) => action)).toEqual(["Check", "Bet 10 chips"]);
    expect(dataset.decision.actions.reduce((sum, { frequency }) => sum + frequency, 0)).toBeCloseTo(1, 5);
    expect(dataset.result.expectedValue.perspective).toBe("OOP");
    expect(dataset.result.payoffUnit).toBe("chips");
    expect(dataset.provenance.sourceConfigSha256).toBe(configDigest);
    expect(entry?.sourcePath).toBe("src/solver/data/river-k72-oop-a4s-v1.json");
    expect(entry?.sha256).toBe(digest);
    expect(entry?.source.commit).toBe(dataset.solver.commit);
    expect(entry?.source.engineVersion).toBe("0.1.0");
    expect(entry?.source.license).toBe("MIT");
    expect(entry?.source.localPatchSha256).toBe(patchDigest);
    expect(licenseDigest).toBe("4bd581dc7a60a4ffc3f1ec5c8f3bed3a681f446eff6457e6051963e83da7066d");
    expect(manifest.coverage.verifiedSpotCount).toBe(1);
    expect(manifest.coverage.actionFrequenciesAvailable).toBe(true);
    expect(manifest.coverage.expectedValuesAvailable).toBe(true);
    expect(manifest.coverage.simulationCoveredDecisionCount).toBe(0);
    expect(manifest.coverage.liveHandDecisionCount).toBe(0);
  });
});
