import riverDataJson from "./data/river-k72-oop-a4s-v1.json";

type RiverAction = {
  action: string;
  kind: string;
  amountChips: number | null;
  frequency: number;
};

type RiverDataset = {
  schemaVersion: number;
  datasetId: string;
  solver: {
    repository: string;
    commit: string;
    engineVersion: string;
    license: string;
    localPatch: string;
  };
  scenario: {
    players: number;
    street: string;
    board: string[];
    oopRange: string;
    ipRange: string;
    effectiveStackChips: number;
    startingPotChips: number;
    rakePercent: number;
    rakeCapChips: number;
    allinThresholdPercent: number;
    positionToAct: string;
    history: string[];
    raiseCap: number;
    actions: {
      oopRiverBetPercent: number[];
      oopRiverBetAllIn: boolean;
      oopRiverRaisePercent: number[];
      oopRiverRaiseAllIn: boolean;
      ipRiverBetPercent: number[];
      ipRiverBetAllIn: boolean;
      ipRiverRaisePercent: number[];
      ipRiverRaiseAllIn: boolean;
    };
  };
  decision: {
    player: string;
    combo: string;
    rootComboCount: number;
    opponentComboCount: number;
    actions: RiverAction[];
    recommendedAction: string;
  };
  result: {
    iterations: number;
    measuredExploitabilityChips: number;
    measuredExploitabilityPercentOfPot: number;
    expectedValue: {
      chips: number;
      perspective: string;
      scope: string;
    };
    payoffUnit: string;
  };
  provenance: {
    sourceConfigSha256: string;
    convergenceTargetPercentOfPot: number;
    maxIterations: number;
    dcfr: { alpha: number; beta: number; gamma: number };
    chanceSampling: boolean;
    wallSecondsExcludedFromExport: boolean;
  };
};

const riverData = riverDataJson as RiverDataset;

export type SolverScenario = RiverDataset["scenario"];
export type SolverSpotInput = {
  players?: number;
  street?: string;
  board?: readonly string[];
  oopRange?: string;
  ipRange?: string;
  effectiveStackChips?: number;
  startingPotChips?: number;
  rakePercent?: number;
  rakeCapChips?: number;
  allinThresholdPercent?: number;
  positionToAct?: string;
  history?: readonly string[];
  raiseCap?: number;
  actions?: Partial<SolverScenario["actions"]>;
  combo?: string;
};

export type SolverActionFrequency = RiverAction;

export type SolverLookup =
  | { status: "VERIFIED"; reason: string; datasetId: string; actionFrequencies: SolverActionFrequency[]; expectedValue: RiverDataset["result"]["expectedValue"]; measuredExploitabilityChips: number; measuredExploitabilityPercentOfPot: number; iterations: number; recommendedAction: string; source: RiverDataset["solver"] }
  | { status: "UNAVAILABLE"; reason: string; datasetId: null; actionFrequencies: null; expectedValue: null }
  | { status: "UNSUPPORTED"; reason: string; datasetId: null; actionFrequencies: null; expectedValue: null };

export const TRAINER_RULE_ABSTRACTION = {
  game: "Heads-up no-limit Texas Hold'em",
  players: 2,
  startingEffectiveStackBb: 100,
  rakePercent: 0,
  blindsBb: { small: 0.5, big: 1 },
  chipUnitBb: 0.5,
  streets: ["preflop", "flop", "turn", "river"] as const,
  raiseSizing: "Any integer chip size between the minimum full raise and effective stack; a smaller all-in is allowed.",
} as const;

export const VERIFIED_SOLVER_SPOT_COUNT = 1;
export const SOLVER_DEMO_SCENARIO: SolverScenario = riverData.scenario;
export const SOLVER_DEMO_REQUEST: SolverSpotInput = {
  ...riverData.scenario,
  combo: riverData.decision.combo,
};

function unavailable(reason: string): SolverLookup {
  return { status: "UNAVAILABLE", reason, datasetId: null, actionFrequencies: null, expectedValue: null };
}

