import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { RawRiverSolution } from "../../scripts/validateRiverSolution";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rawFixtureUrl = new URL("../../codex/solver-fixtures/river-k72-oop-a4s-v1-validation.json", import.meta.url);
const configFixtureUrl = new URL("../../codex/solver-fixtures/river-k72-oop-a4s-v1.toml", import.meta.url);
const datasetUrl = new URL("./data/river-k72-oop-a4s-v1.json", import.meta.url);
const rawFixture = JSON.parse(readFileSync(rawFixtureUrl, "utf8")) as RawRiverSolution;
const configFixture = readFileSync(configFixtureUrl, "utf8");
const expectedDataset = JSON.parse(readFileSync(datasetUrl, "utf8")) as unknown;

function cloneRaw(): RawRiverSolution {
  return JSON.parse(JSON.stringify(rawFixture)) as RawRiverSolution;
}

function runExporter(raw: RawRiverSolution, configText = configFixture) {
  const tempDir = mkdtempSync(resolve(tmpdir(), "poker-gto-solver-export-"));
  const rawPath = resolve(tempDir, "raw-solution.json");
  const configPath = resolve(tempDir, "config.toml");
  const outputPath = resolve(tempDir, "dataset.json");
  const tsxPath = resolve(repoRoot, "node_modules/.bin/tsx");
  const exporterPath = resolve(repoRoot, "scripts/exportSolverData.ts");
  writeFileSync(rawPath, `${JSON.stringify(raw)}\n`);
  writeFileSync(configPath, configText);
  const result = spawnSync(tsxPath, [exporterPath, rawPath, configPath, outputPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return { ...result, outputPath };
}

function withExporter<T>(raw: RawRiverSolution, configText: string, check: (result: ReturnType<typeof runExporter>) => T): T {
  const result = runExporter(raw, configText);
  try {
    return check(result);
  } finally {
    rmSync(dirname(result.outputPath), { recursive: true, force: true });
  }
}

describe("solver data exporter failure paths", () => {
  it("exports the pinned snapshot unchanged after independent validation", () => {
    withExporter(cloneRaw(), configFixture, (result) => {
      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(result.outputPath, "utf8"))).toEqual(expectedDataset);
    });
  });

  it("rejects a caller-supplied config with an unrelated checksum", () => {
    withExporter(cloneRaw(), "effective_stack = 999\n", (result) => {
      expect(result.status).not.toBe(0);
      expect(`${result.stderr}${result.stdout}`).toContain("input config checksum does not match the pinned fixture");
    });
  });

  it("rejects invalid downstream strategies and stale EV or exploitability claims", () => {
    const invalidStrategy = cloneRaw();
    const node9 = invalidStrategy.nodes.find((node) => node.node === 9)!;
    node9.strategy[0] = -0.25;

    const staleEv = cloneRaw();
    staleEv.meta.root_evs.zero_sum = [123, -123];

    const staleExploitability = cloneRaw();
    staleExploitability.meta.exploitability_chips = 0.1;

    for (const raw of [invalidStrategy, staleEv, staleExploitability]) {
      withExporter(raw, configFixture, (result) => {
        expect(result.status).not.toBe(0);
        expect(result.status).not.toBeNull();
      });
    }
  });
});
