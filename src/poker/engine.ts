import { compareHands, evaluateBest } from "./evaluate";
import { shuffledDeck } from "./random";
import type {
  AvailableActions,
  Card,
  HandResult,
  HandState,
  PlayerId,
  PokerAction,
  PlayerState,
  SidePot,
} from "./types";

export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const DEFAULT_STACK = 200;

export function opponentOf(player: PlayerId): PlayerId {
  return player === "p0" ? "p1" : "p0";
}

export function potSize(state: HandState): number {
  return state.players[0].totalCommitted + state.players[1].totalCommitted;
}

function playerIndex(id: PlayerId): 0 | 1 {
  return id === "p0" ? 0 : 1;
}

function copyState(state: HandState): HandState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, holeCards: [...player.holeCards] })) as HandState["players"],
    board: [...state.board],
    actedThisStreet: [...state.actedThisStreet],
    raiseRights: [...state.raiseRights],
    actions: [...state.actions],
    result: state.result ? {
      ...state.result,
      payouts: { ...state.result.payouts },
      refunds: { ...state.result.refunds },
      handNames: state.result.handNames ? { ...state.result.handNames } : undefined,
      pots: state.result.pots.map((pot) => ({ ...pot, eligible: [...pot.eligible], winners: [...pot.winners] })),
    } : null,
  };
}

function takeCard(state: HandState): Card {
  const card = state.deck[state.deckCursor];
  if (!card) throw new Error("The deck is empty before the hand is complete.");
  state.deckCursor += 1;
  return card;
}

function pay(player: PlayerState, amount: number): number {
  const paid = Math.min(Math.max(0, amount), player.stack);
  player.stack -= paid;
  player.streetCommitted += paid;
  player.totalCommitted += paid;
  player.allIn = player.stack === 0;
  return paid;
}

function putOnStreet(state: HandState, playerId: PlayerId, target: number): number {
  const player = state.players[playerIndex(playerId)];
  return pay(player, Math.max(0, target - player.streetCommitted));
}

function newPlayer(id: PlayerId, label: string, stack: number): PlayerState {
  return {
    id,
    label,
    stack,
    holeCards: [],
    streetCommitted: 0,
    totalCommitted: 0,
    folded: false,
    allIn: false,
  };
}

export function createHand(options: {
  seed: string | number;
  button?: PlayerId;
  stack?: number;
}): HandState {
  const stack = options.stack ?? DEFAULT_STACK;
  if (!Number.isSafeInteger(stack) || stack < BIG_BLIND) {
    throw new RangeError(`Each starting stack must be an integer of at least ${BIG_BLIND} chips.`);
  }
  const button = options.button ?? "p0";
  const blind = opponentOf(button);
  const state: HandState = {
    seed: String(options.seed),
    deck: shuffledDeck(options.seed),
    deckCursor: 0,
    players: [newPlayer("p0", "You", stack), newPlayer("p1", "Opponent", stack)],
    board: [],
    button,
    street: "preflop",
    currentActor: button,
    currentBet: BIG_BLIND,
    lastFullRaise: BIG_BLIND,
    actedThisStreet: [],
    raiseRights: ["p0", "p1"],
    actions: [],
    actionCount: 0,
    initialStack: stack,
    originalPot: 0,
    result: null,
  };

  const firstCard = takeCard(state);
  const secondCard = takeCard(state);
  const thirdCard = takeCard(state);
  const fourthCard = takeCard(state);
  state.players[playerIndex(button)].holeCards = [firstCard, thirdCard];
  state.players[playerIndex(blind)].holeCards = [secondCard, fourthCard];
  putOnStreet(state, button, SMALL_BLIND);
  putOnStreet(state, blind, BIG_BLIND);
  state.originalPot = potSize(state);

  return state;
}

