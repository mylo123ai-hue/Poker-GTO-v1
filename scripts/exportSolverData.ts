import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const PINNED_SOLVER_COMMIT = "5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de";
const ENGINE_VERSION = "0.1.0";
const HERO_COMBO = "As4s";

type Action = { kind: "Fold" | "Check" | "Call" | "Bet" | "Raise" | "AllIn"; amount?: number };
type SolverNode = {
  node: number;
  player: number;
  actions: Action[];
  combo_count: number;
  strategy: number[];
};
type RootCombo = { cards: string };
type RawSolution = {
  config: {
    board: string;
    oop_range: string;
    ip_range: string;
    effective_stack: number;
    starting_pot: number;
    allin_threshold: number;
    raise_cap: number;
    target_exploitability: number;
    max_iterations: number;
    alpha: number;
    beta: number;
    gamma: number;
    turn_chance_sampling: boolean;
    regret_floor: boolean;
    rake: { percent: number; cap: number };
    sizings: {
      oop: { river: { bet: { percents: number[]; allin: boolean }; raise: { percents: number[]; allin: boolean } } };
      ip: { river: { bet: { percents: number[]; allin: boolean }; raise: { percents: number[]; allin: boolean } } };
    };
    tournament?: unknown;
  };
  meta: {
    iterations: number;
    exploitability_chips: number;
    exploitability_pct_of_pot: number;
    root_evs: { zero_sum: [number, number] };
    engine_version: string;
    payoff_unit: string;
  };
  node_count: number;
  nodes: SolverNode[];
  root_combos: [RootCombo[], RootCombo[]];
};

function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function canonicalCombo(cards: string): string {
  const tokens = cards.match(/[2-9TJQKA][cdhs]/g) ?? [];
  insist(tokens.length === 2 && tokens.join("") === cards, `invalid combo notation: ${cards}`);
  insist(tokens[0] !== tokens[1], `duplicate card in combo: ${cards}`);
  return [...tokens].sort().join("");
}

function assertRangeHasNoBoardBlockers(combos: RootCombo[], board: string[], label: string) {
  const boardCards = new Set(board);
  const comboIds = new Set<string>();
  for (const { cards } of combos) {
    const id = canonicalCombo(cards);
    const tokens = cards.match(/[2-9TJQKA][cdhs]/g)!;
    insist(!tokens.some((card) => boardCards.has(card)), `${label} combo ${cards} conflicts with board`);
    insist(!comboIds.has(id), `${label} contains duplicate combo ${cards}`);
    comboIds.add(id);
  }
}

