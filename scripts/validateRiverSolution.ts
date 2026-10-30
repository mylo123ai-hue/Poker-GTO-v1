/** Independent validation for the pinned one-spot river solver snapshot.
 *
 * This deliberately recomputes hand strength, profile EV, best responses and
 * exploitability without calling the Rust solver or its evaluator. It is scoped to
 * the exact no-chance river fixture and its documented five decision nodes.
 */

export type SolverAction = { kind: "Fold" | "Check" | "Call" | "Bet" | "Raise" | "AllIn"; amount?: number };
export type SolverNode = {
  node: number;
  player: number;
  actions: SolverAction[];
  combo_count: number;
  strategy: number[];
};
export type SolverCombo = { cards: string };
export type RawRiverSolution = {
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
    gain: [number, number];
    root_evs: { zero_sum: [number, number] };
    engine_version: string;
    payoff_unit: string;
    wall_seconds?: number;
  };
  node_count: number;
  nodes: SolverNode[];
  root_combos: [SolverCombo[], SolverCombo[]];
};

const PINNED_CONFIG_SHA256 = "0b19b11b96d15034a2d82b62180af748d2f217eddacdea9dca7878ec5a4ee436";
const CHIP_TOLERANCE = 1e-5;
const PROBABILITY_TOLERANCE = 1e-5;
const PERCENTAGE_POINT_TOLERANCE = 1e-5;
const SUITS = ["c", "d", "h", "s"] as const;
const RANKS = "23456789TJQKA";

export type IndependentRiverMetrics = {
  pairCount: number;
  maximumProbabilitySumError: number;
  oopRangeEv: number;
  ipRangeEv: number;
  a4sComboEv: number;
  oopBestResponse: number;
  ipBestResponse: number;
  oopDeviationGain: number;
  ipDeviationGain: number;
  exploitabilityChips: number;
  exploitabilityPercentOfPot: number;
};

function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`independent river validation: ${message}`);
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function cardTokens(cards: string): string[] {
  const tokens = cards.match(/[2-9TJQKA][cdhs]/g) ?? [];
  insist(tokens.length === 2 && tokens.join("") === cards, `invalid two-card combo ${cards}`);
  insist(tokens[0] !== tokens[1], `duplicate card in combo ${cards}`);
  return tokens;
}

function canonicalCombo(cards: string): string {
  return cardTokens(cards).sort().join("");
}

function expandPinnedRange(range: string, board: Set<string>): Set<string> {
  const combos: string[] = [];
  for (const token of range.split(",")) {
    const pair = /^([2-9TJQKA])\1$/.exec(token);
    const suited = /^([2-9TJQKA])([2-9TJQKA])s$/.exec(token);
    if (pair) {
      const rank = pair[1];
      for (let left = 0; left < SUITS.length; left += 1) {
        for (let right = left + 1; right < SUITS.length; right += 1) {
          combos.push([`${rank}${SUITS[left]}`, `${rank}${SUITS[right]}`].sort().join(""));
        }
      }
    } else if (suited && suited[1] !== suited[2]) {
      for (const suit of SUITS) combos.push([`${suited[1]}${suit}`, `${suited[2]}${suit}`].sort().join(""));
    } else {
      throw new Error(`independent river validation: unsupported pinned range token ${token}`);
    }
  }

  const live = combos.filter((combo) => cardTokens(combo).every((card) => !board.has(card)));
  const result = new Set(live);
  insist(result.size === live.length, `range ${range} expands to duplicate combos`);
  return result;
}

type HandRank = number[];