export function availableActions(state: HandState, playerId: PlayerId): AvailableActions {
  const player = state.players[playerIndex(playerId)];
  const opponent = state.players[playerIndex(opponentOf(playerId))];
  const isTurn = state.currentActor === playerId && state.street !== "complete";
  const toCall = Math.max(0, state.currentBet - player.streetCommitted);
  const maxRaiseTo = Math.max(state.currentBet, player.streetCommitted + player.stack);
  const minFullRaiseTo = state.currentBet === 0
    ? state.lastFullRaise
    : state.currentBet + state.lastFullRaise;
  const minRaiseTo = Math.min(maxRaiseTo, minFullRaiseTo);
  const canRaise = isTurn
    && !player.allIn
    && !opponent.allIn
    && state.raiseRights.includes(playerId)
    && maxRaiseTo > state.currentBet;
  return {
    toCall,
    canFold: isTurn && toCall > 0,
    canCheck: isTurn && toCall === 0,
    canCall: isTurn && toCall > 0 && player.stack > 0,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
    callAmount: Math.min(toCall, player.stack),
  };
}

export function playerView(state: HandState, playerId: PlayerId): import("./types").PlayerView {
  const actions = availableActions(state, playerId);
  return {
    player: playerId,
    ownCards: [...state.players[playerIndex(playerId)].holeCards],
    board: [...state.board],
    street: state.street,
    pot: potSize(state),
    stack: state.players[playerIndex(playerId)].stack,
    toCall: actions.toCall,
    callAmount: actions.callAmount,
    canCheck: actions.canCheck,
    canRaise: actions.canRaise,
    minRaiseTo: actions.minRaiseTo,
    maxRaiseTo: actions.maxRaiseTo,
    position: playerId === state.button ? "button" : "big blind",
  };
}

function logAction(state: HandState, player: PlayerId, action: PokerAction, amount: number): void {
  state.actions.push({
    player,
    type: action.type,
    street: state.street as Exclude<HandState["street"], "complete">,
    amount,
    ...(action.type === "raise" ? { amountTo: action.amountTo } : {}),
  });
  state.actionCount += 1;
}

function recordActed(state: HandState, playerId: PlayerId): void {
  if (!state.actedThisStreet.includes(playerId)) state.actedThisStreet.push(playerId);
}

function isStreetComplete(state: HandState): boolean {
  const bothActed = state.actedThisStreet.includes("p0") && state.actedThisStreet.includes("p1");
  const betsMatched = state.players[0].streetCommitted === state.players[1].streetCommitted;
  if (bothActed && betsMatched) return true;
  if (state.players.some((player) => player.allIn)) {
    if (!state.currentActor) return true;
    const actor = state.players[playerIndex(state.currentActor)];
    return actor.allIn || actor.streetCommitted >= state.currentBet;
  }
  return false;
}

function returnUncalledExcess(state: HandState, refunds: Record<PlayerId, number>): void {
  const [first, second] = state.players;
  if (first.totalCommitted === second.totalCommitted) return;
  const leader = first.totalCommitted > second.totalCommitted ? first : second;
  const trailing = first.totalCommitted > second.totalCommitted ? second : first;
  if (leader.folded) return;
  const excess = leader.totalCommitted - trailing.totalCommitted;
  leader.totalCommitted -= excess;
  leader.streetCommitted = Math.max(0, leader.streetCommitted - excess);
  leader.stack += excess;
  leader.allIn = leader.stack === 0;
  refunds[leader.id] += excess;
  state.originalPot -= excess;
}

export function calculateSidePots(
  contributions: Record<PlayerId, number>,
  folded: PlayerId[] = [],
): { pots: SidePot[]; refunds: Record<PlayerId, number> } {
  const refunds: Record<PlayerId, number> = { p0: 0, p1: 0 };
  const levels = [...new Set(Object.values(contributions).filter((value) => value > 0))].sort((a, b) => a - b);
  const pots: SidePot[] = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = (Object.keys(contributions) as PlayerId[])
      .filter((id) => contributions[id] >= level);
    const amount = (level - previous) * contributors.length;
    previous = level;
    if (contributors.length === 1) {
      refunds[contributors[0]!] += amount;
      continue;
    }
    const eligible = contributors.filter((id) => !folded.includes(id));
    if (eligible.length === 0) throw new Error("A committed pot has no eligible player.");
    pots.push({ amount, eligible });
  }
  return { pots, refunds };
}

