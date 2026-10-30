import { DEFAULT_MATCH_SETTINGS, applyMatchAction, createMatch, startNextHand, toCompletedHandRecord } from "./match";
import type { CompletedHandRecord, MatchSession, MatchSettings } from "./match";
import { applyAction, createHand } from "./engine";
import type { Card, HandResult, HandState, OpponentProfile, PlayerId, PokerAction } from "./types";

export const TRAINER_STORAGE_KEY = "poker-trainer-session-v1";
export const MAX_SAVED_HANDS = 500;
export const MAX_SAVED_DECISIONS = 2_000;
export type CoachMode = "beginner" | "practice" | "challenge";

export type CompletedMatchRecord = {
  id: string;
  seed: string;
  hands: number;
  winner: PlayerId;
  finalStacks: Record<PlayerId, number>;
};

export type CoachProgress = {
  practiceHintsRequested: number;
  recommendationsUsed: number;
  challengeReviews: number;
  handReviewsOpened: number;
};

export type CoachDecisionRecord = {
  id: string;
  matchId: string;
  handNumber: number;
  street: "preflop" | "flop" | "turn" | "river";
  board: Card[];
  ownCards: Card[];
  position: "button" | "big blind";
  pot: number;
  callAmount: number;
  chosenAction: PokerAction;
  recommendedAction: PokerAction;
  recommendationLabel: string;
  rationale: string;
};

export type TrainerData = {
  version: 2;
  matchesStarted: number;
  match: MatchSession;
  profile: OpponentProfile;
  coachMode: CoachMode;
  history: CompletedHandRecord[];
  decisions: CoachDecisionRecord[];
  completedMatches: CompletedMatchRecord[];
  coaching: CoachProgress;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type MatchSave = Omit<MatchSession, "hand"> & {
  hand: { startingStacks: Record<PlayerId, number>; actions: HandState["actions"] };
};
type SavedTrainerData = Omit<TrainerData, "match"> & { match: MatchSave };

const PROFILES: OpponentProfile[] = ["tight", "caller", "aggressive", "balanced"];
const ACTION_TYPES = ["fold", "check", "call", "raise"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === "p0" || value === "p1";
}

function isCard(value: unknown): value is Card {
  return isRecord(value)
    && isInteger(value.rank, 2, 14)
    && ["clubs", "diamonds", "hearts", "spades"].includes(String(value.suit));
}

function isResult(value: unknown): value is HandResult {
  if (!isRecord(value) || !["p0", "p1", "tie"].includes(String(value.winner))
    || !["fold", "showdown"].includes(String(value.reason))
    || !isInteger(value.pot) || !isRecord(value.payouts) || !isRecord(value.refunds) || !Array.isArray(value.pots)) return false;
  if (!isInteger(value.payouts.p0) || !isInteger(value.payouts.p1)
    || !isInteger(value.refunds.p0) || !isInteger(value.refunds.p1)) return false;
  return value.pots.every((pot) => isRecord(pot)
    && isInteger(pot.amount)
    && Array.isArray(pot.eligible) && pot.eligible.every(isPlayerId)
    && Array.isArray(pot.winners) && pot.winners.every(isPlayerId));
}

function isCompletedHand(value: unknown): value is CompletedHandRecord {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.matchId !== "string"
    || !isInteger(value.handNumber, 1) || typeof value.seed !== "string" || !isPlayerId(value.button)
    || !isRecord(value.startingStacks) || !isInteger(value.startingStacks.p0, 1) || !isInteger(value.startingStacks.p1, 1)
    || !isRecord(value.endingStacks) || !isInteger(value.endingStacks.p0) || !isInteger(value.endingStacks.p1)
    || !isInteger(value.smallBlind, 1) || !isInteger(value.bigBlind, 2) || value.bigBlind <= value.smallBlind
    || !Array.isArray(value.actions) || !Array.isArray(value.board) || value.board.length > 5 || !value.board.every(isCard)
    || !isResult(value.result)) return false;
  return value.actions.every((action) => isRecord(action)
    && isPlayerId(action.player)
    && ACTION_TYPES.includes(action.type as (typeof ACTION_TYPES)[number])
    && ["preflop", "flop", "turn", "river"].includes(String(action.street))
    && isInteger(action.amount)
    && (action.type !== "raise" || isInteger(action.amountTo, 1)));
}