function main() {
  const [solutionPath, configPath, outputPath] = process.argv.slice(2);
  insist(solutionPath && configPath && outputPath, "usage: tsx scripts/exportSolverData.ts <solver-output.json> <config.toml> <output.json>");
  const raw = JSON.parse(readFileSync(solutionPath, "utf8")) as RawSolution;
  const c = raw.config;
  const board = c.board.split(/\s+/);

  insist(c.board === "Ks 7d 2c 8h 3d", "unexpected river board");
  insist(new Set(board).size === 5, "board must contain five unique cards");
  insist(c.oop_range === "KK,A4s,A5s" && c.ip_range === "TT,JJ", "unexpected ranges");
  insist(c.effective_stack === 20 && c.starting_pot === 10 && c.allin_threshold === 67, "unexpected chip or all-in assumptions");
  insist(c.raise_cap === 1 && c.target_exploitability === 0.01 && c.max_iterations === 2000, "unexpected solver stopping/tree parameters");
  insist(c.alpha === 1.5 && c.beta === 0 && c.gamma === 2, "unexpected DCFR parameters");
  insist(c.turn_chance_sampling === false && c.regret_floor === false, "unexpected solver mode");
  insist(c.rake.percent === 0 && c.rake.cap === 0 && !c.tournament, "fixture must be rake-free chip EV");
  insist(c.sizings.oop.river.bet.percents.length === 1 && c.sizings.oop.river.bet.percents[0] === 100, "unexpected OOP river bet tree");
  insist(!c.sizings.oop.river.bet.allin && c.sizings.oop.river.raise.percents.length === 0, "unexpected OOP river actions");
  insist(c.sizings.ip.river.bet.percents.length === 1 && c.sizings.ip.river.bet.percents[0] === 100, "unexpected IP river bet tree");
  insist(c.sizings.ip.river.raise.percents.length === 1 && c.sizings.ip.river.raise.percents[0] === 100, "unexpected IP river raise tree");
  insist(!c.sizings.ip.river.bet.allin && !c.sizings.ip.river.raise.allin, "unexpected all-in action flag");
  insist(raw.meta.engine_version === ENGINE_VERSION && raw.meta.payoff_unit === "chips", "unexpected solver version or payoff unit");
  insist(raw.meta.iterations > 0 && raw.meta.iterations <= c.max_iterations, "invalid iteration count");
  insist(Number.isFinite(raw.meta.exploitability_chips) && raw.meta.exploitability_chips >= 0, "invalid measured exploitability");
  insist(Number.isFinite(raw.meta.exploitability_pct_of_pot) && raw.meta.exploitability_pct_of_pot >= 0, "invalid measured exploitability percentage");
  insist(raw.meta.exploitability_pct_of_pot <= c.target_exploitability || raw.meta.iterations === c.max_iterations, "solve stopped before its target or iteration cap");
  insist(raw.node_count === 12, "unexpected river tree shape");

  const oopCombos = raw.root_combos[0];
  const ipCombos = raw.root_combos[1];
  insist(oopCombos.length === 11 && ipCombos.length === 12, "unexpected range sizes after board blockers");
  assertRangeHasNoBoardBlockers(oopCombos, board, "OOP range");
  assertRangeHasNoBoardBlockers(ipCombos, board, "IP range");

  const root = raw.nodes.find((node) => node.node === 0 && node.player === 0);
  insist(root, "missing OOP root decision");
  insist(root.combo_count === oopCombos.length, "root strategy and OOP combo list disagree");
  insist(root.actions.length === 2 && root.actions[0].kind === "Check" && root.actions[1].kind === "Bet" && root.actions[1].amount === 10, "unexpected or illegal root action tree");
  insist(root.strategy.length === root.actions.length * root.combo_count, "malformed action-major strategy array");
  for (let comboIndex = 0; comboIndex < root.combo_count; comboIndex += 1) {
    const probabilities = root.actions.map((_, actionIndex) => root.strategy[actionIndex * root.combo_count + comboIndex]);
    insist(probabilities.every((p) => Number.isFinite(p) && p >= -1e-6 && p <= 1 + 1e-6), `invalid probability for OOP combo ${oopCombos[comboIndex].cards}`);
    insist(Math.abs(probabilities.reduce((sum, p) => sum + p, 0) - 1) <= 1e-5, `strategy probabilities do not sum to one for ${oopCombos[comboIndex].cards}`);
  }

  const heroIndex = oopCombos.findIndex(({ cards }) => canonicalCombo(cards) === canonicalCombo(HERO_COMBO));
  insist(heroIndex >= 0, `${HERO_COMBO} is missing from the OOP range after blockers`);
  insist(!board.includes("As") && !board.includes("4s"), `${HERO_COMBO} is blocked by the board`);
  const actions = root.actions.map((action, actionIndex) => {
    const frequency = root.strategy[actionIndex * root.combo_count + heroIndex];
    return {
      action: action.kind === "Bet" ? `Bet ${action.amount} chips` : action.kind,
      kind: action.kind.toLowerCase(),
      amountChips: action.amount ?? null,
      frequency,
    };
  });
  const recommended = actions.reduce((best, action) => action.frequency > best.frequency ? action : best);
  const sourceConfigSha256 = createHash("sha256").update(readFileSync(configPath)).digest("hex");
  const dataset = {
    schemaVersion: 1,
    datasetId: "river-k72-oop-a4s-v1",
    solver: {
      repository: "https://github.com/ucsandman/postflop",
      commit: PINNED_SOLVER_COMMIT,
      engineVersion: raw.meta.engine_version,
      license: "MIT",
      localPatch: "codex/patches/ucsandman-postflop-5fc7ee3-fix-zero-sum-gains.patch",
    },
    scenario: {
      players: 2,
      street: "river",
      board,
      oopRange: c.oop_range,
      ipRange: c.ip_range,
      effectiveStackChips: c.effective_stack,
      startingPotChips: c.starting_pot,
      rakePercent: c.rake.percent,
      rakeCapChips: c.rake.cap,
      allinThresholdPercent: c.allin_threshold,
      positionToAct: "OOP",
      history: [],
      raiseCap: c.raise_cap,
      actions: {
        oopRiverBetPercent: c.sizings.oop.river.bet.percents,
        oopRiverBetAllIn: c.sizings.oop.river.bet.allin,
        oopRiverRaisePercent: c.sizings.oop.river.raise.percents,
        oopRiverRaiseAllIn: c.sizings.oop.river.raise.allin,
        ipRiverBetPercent: c.sizings.ip.river.bet.percents,
        ipRiverBetAllIn: c.sizings.ip.river.bet.allin,
        ipRiverRaisePercent: c.sizings.ip.river.raise.percents,
        ipRiverRaiseAllIn: c.sizings.ip.river.raise.allin,
      },
    },
    decision: {
      player: "OOP",
      combo: HERO_COMBO,
      rootComboCount: oopCombos.length,
      opponentComboCount: ipCombos.length,
      actions,
      recommendedAction: recommended.action,
    },
    result: {
      iterations: raw.meta.iterations,
      measuredExploitabilityChips: raw.meta.exploitability_chips,
      measuredExploitabilityPercentOfPot: raw.meta.exploitability_pct_of_pot,
      expectedValue: {
        chips: raw.meta.root_evs.zero_sum[0],
        perspective: "OOP",
        scope: "root range-average net chip EV against the solver profile",
      },
      payoffUnit: "chips",
    },
    provenance: {
      sourceConfigSha256,
      convergenceTargetPercentOfPot: c.target_exploitability,
      maxIterations: c.max_iterations,
      dcfr: { alpha: c.alpha, beta: c.beta, gamma: c.gamma },
      chanceSampling: false,
      wallSecondsExcludedFromExport: true,
    },
  };
  writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
}

main();