function awardShowdown(state: HandState, refunds: Record<PlayerId, number>): HandResult {
  const sidePotState = calculateSidePots(
    { p0: state.players[0].totalCommitted, p1: state.players[1].totalCommitted },
    state.players.filter((player) => player.folded).map((player) => player.id),
  );
  for (const playerId of ["p0", "p1"] as const) refunds[playerId] += sidePotState.refunds[playerId];
  for (const playerId of ["p0", "p1"] as const) {
    const player = state.players[playerIndex(playerId)];
    player.totalCommitted -= sidePotState.refunds[playerId];
    player.stack += sidePotState.refunds[playerId];
  }

  const payouts: Record<PlayerId, number> = { p0: 0, p1: 0 };
  const pots: HandResult["pots"] = [];
  const handValues = new Map<PlayerId, ReturnType<typeof evaluateBest>>();
  const activePlayers = state.players.filter((player) => !player.folded);
  for (const player of activePlayers) handValues.set(player.id, evaluateBest([...player.holeCards, ...state.board]));
  const oddChipOrder = [opponentOf(state.button), state.button];

  for (const pot of sidePotState.pots) {
    let best: PlayerId | null = null;
    let winners: PlayerId[] = [];
    for (const id of pot.eligible) {
      if (best === null) {
        best = id;
        winners = [id];
      } else {
        const comparison = compareHands(
          state.players[playerIndex(id)].holeCards.concat(state.board),
          state.players[playerIndex(best)].holeCards.concat(state.board),
        );
        if (comparison > 0) {
          best = id;
          winners = [id];
        } else if (comparison === 0) {
          winners.push(id);
        }
      }
    }
    const share = Math.floor(pot.amount / winners.length);
    let oddChips = pot.amount - share * winners.length;
    for (const id of winners) payouts[id] += share;
    for (const id of oddChipOrder) {
      if (oddChips > 0 && winners.includes(id)) {
        payouts[id] += 1;
        oddChips -= 1;
      }
    }
    pots.push({ amount: pot.amount, eligible: [...pot.eligible], winners: [...winners] });
  }

  for (const id of ["p0", "p1"] as const) state.players[playerIndex(id)].stack += payouts[id];
  const winner: HandResult["winner"] = payouts.p0 === payouts.p1 ? "tie" : payouts.p0 > payouts.p1 ? "p0" : "p1";
  return {
    winner,
    reason: "showdown",
    pot: payouts.p0 + payouts.p1,
    payouts,
    refunds,
    handNames: {
      ...(handValues.has("p0") ? { p0: handValues.get("p0")!.category } : {}),
      ...(handValues.has("p1") ? { p1: handValues.get("p1")!.category } : {}),
    },
    pots,
  };
}

function completeHand(state: HandState, result: HandResult): void {
  state.result = result;
  state.street = "complete";
  state.currentActor = null;
  state.currentBet = 0;
  state.actedThisStreet = [];
  state.raiseRights = [];
}

function showdown(state: HandState): void {
  const refunds: Record<PlayerId, number> = { p0: 0, p1: 0 };
  returnUncalledExcess(state, refunds);
  const result = awardShowdown(state, refunds);
  completeHand(state, result);
}

function runOut(state: HandState): void {
  while (state.board.length < 5) {
    dealNextStreet(state);
  }
  showdown(state);
}

function dealNextStreet(state: HandState): void {
  if (state.street === "preflop") {
    takeCard(state); // burn
    state.board.push(takeCard(state), takeCard(state), takeCard(state));
    state.street = "flop";
  } else if (state.street === "flop") {
    takeCard(state);
    state.board.push(takeCard(state));
    state.street = "turn";
  } else if (state.street === "turn") {
    takeCard(state);
    state.board.push(takeCard(state));
    state.street = "river";
  } else {
    showdown(state);
    return;
  }
  state.players[0].streetCommitted = 0;
  state.players[1].streetCommitted = 0;
  state.currentBet = 0;
  state.lastFullRaise = BIG_BLIND;
  state.actedThisStreet = [];
  state.raiseRights = ["p0", "p1"];
  state.currentActor = opponentOf(state.button);
}

