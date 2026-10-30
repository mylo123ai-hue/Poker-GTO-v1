import { applyAction, createHand, opponentOf } from "./engine";
import type { ActionRecord, HandResult, HandState, PlayerId, PokerAction } from "./types";

export type MatchSettings = {
  startingStackChips: number;
  smallBlindChips: number;
  bigBlindChips: number;
};

export type MatchStatus = "active" | "hand-complete" | "match-complete";

export type MatchSession = {
  id: string;
  seedRoot: string;
  handNumber: number;
  button: PlayerId;
  status: MatchStatus;
  settings: MatchSettings;
  hand: HandState;
};

export type CompletedHandRecord = {
  id: string;
  matchId: string;
  handNumber: number;
  seed: string;
  button: PlayerId;
  startingStacks: Record<PlayerId, number>;
  endingStacks: Record<PlayerId, number>;
  smallBlind: number;
  bigBlind: number;
  actions: ActionRecord[];
  board: HandState["board"];
  result: HandResult;
};

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  startingStackChips: 200,
  smallBlindChips: 1,
  bigBlindChips: 2,
};

export function validateMatchSettings(settings: MatchSettings): void {
  const { startingStackChips, smallBlindChips, bigBlindChips } = settings;
  if (!Number.isSafeInteger(startingStackChips) || startingStackChips < bigBlindChips || startingStackChips > 1_000_000) {
    throw new RangeError("Starting stack must be a whole number from one big blind to 1,000,000 chips.");
  }
  if (!Number.isSafeInteger(smallBlindChips) || smallBlindChips < 1
    || !Number.isSafeInteger(bigBlindChips) || bigBlindChips <= smallBlindChips || bigBlindChips > 100_000) {
    throw new RangeError("Use positive whole-number blinds, with the big blind larger than the small blind.");
  }
}

function beginHand(
  session: Pick<MatchSession, "id" | "seedRoot" | "settings">,
  handNumber: number,
  button: PlayerId,
  startingStacks: Record<PlayerId, number>,
): HandState {
  return createHand({
    seed: `${session.seedRoot}:hand:${handNumber}`,
    button,
    startingStacks,
    smallBlind: session.settings.smallBlindChips,
    bigBlind: session.settings.bigBlindChips,
  });
}

function statusForHand(hand: HandState): MatchStatus {
  if (hand.street !== "complete") return "active";
  if (hand.players[0].stack === 0 || hand.players[1].stack === 0) return "match-complete";
  return "hand-complete";
}

export function createMatch(options: {
  settings?: MatchSettings;
  seed?: string | number;
  id?: string;
} = {}): MatchSession {
  const settings = { ...(options.settings ?? DEFAULT_MATCH_SETTINGS) };
  validateMatchSettings(settings);
  const seedRoot = String(options.seed ?? "20261030");
  const id = options.id ?? `match:${seedRoot}:1`;
  const hand = beginHand({ id, seedRoot, settings }, 1, "p0", {
    p0: settings.startingStackChips,
    p1: settings.startingStackChips,
  });
  return { id, seedRoot, handNumber: 1, button: "p0", status: statusForHand(hand), settings, hand };
}

export function applyMatchAction(session: MatchSession, action: PokerAction): MatchSession {
  if (session.status !== "active") throw new Error("The current hand is not accepting actions.");
  const hand = applyAction(session.hand, action);
  return { ...session, hand, status: statusForHand(hand) };
}

export function startNextHand(session: MatchSession): MatchSession {
  if (session.status === "match-complete") throw new Error("The match is over because a player has been eliminated.");
  if (session.status !== "hand-complete") throw new Error("Finish the current hand before dealing another.");
  const button = opponentOf(session.button);
  const handNumber = session.handNumber + 1;
  const hand = beginHand(session, handNumber, button, {
    p0: session.hand.players[0].stack,
    p1: session.hand.players[1].stack,
  });
  return { ...session, handNumber, button, hand, status: statusForHand(hand) };
}

export function toCompletedHandRecord(session: MatchSession): CompletedHandRecord {
  const hand = session.hand;
  if (hand.street !== "complete" || !hand.result) throw new Error("Only a completed hand can be recorded.");
  return {
    id: `${session.id}:hand:${session.handNumber}`,
    matchId: session.id,
    handNumber: session.handNumber,
    seed: hand.seed,
    button: hand.button,
    startingStacks: { ...hand.startingStacks },
    endingStacks: { p0: hand.players[0].stack, p1: hand.players[1].stack },
    smallBlind: hand.smallBlind,
    bigBlind: hand.bigBlind,
    actions: hand.actions.map((item) => ({ ...item })),
    board: [...hand.board],
    result: {
      ...hand.result,
      payouts: { ...hand.result.payouts },
      refunds: { ...hand.result.refunds },
      handNames: hand.result.handNames ? { ...hand.result.handNames } : undefined,
      pots: hand.result.pots.map((pot) => ({ ...pot, eligible: [...pot.eligible], winners: [...pot.winners] })),
    },
  };
}