function isPokerAction(value: unknown): value is PokerAction {
  return isRecord(value) && ACTION_TYPES.includes(value.type as (typeof ACTION_TYPES)[number])
    && (value.type !== "raise" || isInteger(value.amountTo, 1));
}

function isDecision(value: unknown): value is CoachDecisionRecord {
  return isRecord(value) && typeof value.id === "string" && typeof value.matchId === "string"
    && isInteger(value.handNumber, 1) && ["preflop", "flop", "turn", "river"].includes(String(value.street))
    && Array.isArray(value.board) && value.board.length <= 5 && value.board.every(isCard)
    && Array.isArray(value.ownCards) && value.ownCards.length === 2 && value.ownCards.every(isCard)
    && ["button", "big blind"].includes(String(value.position))
    && isInteger(value.pot) && isInteger(value.callAmount)
    && isPokerAction(value.chosenAction) && isPokerAction(value.recommendedAction)
    && typeof value.recommendationLabel === "string" && typeof value.rationale === "string";
}

function isActionRecord(value: unknown): value is HandState["actions"][number] {
  return isRecord(value) && isPlayerId(value.player)
    && ACTION_TYPES.includes(value.type as (typeof ACTION_TYPES)[number])
    && ["preflop", "flop", "turn", "river"].includes(String(value.street))
    && isInteger(value.amount)
    && (value.type !== "raise" || isInteger(value.amountTo, 1));
}

function isMatchSave(value: unknown): value is MatchSave {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.seedRoot !== "string"
    || !isInteger(value.handNumber, 1) || !isPlayerId(value.button)
    || !["active", "hand-complete", "match-complete"].includes(String(value.status))
    || !isRecord(value.settings) || !isInteger(value.settings.startingStackChips, 2, 1_000_000)
    || !isInteger(value.settings.smallBlindChips, 1, 100_000)
    || !isInteger(value.settings.bigBlindChips, 2, 100_000)
    || value.settings.bigBlindChips <= value.settings.smallBlindChips
    || !isRecord(value.hand) || !isRecord(value.hand.startingStacks)
    || !isInteger(value.hand.startingStacks.p0, 1) || !isInteger(value.hand.startingStacks.p1, 1)
    || !Array.isArray(value.hand.actions) || !value.hand.actions.every(isActionRecord)) return false;
  return true;
}

function isTrainerData(value: unknown): value is SavedTrainerData {
  if (!isRecord(value) || value.version !== 2 || !isInteger(value.matchesStarted, 1)
    || !isMatchSave(value.match) || !PROFILES.includes(value.profile as OpponentProfile)
    || !["beginner", "practice", "challenge"].includes(String(value.coachMode))
    || !Array.isArray(value.history) || !value.history.every(isCompletedHand)
    || !Array.isArray(value.decisions) || !value.decisions.every(isDecision)
    || !Array.isArray(value.completedMatches) || !isRecord(value.coaching)) return false;
  const coaching = value.coaching;
  if (!isRecord(coaching) || !isInteger(coaching.practiceHintsRequested) || !isInteger(coaching.recommendationsUsed)
    || !isInteger(coaching.challengeReviews) || !isInteger(coaching.handReviewsOpened)) return false;
  return value.completedMatches.every((item) => isRecord(item)
    && typeof item.id === "string" && typeof item.seed === "string" && isInteger(item.hands, 1)
    && isPlayerId(item.winner) && isRecord(item.finalStacks)
    && isInteger(item.finalStacks.p0) && isInteger(item.finalStacks.p1));
}

export function createDefaultTrainerData(): TrainerData {
  return {
    version: 2,
    matchesStarted: 1,
    match: createMatch({ settings: DEFAULT_MATCH_SETTINGS, seed: "20261030", id: "match:20261030:1" }),
    profile: "balanced",
    coachMode: "beginner",
    history: [],
    decisions: [],
    completedMatches: [],
    coaching: { practiceHintsRequested: 0, recommendationsUsed: 0, challengeReviews: 0, handReviewsOpened: 0 },
  };
}

