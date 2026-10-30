import { chooseAIActionForHand } from "./ai";
import { applyMatchAction, createMatch, startNextHand } from "./match";
import type { MatchSettings } from "./match";
import { playerView } from "./engine";
import type { OpponentProfile, PlayerId } from "./types";

export type MatchSimulationOptions = {
  matches: number;
  seed: string | number;
  settings?: MatchSettings;
  p0Profile: OpponentProfile;
  p1Profile: OpponentProfile;
  maxHandsPerMatch?: number;
};

export type MatchSimulationResult = {
  seed: string;
  settings: MatchSettings;
  profiles: Record<PlayerId, OpponentProfile>;
  matchesRequested: number;
  matchesCompleted: number;
  handsCompleted: number;
  outcomes: { p0Wins: number; p1Wins: number };
  averageHandsToElimination: number;
  chipsConserved: boolean;
  failures: { match: number; message: string }[];
};

export function runMatchSimulation(options: MatchSimulationOptions): MatchSimulationResult {
  if (!Number.isSafeInteger(options.matches) || options.matches < 1 || options.matches > 10_000) {
    throw new RangeError("Match count must be a whole number from 1 to 10,000.");
  }
  const settings = options.settings ?? { startingStackChips: 200, smallBlindChips: 1, bigBlindChips: 2 };
  const maxHands = options.maxHandsPerMatch ?? 100_000;
  const outcomes = { p0Wins: 0, p1Wins: 0 };
  const failures: MatchSimulationResult["failures"] = [];
  let matchesCompleted = 0;
  let handsCompleted = 0;
  let chipsConserved = true;

  for (let index = 0; index < options.matches; index += 1) {
    try {
      let match = createMatch({ seed: `${options.seed}:match:${index}`, settings, id: `simulation:${index}` });
      let turns = 0;
      let hands = 0;
      while (match.status !== "match-complete" && hands < maxHands) {
        while (match.status === "active") {
          const actor = match.hand.currentActor;
          if (!actor) throw new Error("An active hand has no actor.");
          const profile = actor === "p0" ? options.p0Profile : options.p1Profile;
          const action = chooseAIActionForHand(playerView(match.hand, actor), profile, match.hand.actionCount, match.hand.seed);
          match = applyMatchAction(match, action);
          turns += 1;
          if (turns > maxHands * 80) throw new Error("Match exceeded its turn safety limit.");
        }
        if (match.hand.street !== "complete") throw new Error("Match left an unfinished hand without a legal next action.");
        hands += 1;
        handsCompleted += 1;
        const total = match.hand.players[0].stack + match.hand.players[1].stack;
        if (total !== settings.startingStackChips * 2) chipsConserved = false;
        if (match.status !== "match-complete") match = startNextHand(match);
      }
      if (match.status !== "match-complete") throw new Error(`Match exceeded ${maxHands} hands without elimination.`);
      const winner = match.hand.players[0].stack > match.hand.players[1].stack ? "p0" : "p1";
      outcomes[winner === "p0" ? "p0Wins" : "p1Wins"] += 1;
      matchesCompleted += 1;
    } catch (error) {
      failures.push({ match: index, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    seed: String(options.seed),
    settings,
    profiles: { p0: options.p0Profile, p1: options.p1Profile },
    matchesRequested: options.matches,
    matchesCompleted,
    handsCompleted,
    outcomes,
    averageHandsToElimination: matchesCompleted === 0 ? 0 : handsCompleted / matchesCompleted,
    chipsConserved,
    failures,
  };
}
