import { describe, expect, it } from "vitest";
import { createSimulationPdf, simulationToCsv, simulationToJson } from "./simulationReport";
import { runSimulation, stableSimulationProjection } from "./simulate";

describe("headless simulations and reports", () => {
  it("produces repeatable, conserved seeded batches with scoped metrics", () => {
    const options = { hands: 300, seed: 20261030, firstProfile: "balanced" as const, secondProfile: "aggressive" as const, codeSha: "fixture-sha" };
    const first = runSimulation(options);
    const second = runSimulation(options);
    expect(stableSimulationProjection(first)).toEqual(stableSimulationProjection(second));
    expect(first.handsCompleted).toBe(300);
    expect(first.failures).toEqual([]);
    expect(first.chipResults.totalNet).toBe(0);
    expect(first.schemaVersion).toBe(2);
    expect(first).not.toHaveProperty("solverCoverage");
    expect(first).not.toHaveProperty("solverDataSha");
  });

  it("conserves chips across shallow, short, and full stacks", () => {
    const scenarios = [
      { stack: 2, firstProfile: "tight" as const, secondProfile: "caller" as const },
      { stack: 3, firstProfile: "caller" as const, secondProfile: "aggressive" as const },
      { stack: 10, firstProfile: "aggressive" as const, secondProfile: "balanced" as const },
      { stack: 200, firstProfile: "balanced" as const, secondProfile: "tight" as const },
    ];
    for (const [index, scenario] of scenarios.entries()) {
      const result = runSimulation({ hands: 100, seed: `stack-regression-${index}`, ...scenario });
      expect(result.handsCompleted).toBe(100);
      expect(result.failures).toEqual([]);
      expect(result.chipResults.totalNet).toBe(0);
    }
  });

  it("exports machine-readable JSON/CSV and a PDF report with strategy limitations", async () => {
    const result = runSimulation({ hands: 25, seed: "files", firstProfile: "tight", secondProfile: "caller", codeSha: "abc123" });
    const json = simulationToJson(result);
    const csv = simulationToCsv(result);
    const pdf = await createSimulationPdf(result);
    expect(JSON.parse(json).codeSha).toBe("abc123");
    expect(csv).toContain("\"seed\",\"player\"");
    expect(csv).toContain("abc123");
    expect(csv).toContain("no ground-truth strategy benchmark");
    expect(new TextDecoder().decode(pdf)).toContain("Heads-up simulation report");
    expect(csv).not.toMatch(/solver|GTO/i);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("rejects invalid batch sizes instead of silently returning partial output", () => {
    expect(() => runSimulation({ hands: 0, seed: 1, firstProfile: "balanced", secondProfile: "tight" })).toThrow(/between 1 and 100,000/);
    expect(() => runSimulation({ hands: 100_001, seed: 1, firstProfile: "balanced", secondProfile: "tight" })).toThrow(/between 1 and 100,000/);
  });
});