function closeStreet(state: HandState): void {
  if (state.players.some((player) => player.allIn)) {
    runOut(state);
    return;
  }
  if (state.board.length === 5) {
    showdown(state);
    return;
  }
  dealNextStreet(state);
}

export function applyAction(state: HandState, action: PokerAction): HandState {
  const next = copyState(state);
  const actor = next.currentActor;
  if (!actor) throw new Error("There is no player to act.");
  const available = availableActions(next, actor);
  const player = next.players[playerIndex(actor)];
  const opponent = next.players[playerIndex(opponentOf(actor))];
  let paid = 0;

  if (action.type === "fold") {
    if (!available.canFold) throw new Error("Folding is not legal in this spot.");
    player.folded = true;
    const pot = potSize(next);
    const payouts: Record<PlayerId, number> = { p0: 0, p1: 0 };
    payouts[opponent.id] = pot;
    opponent.stack += pot;
    const result: HandResult = {
      winner: opponent.id,
      reason: "fold",
      pot,
      payouts,
      refunds: { p0: 0, p1: 0 },
      pots: [{ amount: pot, eligible: [opponent.id], winners: [opponent.id] }],
    };
    logAction(next, actor, action, 0);
    completeHand(next, result);
    return next;
  }

  if (action.type === "check") {
    if (!available.canCheck) throw new Error("Checking is not legal while facing a bet.");
    recordActed(next, actor);
    logAction(next, actor, action, 0);
    next.currentActor = opponent.id;
  } else if (action.type === "call") {
    if (!available.canCall) throw new Error("Calling is not legal in this spot.");
    paid = pay(player, available.callAmount);
    recordActed(next, actor);
    next.originalPot = potSize(next);
    logAction(next, actor, action, paid);
    next.currentActor = opponent.id;
  } else {
    if (!available.canRaise) throw new Error("Raising is not legal in this spot.");
    const target = action.amountTo;
    if (!Number.isSafeInteger(target) || target <= next.currentBet || target > available.maxRaiseTo) {
      throw new Error(`Raise target must be an integer between ${next.currentBet + 1} and ${available.maxRaiseTo}.`);
    }
    if (target < available.minRaiseTo && target !== available.maxRaiseTo) {
      throw new Error(`Raise target must be at least ${available.minRaiseTo}, except for a short all-in raise.`);
    }
    const previousBet = next.currentBet;
    paid = putOnStreet(next, actor, target);
    const raiseSize = target - previousBet;
    next.currentBet = Math.max(next.currentBet, player.streetCommitted);
    if (raiseSize >= next.lastFullRaise) {
      next.lastFullRaise = raiseSize;
      next.actedThisStreet = [actor];
      next.raiseRights = [opponent.id];
    } else {
      recordActed(next, actor);
      next.raiseRights = next.raiseRights.filter((id) => id !== actor);
    }
    next.originalPot = potSize(next);
    logAction(next, actor, action, paid);
    next.currentActor = opponent.id;
  }

  if (isStreetComplete(next)) {
    closeStreet(next);
  }
  return next;
}

export function recommendBetTo(state: HandState, fractionOfPot: number): number {
  if (!state.currentActor) return 0;
  const actor = state.currentActor;
  const actions = availableActions(state, actor);
  if (!actions.canRaise) return 0;
  const potAfterCall = potSize(state) + actions.toCall;
  const desiredRaise = Math.ceil(potAfterCall * Math.max(0, fractionOfPot));
  const desiredTo = state.currentBet + Math.max(1, desiredRaise);
  return Math.min(actions.maxRaiseTo, Math.max(actions.minRaiseTo, desiredTo));
}
