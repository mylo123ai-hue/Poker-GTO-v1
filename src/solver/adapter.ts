import type { Street } from "../poker/types";

export type SolverSpot = {
  players: number;
  effectiveStackBb: number;
  rakePercent: number;
  street: Street;
  betSizingBb: number[];
};

export type SolverLookup =
  | { status: "UNAVAILABLE"; reason: string; datasetId: null; actionFrequencies: null; expectedValue: null }
  | { status: "UNSUPPORTED"; reason: string; datasetId: null; actionFrequencies: null; expectedValue: null };

export const SUPPORTED_RULE_ABSTRACTION = {
  game: "Heads-up no-limit Texas Hold'em",
  players: 2,
  startingEffectiveStackBb: 100,
  rakePercent: 0,
  blindsBb: { small: 0.5, big: 1 },
  chipUnitBb: 0.5,
  streets: ["preflop", "flop", "turn", "river"] as const,
  raiseSizing: "Any integer chip size between the minimum full raise and effective stack; a smaller all-in is allowed.",
} as const;

export const VERIFIED_SOLVER_SPOT_COUNT = 0;

export function lookupSolverSpot(spot: SolverSpot): SolverLookup {
  if (
    spot.players !== 2
    || spot.effectiveStackBb !== SUPPORTED_RULE_ABSTRACTION.startingEffectiveStackBb
    || spot.rakePercent !== SUPPORTED_RULE_ABSTRACTION.rakePercent
    || !SUPPORTED_RULE_ABSTRACTION.streets.includes(spot.street as (typeof SUPPORTED_RULE_ABSTRACTION.streets)[number])
    || spot.betSizingBb.some((size) => !Number.isFinite(size) || size < 0)
  ) {
    return {
      status: "UNSUPPORTED",
      reason: "This spot is outside the documented heads-up, 100 BB, zero-rake trainer abstraction.",
      datasetId: null,
      actionFrequencies: null,
      expectedValue: null,
    };
  }
  return {
    status: "UNAVAILABLE",
    reason: "No solver dataset with verified coverage is loaded for this spot.",
    datasetId: null,
    actionFrequencies: null,
    expectedValue: null,
  };
}
