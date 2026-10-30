import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../dist/", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const builtAssets = references.filter((reference) => /\.(?:js|css)(?:\?|$)/.test(reference));
if (builtAssets.length < 2 || builtAssets.some((reference) => !reference.startsWith("./assets/"))) {
  throw new Error(`Expected relative project-path asset URLs in dist/index.html; found: ${builtAssets.join(", ")}`);
}
if (await stat(new URL("solver-manifest.json", root)).then(() => true, () => false)) {
  throw new Error("The retired solver manifest must not be included in the trainer site bundle.");
}

const assetsDir = new URL("assets/", root);
const files = await readdir(assetsDir);
const worker = files.find((file) => file.startsWith("simulation.worker-") && file.endsWith(".js"));
if (!worker) throw new Error("The static site is missing its browser simulation worker.");
for (const file of files.filter((item) => item.endsWith(".js"))) {
  const contents = await readFile(join(assetsDir.pathname, file), "utf8");
  if (/lookupSolverSpot|river-k72-oop-a4s-v1|Solver-backed river demo/.test(contents)) {
    throw new Error(`Retired demo code or data is present in browser asset ${file}.`);
  }
}
process.stdout.write(`GitHub Pages build check passed: ${builtAssets.join(", ")}; worker ${worker}; no retired demo asset.\n`);
