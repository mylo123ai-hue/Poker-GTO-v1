import { chooseAIActionForHand } from "../poker/ai";
import { applyAction, createHand, DEFAULT_STACK, BIG_BLIND, playerView } from "../poker/engine";
import type { OpponentProfile, PlayerId, PokerAction } from "../poker/types";
import { VERIFIED_SOLVER_SPOT_COUNT } from "../solver/adapter";

export type SimulationOptions = {
  hands: number;
  seed: string | number;
  firstProfile: OpponentProfile;
  secondProfile: OpponentProfile;
  startingStack?: number;
  codeSha?: string;
  solverDataSha?: string | null;
};

export type SimulationResult = {
  schemaVersion: 1;
  seed: string;
  handsRequested: number;
  handsCompleted: number;
  profiles: { p0: OpponentProfile; p1: OpponentProfile };
  startingStackChips: number;
  blinds: { small: number; big: number };
  outcomes: { p0Wins: number; p1Wins: number; ties: number; showdowns: number; folds: number };
  chipResults: { p0Net: number; p1Net: number; totalNet: number; averagePot: number };
  actionCounts: Record<PlayerId, Record<PokerAction["type"], number>>;
  actionFrequency: Record<PlayerId, Record<PokerAction["type"], number>>;
    solverCoverage: { verifiedSpots: number; eligibleDecisions: number; coveragePercent: number };
  solverAgreement: null;
  solverExpectedValueLoss: null;
  codeSha: string;
  solverDataSha: string | null;
  runtimeMs: number;
  failures: { hand: number; message: string }[];
};

const ACTIONS: PokerAction["type"][] = ["fold", "check", "call", "raise"];

function emptyCounts(): Record<PlayerId, Record<PokerAction["type"], number>> {
  const create = () => ({ fold: 0, check: 0, call: 0, raise: 0 });
  return { p0: create(), p1: create() };
}

export function runSimulation(options: SimulationOptions): SimulationResult {
  if (!Number.isSafeInteger(options.hands) || options.hands < 1 || options.hands > 100_000) {
    throw new RangeError("Hand count must be an integer between 1 and 100,000.");
  }
  const startingStack = options.startingStack ?? DEFAULT_STACK;
  const started = performance.now();
  const actionCounts = emptyCounts();
  const outcomes = { p0Wins: 0, p1Wins: 0, ties: 0, showdowns: 0, folds: 0 };
  const failures: SimulationResult["failures"] = [];
  let netP0 = 0;
  let netP1 = 0;
  let totalPot = 0;
  let handsCompleted = 0;

  for (let handIndex = 0; handIndex < options.hands; handIndex += 1) {
    try {
      const handSeed = `${options.seed}:${handIndex}`;
      let state = createHand({
        seed: handSeed,
        button: handIndex % 2 === 0 ? "p0" : "p1",
        stack: startingStack,
      });
      let steps = 0;
      while (state.street !== "complete" && steps < 80) {
        const actor = state.currentActor;
        if (!actor) throw new Error("Hand has no actor before reaching a terminal state.");
        const profile = actor === "p0" ? options.firstProfile : options.secondProfile;
        const action = chooseAIActionForHand(playerView(state, actor), profile, state.actionCount, handSeed);
        actionCounts[actor][action.type] += 1;
        state = applyAction(state, action);
        steps += 1;
      }
      if (state.street !== "complete" || !state.result) throw new Error("Hand exceeded the 80-action safety limit.");
      const totalStack = state.players[0].stack + state.players[1].stack;
      if (totalStack !== startingStack * 2) {
        throw new Error(`Chip conservation failed: expected ${startingStack * 2}, got ${totalStack}.`);
      }
      handsCompleted += 1;
      totalPot += state.result.pot;
      netP0 += state.players[0].stack - startingStack;
      netP1 += state.players[1].stack - startingStack;
      if (state.result.reason === "showdown") outcomes.showdowns += 1;
      else outcomes.folds += 1;
      if (state.result.winner === "p0") outcomes.p0Wins += 1;
      else if (state.result.winner === "p1") outcomes.p1Wins += 1;
      else outcomes.ties += 1;
    } catch (error) {
      failures.push({ hand: handIndex, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const actionFrequency = emptyCounts();
  for (const playerId of ["p0", "p1"] as const) {
    const total = ACTIONS.reduce((sum, action) => sum + actionCounts[playerId][action], 0);
    for (const action of ACTIONS) {
      actionFrequency[playerId][action] = total === 0 ? 0 : actionCounts[playerId][action] / total;
    }
  }
  const eligibleDecisions = ACTIONS.reduce((sum, action) => sum + actionCounts.p0[action] + actionCounts.p1[action], 0);
  const coveragePercent = eligibleDecisions === 0 ? 0 : (VERIFIED_SOLVER_SPOT_COUNT / eligibleDecisions) * 100;
  return {
    schemaVersion: 1,
    seed: String(options.seed),
    handsRequested: options.hands,
    handsCompleted,
    profiles: { p0: options.firstProfile, p1: options.secondProfile },
    startingStackChips: startingStack,
    blinds: { small: 1, big: BIG_BLIND },
    outcomes,
    chipResults: {
      p0Net: netP0,
      p1Net: netP1,
      totalNet: netP0 + netP1,
      averagePot: handsCompleted === 0 ? 0 : totalPot / handsCompleted,
    },
    actionCounts,
    actionFrequency,
    solverCoverage: { verifiedSpots: VERIFIED_SOLVER_SPOT_COUNT, eligibleDecisions, coveragePercent },
    solverAgreement: null,
    solverExpectedValueLoss: null,
    codeSha: options.codeSha ?? "UNSPECIFIED",
    solverDataSha: options.solverDataSha ?? null,
    runtimeMs: performance.now() - started,
    failures,
  };
}

export function stableSimulationProjection(result: SimulationResult): Omit<SimulationResult, "runtimeMs" | "codeSha"> {
  const { runtimeMs: _runtimeMs, codeSha: _codeSha, ...stable } = result;
  return stable;
}