export function loadTrainerData(storage: StorageLike): { data: TrainerData; recovered: boolean } {
  let raw: string | null;
  try {
    raw = storage.getItem(TRAINER_STORAGE_KEY);
  } catch {
    return { data: createDefaultTrainerData(), recovered: true };
  }
  if (raw === null) return { data: createDefaultTrainerData(), recovered: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isTrainerData(parsed)) {
      let hand = createHand({
        seed: `${parsed.match.seedRoot}:hand:${parsed.match.handNumber}`,
        button: parsed.match.button,
        startingStacks: parsed.match.hand.startingStacks,
        smallBlind: parsed.match.settings.smallBlindChips,
        bigBlind: parsed.match.settings.bigBlindChips,
      });
      for (const item of parsed.match.hand.actions) {
        const action: PokerAction = item.type === "raise"
          ? { type: "raise", amountTo: item.amountTo ?? 0 }
          : { type: item.type };
        hand = applyAction(hand, action);
      }
      const restoredStatus = hand.street !== "complete" ? "active"
        : hand.players[0].stack === 0 || hand.players[1].stack === 0 ? "match-complete" : "hand-complete";
      if (restoredStatus !== parsed.match.status || hand.button !== parsed.match.button) throw new Error("Saved hand state is inconsistent.");
      return {
        data: {
          ...parsed,
          match: { ...parsed.match, hand },
          history: parsed.history.slice(-MAX_SAVED_HANDS),
          decisions: parsed.decisions.slice(-MAX_SAVED_DECISIONS),
          completedMatches: parsed.completedMatches.slice(-100),
        },
        recovered: false,
      };
    }
  } catch {
    // Invalid local state is discarded below; the game remains available.
  }
  return { data: createDefaultTrainerData(), recovered: true };
}

export function saveTrainerData(storage: StorageLike, data: TrainerData): boolean {
  try {
    const { hand, ...match } = data.match;
    const safeData: SavedTrainerData = {
      ...data,
      match: {
        ...match,
        hand: {
          startingStacks: { ...hand.startingStacks },
          actions: hand.actions.map((action) => ({ ...action })),
        },
      },
    };
    storage.setItem(TRAINER_STORAGE_KEY, JSON.stringify({
      ...safeData,
      history: data.history.slice(-MAX_SAVED_HANDS),
      decisions: data.decisions.slice(-MAX_SAVED_DECISIONS),
      completedMatches: data.completedMatches.slice(-100),
    }));
    return true;
  } catch {
    return false;
  }
}

function addCompletedMatch(data: TrainerData, match: MatchSession): CompletedMatchRecord[] {
  if (match.status !== "match-complete" || data.completedMatches.some((item) => item.id === match.id)) return data.completedMatches;
  const p0Stack = match.hand.players[0].stack;
  const p1Stack = match.hand.players[1].stack;
  const winner: PlayerId = p0Stack > p1Stack ? "p0" : "p1";
  return [...data.completedMatches, {
    id: match.id,
    seed: match.seedRoot,
    hands: match.handNumber,
    winner,
    finalStacks: { p0: p0Stack, p1: p1Stack },
  }].slice(-100);
}

export function applyTrainerAction(data: TrainerData, action: PokerAction): TrainerData {
  const before = data.match;
  const match = applyMatchAction(before, action);
  const completed = before.hand.street !== "complete" && match.hand.street === "complete";
  const history = completed
    ? [...data.history, toCompletedHandRecord(match)].slice(-MAX_SAVED_HANDS)
    : data.history;
  return {
    ...data,
    match,
    history,
    completedMatches: addCompletedMatch(data, match),
  };
}

export function dealTrainerNextHand(data: TrainerData): TrainerData {
  const match = startNextHand(data.match);
  const completed = match.hand.street === "complete";
  return {
    ...data,
    match,
    history: completed ? [...data.history, toCompletedHandRecord(match)].slice(-MAX_SAVED_HANDS) : data.history,
    completedMatches: addCompletedMatch(data, match),
  };
}

export function startTrainerMatch(data: TrainerData, settings: MatchSettings, seed: string): TrainerData {
  const matchCount = data.matchesStarted + 1;
  const id = `match:${seed}:${matchCount}`;
  const match = createMatch({ settings, seed, id });
  return {
    ...data,
    matchesStarted: matchCount,
    match,
    completedMatches: addCompletedMatch(data, data.match),
  };
}

export function updateCoachingProgress(data: TrainerData, field: keyof CoachProgress): TrainerData {
  return { ...data, coaching: { ...data.coaching, [field]: data.coaching[field] + 1 } };
}

export function recordCoachDecision(data: TrainerData, decision: CoachDecisionRecord): TrainerData {
  return { ...data, decisions: [...data.decisions, decision].slice(-MAX_SAVED_DECISIONS) };
}