function unsupported(reason: string): SolverLookup {
  return { status: "UNSUPPORTED", reason, datasetId: null, actionFrequencies: null, expectedValue: null };
}

function arraysEqual(left: readonly string[] | undefined, right: readonly string[]): boolean {
  return Boolean(left && left.length === right.length && left.every((value, index) => value === right[index]));
}

function numbersEqual(left: readonly number[] | undefined, right: readonly number[]): boolean {
  return Boolean(left && left.length === right.length && left.every((value, index) => value === right[index]));
}

function hasExactScenario(spot: SolverSpotInput): boolean {
  const expected = riverData.scenario;
  const actions = spot.actions;
  return spot.players === expected.players
    && spot.street === expected.street
    && arraysEqual(spot.board, expected.board)
    && spot.oopRange === expected.oopRange
    && spot.ipRange === expected.ipRange
    && spot.effectiveStackChips === expected.effectiveStackChips
    && spot.startingPotChips === expected.startingPotChips
    && spot.rakePercent === expected.rakePercent
    && spot.rakeCapChips === expected.rakeCapChips
    && spot.allinThresholdPercent === expected.allinThresholdPercent
    && spot.positionToAct === expected.positionToAct
    && arraysEqual(spot.history, expected.history)
    && spot.raiseCap === expected.raiseCap
    && Boolean(actions)
    && numbersEqual(actions?.oopRiverBetPercent, expected.actions.oopRiverBetPercent)
    && actions?.oopRiverBetAllIn === expected.actions.oopRiverBetAllIn
    && numbersEqual(actions?.oopRiverRaisePercent, expected.actions.oopRiverRaisePercent)
    && actions?.oopRiverRaiseAllIn === expected.actions.oopRiverRaiseAllIn
    && numbersEqual(actions?.ipRiverBetPercent, expected.actions.ipRiverBetPercent)
    && actions?.ipRiverBetAllIn === expected.actions.ipRiverBetAllIn
    && numbersEqual(actions?.ipRiverRaisePercent, expected.actions.ipRiverRaisePercent)
    && actions?.ipRiverRaiseAllIn === expected.actions.ipRiverRaiseAllIn;
}

export function lookupSolverSpot(spot: SolverSpotInput): SolverLookup {
  if (spot.players !== undefined && spot.players !== 2) {
    return unsupported("The verified solver dataset is heads-up only.");
  }
  if (spot.street !== undefined && spot.street !== "river") {
    return unsupported("The verified solver dataset covers a river decision only.");
  }
  if (spot.rakePercent !== undefined && spot.rakePercent !== 0) {
    return unsupported("The verified solver dataset uses zero rake.");
  }
  if ([spot.effectiveStackChips, spot.startingPotChips].some((value) => value !== undefined && (!Number.isFinite(value) || value <= 0))) {
    return unsupported("Stack and pot must be positive finite chip amounts.");
  }
  if (spot.combo === undefined || !hasExactScenario(spot)) {
    return unavailable("No solver output matches this exact board, ranges, pot, stack, action tree, position, and combo. The separate river demo is the only verified spot.");
  }
  if (spot.combo !== riverData.decision.combo) {
    return unavailable("This exact river scenario is solved only for the displayed A♠4♠ combo.");
  }

  return {
    status: "VERIFIED",
    reason: "Exact match to the packaged river scenario and combo.",
    datasetId: riverData.datasetId,
    actionFrequencies: riverData.decision.actions.map((action) => ({ ...action })),
    expectedValue: { ...riverData.result.expectedValue },
    measuredExploitabilityChips: riverData.result.measuredExploitabilityChips,
    measuredExploitabilityPercentOfPot: riverData.result.measuredExploitabilityPercentOfPot,
    iterations: riverData.result.iterations,
    recommendedAction: riverData.decision.recommendedAction,
    source: { ...riverData.solver },
  };
}
