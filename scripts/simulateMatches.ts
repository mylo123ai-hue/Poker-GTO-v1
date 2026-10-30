import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runMatchSimulation } from "../src/poker/matchSimulation";
import type { OpponentProfile } from "../src/poker/types";

const PROFILE_NAMES: OpponentProfile[] = ["tight", "caller", "aggressive", "balanced"];
const args = process.argv.slice(2);
function value(flag: string, fallback: string): string {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}
function numberValue(flag: string, fallback: number): number {
  const parsed = Number(value(flag, String(fallback)));
  if (!Number.isFinite(parsed)) throw new RangeError(`${flag} must be a number.`);
  return parsed;
}
function profileValue(flag: string, fallback: OpponentProfile): OpponentProfile {
  const selected = value(flag, fallback);
  if (!PROFILE_NAMES.includes(selected as OpponentProfile)) throw new RangeError(`${flag} must be one of ${PROFILE_NAMES.join(", ")}.`);
  return selected as OpponentProfile;
}

const outputPath = value("--out", "");
const result = runMatchSimulation({
  matches: numberValue("--matches", 20),
  seed: value("--seed", "20261030"),
  settings: {
    startingStackChips: numberValue("--stack", 200),
    smallBlindChips: numberValue("--small-blind", 1),
    bigBlindChips: numberValue("--big-blind", 2),
  },
  p0Profile: profileValue("--p0", "balanced"),
  p1Profile: profileValue("--p1", "aggressive"),
});

const json = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  const absolute = resolve(outputPath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, json);
  process.stdout.write(`Match simulation written to ${absolute}\n`);
}
process.stdout.write(json);
if (result.failures.length > 0 || !result.chipsConserved || result.matchesCompleted !== result.matchesRequested) process.exitCode = 1;
