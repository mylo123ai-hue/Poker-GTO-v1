import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSimulationPdf, simulationToCsv, simulationToJson } from "../src/simulation/simulationReport";
import { runSimulation } from "../src/simulation/simulate";
import type { OpponentProfile } from "../src/poker/types";

function getArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function getProfile(value: string): OpponentProfile {
  if (["tight", "caller", "aggressive", "balanced"].includes(value)) return value as OpponentProfile;
  throw new Error(`Unknown profile "${value}". Use tight, caller, aggressive, or balanced.`);
}

const hands = Number(getArg("--hands", "1000"));
const seed = getArg("--seed", "20261030");
const outDir = resolve(getArg("--out", "reports/simulation"));
const firstProfile = getProfile(getArg("--p0", "balanced"));
const secondProfile = getProfile(getArg("--p1", "aggressive"));
const codeSha = process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const result = runSimulation({
  hands,
  seed,
  firstProfile,
  secondProfile,
  codeSha,
});

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "summary.json"), simulationToJson(result));
writeFileSync(resolve(outDir, "actions.csv"), simulationToCsv(result));
writeFileSync(resolve(outDir, "report.pdf"), await createSimulationPdf(result));
process.stdout.write(`${JSON.stringify({
  output: outDir,
  seed: result.seed,
  codeSha: result.codeSha,
  handsCompleted: result.handsCompleted,
  failures: result.failures.length,
  runtimeMs: Number(result.runtimeMs.toFixed(1)),
  p0Wins: result.outcomes.p0Wins,
  p1Wins: result.outcomes.p1Wins,
  ties: result.outcomes.ties,
})}\n`);
if (result.failures.length > 0) process.exitCode = 2;