function compareRank(left: HandRank, right: HandRank): number {
  const count = Math.max(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function rankValue(card: string): number {
  return RANKS.indexOf(card[0]) + 2;
}

function rankFive(cards: string[]): HandRank {
  const values = cards.map(rankValue).sort((left, right) => right - left);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || right.value - left.value);
  const flush = cards.every((card) => card[1] === cards[0][1]);
  const unique = [...new Set(values)].sort((left, right) => right - left);
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straightHigh = unique[0];
    else if (unique.join(",") === "14,5,4,3,2") straightHigh = 5;
  }

  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0].count === 4) return [7, groups[0].value, ...values.filter((value) => value !== groups[0].value)];
  if (groups[0].count === 3 && groups[1].count === 2) return [6, groups[0].value, groups[1].value];
  if (flush) return [5, ...values];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].count === 3) {
    return [3, groups[0].value, ...values.filter((value) => value !== groups[0].value)];
  }
  const pairs = groups.filter((group) => group.count === 2).map((group) => group.value).sort((a, b) => b - a);
  if (pairs.length === 2) return [2, pairs[0], pairs[1], ...values.filter((value) => value !== pairs[0] && value !== pairs[1])];
  if (pairs.length === 1) return [1, pairs[0], ...values.filter((value) => value !== pairs[0])];
  return [0, ...values];
}

export function rankSeven(cards: string[]): HandRank {
  insist(cards.length === 7 && new Set(cards).size === 7, "hand evaluator requires seven distinct cards");
  let best: HandRank | undefined;
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const score = rankFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareRank(score, best) > 0) best = score;
          }
        }
      }
    }
  }
  insist(best, "hand evaluator produced no five-card hand");
  return best;
}

function actionKey(action: SolverAction): string {
  if (action.kind === "Bet" || action.kind === "Raise") {
    insist(action.amount !== undefined && finite(action.amount), `${action.kind} action needs a finite amount`);
    return `${action.kind}:${action.amount}`;
  }
  insist(action.amount === undefined, `${action.kind} action must not include an amount`);
  return action.kind;
}

function validateTreeAndStrategies(raw: RawRiverSolution): { byId: Map<number, SolverNode>; maximumError: number } {
  const expected = [
    { node: 0, player: 0, actions: ["Check", "Bet:10"] },
    { node: 1, player: 1, actions: ["Check", "Bet:10"] },
    { node: 3, player: 0, actions: ["Fold", "Call"] },
    { node: 6, player: 1, actions: ["Fold", "Call", "AllIn"] },
    { node: 9, player: 0, actions: ["Fold", "Call"] },
  ];
  insist(raw.node_count === 12, `expected 12 total tree nodes, found ${raw.node_count}`);
  insist(raw.nodes.length === expected.length, `expected five decision nodes, found ${raw.nodes.length}`);

  const byId = new Map(raw.nodes.map((node) => [node.node, node]));
  insist(byId.size === raw.nodes.length, "duplicate decision-node id");
  let maximumError = 0;
  for (let index = 0; index < expected.length; index += 1) {
    const wanted = expected[index];
    const node = raw.nodes[index];
    insist(node.node === wanted.node && node.player === wanted.player, `unexpected decision node at index ${index}`);
    insist(node.actions.map(actionKey).join("|") === wanted.actions.join("|"), `illegal actions at decision node ${node.node}`);
    const playerCombos = raw.root_combos[node.player];
    insist(node.combo_count === playerCombos.length, `combo count mismatch at node ${node.node}`);
    insist(node.strategy.length === node.actions.length * node.combo_count, `malformed strategy vector at node ${node.node}`);
    for (let comboIndex = 0; comboIndex < node.combo_count; comboIndex += 1) {
      let sum = 0;
      for (let actionIndex = 0; actionIndex < node.actions.length; actionIndex += 1) {
        const probability = node.strategy[actionIndex * node.combo_count + comboIndex];
        insist(finite(probability) && probability >= -1e-6 && probability <= 1 + 1e-6, `invalid probability at node ${node.node}, combo ${comboIndex}`);
        sum += probability;
      }
      maximumError = Math.max(maximumError, Math.abs(sum - 1));
      insist(Math.abs(sum - 1) <= PROBABILITY_TOLERANCE, `strategy does not normalize at node ${node.node}, combo ${comboIndex}`);
    }
  }
  return { byId, maximumError };
}

function showdownPayoff(heroRank: HandRank, opponentRank: HandRank, pot: number, heroStake: number): number {
  const comparison = compareRank(heroRank, opponentRank);
  if (comparison > 0) return pot - heroStake;
  if (comparison < 0) return -heroStake;
  return pot / 2 - heroStake;
}

function closeEnough(actual: number, expected: number, tolerance: number): boolean {
  return finite(actual) && Math.abs(actual - expected) <= tolerance;
}

/** Verify a pinned raw solve against a standalone exact enumerator for this river tree. */
export function validateRiverSolution(raw: RawRiverSolution, configSha256: string): IndependentRiverMetrics {
  const c = raw.config;
  insist(configSha256 === PINNED_CONFIG_SHA256, "input config checksum does not match the pinned fixture");
  insist(c.board === "Ks 7d 2c 8h 3d", "unexpected board");
  insist(c.oop_range === "KK,A4s,A5s" && c.ip_range === "TT,JJ", "unexpected ranges");
  insist(c.effective_stack === 20 && c.starting_pot === 10, "unexpected effective stack or pot");
  insist(c.allin_threshold === 67 && c.raise_cap === 1, "unexpected all-in threshold or raise cap");
  insist(c.target_exploitability === 0.01 && c.max_iterations === 2000, "unexpected convergence settings");
  insist(c.alpha === 1.5 && c.beta === 0 && c.gamma === 2, "unexpected DCFR parameters");
  insist(!c.turn_chance_sampling && !c.regret_floor, "unexpected sampling or regret-floor setting");
  insist(c.rake.percent === 0 && c.rake.cap === 0 && !c.tournament, "expected a rake-free chip game");
  insist(JSON.stringify(c.sizings.oop.river.bet) === JSON.stringify({ percents: [100], allin: false }), "unexpected OOP bet sizing");
  insist(JSON.stringify(c.sizings.oop.river.raise) === JSON.stringify({ percents: [], allin: false }), "unexpected OOP raise sizing");
  insist(JSON.stringify(c.sizings.ip.river.bet) === JSON.stringify({ percents: [100], allin: false }), "unexpected IP bet sizing");
  insist(JSON.stringify(c.sizings.ip.river.raise) === JSON.stringify({ percents: [100], allin: false }), "unexpected IP raise sizing");
  insist(raw.meta.engine_version === "0.1.0" && raw.meta.payoff_unit === "chips", "unexpected source version or payoff unit");
  insist(Number.isInteger(raw.meta.iterations) && raw.meta.iterations > 0 && raw.meta.iterations <= c.max_iterations, "invalid iteration count");
  insist(raw.meta.exploitability_pct_of_pot <= c.target_exploitability || raw.meta.iterations === c.max_iterations, "solver stopped before its target or iteration limit");
  insist(finite(raw.meta.exploitability_chips) && raw.meta.exploitability_chips >= 0, "invalid exploitability value");
  insist(finite(raw.meta.exploitability_pct_of_pot) && raw.meta.exploitability_pct_of_pot >= 0, "invalid exploitability percentage");
  insist(raw.root_combos.length === 2, "expected two root ranges");

  const board = c.board.split(" ");
  insist(board.length === 5 && new Set(board).size === 5, "board must contain five distinct cards");
  const boardSet = new Set(board);
  const expectedRanges = [expandPinnedRange(c.oop_range, boardSet), expandPinnedRange(c.ip_range, boardSet)];
  for (let player = 0; player < 2; player += 1) {
    const actual = raw.root_combos[player].map(({ cards }) => canonicalCombo(cards));
    const actualSet = new Set(actual);
    insist(actualSet.size === actual.length, `duplicate root combo for player ${player}`);
    insist(actualSet.size === expectedRanges[player].size && [...expectedRanges[player]].every((combo) => actualSet.has(combo)), `root combos do not match player ${player}'s configured range and board blockers`);
  }
  for (const oop of raw.root_combos[0]) {
    for (const ip of raw.root_combos[1]) {
      insist(!cardTokens(oop.cards).some((card) => cardTokens(ip.cards).includes(card)), "cross-range root combos share a card");
    }
  }

  const { byId, maximumError } = validateTreeAndStrategies(raw);
  const probabilities = (nodeId: number, comboIndex: number): number[] => {
    const node = byId.get(nodeId);
    insist(node, `missing decision node ${nodeId}`);
    return node.actions.map((_, actionIndex) => node.strategy[actionIndex * node.combo_count + comboIndex]);
  };

  const oopCombos = raw.root_combos[0].map(({ cards }) => cardTokens(cards));
  const ipCombos = raw.root_combos[1].map(({ cards }) => cardTokens(cards));
  const oopRanks = oopCombos.map((combo) => rankSeven([...board, ...combo]));
  const ipRanks = ipCombos.map((combo) => rankSeven([...board, ...combo]));
  const pairCount = oopCombos.length * ipCombos.length;
  insist(pairCount === 132, `expected 132 compatible range pairs, found ${pairCount}`);

  let profileTotal = 0;
  const oopComboEvTotals = Array(oopCombos.length).fill(0) as number[];
  for (let oopIndex = 0; oopIndex < oopCombos.length; oopIndex += 1) {
    for (let ipIndex = 0; ipIndex < ipCombos.length; ipIndex += 1) {
      const rootOop = probabilities(0, oopIndex);
      const afterCheckIp = probabilities(1, ipIndex);
      const facingBetOop = probabilities(3, oopIndex);
      const facingBetIp = probabilities(6, ipIndex);
      const facingRaiseOop = probabilities(9, oopIndex);

      const showdown10 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 10, 5);
      const showdown30 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 30, 15);
      const showdown50 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 50, 25);
      const afterCheck = afterCheckIp[0] * showdown10
        + afterCheckIp[1] * (facingBetOop[0] * -5 + facingBetOop[1] * showdown30);
      const afterBet = facingBetIp[0] * 5
        + facingBetIp[1] * showdown30
        + facingBetIp[2] * (facingRaiseOop[0] * -15 + facingRaiseOop[1] * showdown50);
      const pairEv = rootOop[0] * afterCheck + rootOop[1] * afterBet;
      profileTotal += pairEv;
      oopComboEvTotals[oopIndex] += pairEv;
    }
  }
  const oopRangeEv = profileTotal / pairCount;
  const ipRangeEv = -oopRangeEv;
  const oopComboEvs = oopComboEvTotals.map((value) => value / ipCombos.length);

  let oopBestResponseTotal = 0;
  for (let oopIndex = 0; oopIndex < oopCombos.length; oopIndex += 1) {
    let checkBranch = 0;
    let betBranch = 0;
    for (let ipIndex = 0; ipIndex < ipCombos.length; ipIndex += 1) {
      const afterCheckIp = probabilities(1, ipIndex);
      const afterBetIp = probabilities(6, ipIndex);
      const showdown10 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 10, 5);
      const showdown30 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 30, 15);
      const showdown50 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 50, 25);
      checkBranch += afterCheckIp[0] * showdown10 + afterCheckIp[1] * Math.max(-5, showdown30);
      betBranch += afterBetIp[0] * 5 + afterBetIp[1] * showdown30 + afterBetIp[2] * Math.max(-15, showdown50);
    }
    oopBestResponseTotal += Math.max(checkBranch, betBranch);
  }
  const oopBestResponse = oopBestResponseTotal / pairCount;

  let ipBestResponseTotal = 0;
  for (let ipIndex = 0; ipIndex < ipCombos.length; ipIndex += 1) {
    let checkAtNode1 = 0;
    let betAtNode1 = 0;
    const actionsAtNode6 = [0, 0, 0];
    for (let oopIndex = 0; oopIndex < oopCombos.length; oopIndex += 1) {
      const rootOop = probabilities(0, oopIndex);
      const facingBetOop = probabilities(3, oopIndex);
      const facingRaiseOop = probabilities(9, oopIndex);
      const showdown10 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 10, 5);
      const showdown30 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 30, 15);
      const showdown50 = showdownPayoff(oopRanks[oopIndex], ipRanks[ipIndex], 50, 25);

      checkAtNode1 += rootOop[0] * -showdown10;
      betAtNode1 += rootOop[0] * (facingBetOop[0] * 5 + facingBetOop[1] * -showdown30);
      actionsAtNode6[0] += rootOop[1] * -5;
      actionsAtNode6[1] += rootOop[1] * -showdown30;
      actionsAtNode6[2] += rootOop[1] * (facingRaiseOop[0] * 15 + facingRaiseOop[1] * -showdown50);
    }
    ipBestResponseTotal += Math.max(checkAtNode1, betAtNode1) + Math.max(...actionsAtNode6);
  }
  const ipBestResponse = ipBestResponseTotal / pairCount;
  const oopDeviationGain = oopBestResponse - oopRangeEv;
  const ipDeviationGain = ipBestResponse - ipRangeEv;
  const exploitabilityChips = oopBestResponse + ipBestResponse;
  const exploitabilityPercentOfPot = exploitabilityChips * 100 / c.starting_pot;

  insist(closeEnough(raw.meta.root_evs.zero_sum[0], oopRangeEv, CHIP_TOLERANCE), "reported OOP root range-average EV disagrees with independent enumeration");
  insist(closeEnough(raw.meta.root_evs.zero_sum[1], ipRangeEv, CHIP_TOLERANCE), "reported IP root range-average EV disagrees with independent enumeration");
  insist(closeEnough(raw.meta.root_evs.zero_sum[0] + raw.meta.root_evs.zero_sum[1], 0, CHIP_TOLERANCE), "zero-sum root EVs do not cancel");
  insist(raw.meta.gain.length === 2 && raw.meta.gain.every(finite), "invalid best-response gain pair");
  insist(raw.meta.gain[0] >= -CHIP_TOLERANCE && raw.meta.gain[1] >= -CHIP_TOLERANCE, "reported best-response gain is negative beyond tolerance");
  insist(closeEnough(raw.meta.gain[0], oopDeviationGain, CHIP_TOLERANCE), "reported OOP gain disagrees with BR minus profile EV");
  insist(closeEnough(raw.meta.gain[1], ipDeviationGain, CHIP_TOLERANCE), "reported IP gain disagrees with BR minus profile EV");
  insist(closeEnough(raw.meta.exploitability_chips, exploitabilityChips, CHIP_TOLERANCE), "reported exploitability disagrees with independently computed best responses");
  insist(closeEnough(raw.meta.exploitability_chips, raw.meta.gain[0] + raw.meta.gain[1], CHIP_TOLERANCE), "exploitability does not equal the sum of deviation gains within float tolerance");
  insist(closeEnough(raw.meta.exploitability_pct_of_pot, exploitabilityPercentOfPot, PERCENTAGE_POINT_TOLERANCE), "reported exploitability percentage disagrees with chip value and starting pot");

  const a4sIndex = oopCombos.findIndex((combo) => canonicalCombo(combo.join("")) === canonicalCombo("As4s"));
  insist(a4sIndex >= 0, "A♠4♠ is missing from the OOP range");
  return {
    pairCount,
    maximumProbabilitySumError: maximumError,
    oopRangeEv,
    ipRangeEv,
    a4sComboEv: oopComboEvs[a4sIndex],
    oopBestResponse,
    ipBestResponse,
    oopDeviationGain,
    ipDeviationGain,
    exploitabilityChips,
    exploitabilityPercentOfPot,
  };
}
