import { applyAction, availableActions, createHand } from "./engine";
import type { CompletedHandRecord } from "./match";
import type { ActionRecord, HandState, PlayerId, PokerAction } from "./types";

export type Rate = { value: number | null; numerator: number; denominator: number };
export type PositionStats = {
  hands: number;
  vpip: Rate;
  pfr: Rate;
  netChips: number;
  bbPer100: number | null;
};
export type PlayerStats = {
  hands: number;
  vpip: Rate;
  pfr: Rate;
  threeBet: Rate;
  aggression: { value: number | null; aggressiveActions: number; calls: number };
  continuationBet: Rate;
  foldsToContinuationBet: Rate;
  wentToShowdown: Rate;
  wonAtShowdown: Rate;
  netChips: number;
  bbPer100: number | null;
  positions: { button: PositionStats; bigBlind: PositionStats };
};

function rate(numerator: number, denominator: number): Rate {
  return { value: denominator === 0 ? null : numerator / denominator, numerator, denominator };
}

function actionFor(record: ActionRecord): PokerAction {
  return record.type === "raise"
    ? { type: "raise", amountTo: record.amountTo ?? 0 }
    : { type: record.type };
}

export function buildReplayFrames(record: CompletedHandRecord): HandState[] {
  let state = createHand({
    seed: record.seed,
    button: record.button,
    startingStacks: record.startingStacks,
    smallBlind: record.smallBlind,
    bigBlind: record.bigBlind,
  });
  const frames = [state];
  for (const action of record.actions) {
    state = applyAction(state, actionFor(action));
    frames.push(state);
  }
  if (state.street !== "complete" || !state.result) {
    throw new Error("Saved hand history could not be replayed to a completed result.");
  }
  return frames;
}

type HandMeasures = {
  vpip: number;
  pfr: number;
  threeBetOpportunity: number;
  threeBetMade: number;
  aggressiveActions: number;
  calls: number;
  cbetOpportunity: number;
  cbetMade: number;
  facedCbet: number;
  foldedToCbet: number;
  sawFlop: number;
  showdown: number;
  showdownShare: number;
  netChips: number;
};

function measureHand(record: CompletedHandRecord, playerId: PlayerId): HandMeasures {
  let state = createHand({
    seed: record.seed,
    button: record.button,
    startingStacks: record.startingStacks,
    smallBlind: record.smallBlind,
    bigBlind: record.bigBlind,
  });
  const opponent: PlayerId = playerId === "p0" ? "p1" : "p0";
  let firstPreflopRaise: PlayerId | null = null;
  let preflopAggressor: PlayerId | null = null;
  let threeBetOpportunity = 0;
  let threeBetMade = 0;
  let cbetOpportunity = 0;
  let cbetMade = 0;
  let facedCbet = 0;
  let foldedToCbet = 0;
  let waitingForCbetResponse = false;
  let vpip = 0;
  let pfr = 0;
  let aggressiveActions = 0;
  let calls = 0;

  for (const actionRecord of record.actions) {
    const actor = state.currentActor;
    if (!actor) throw new Error("Saved hand contains an action after the hand ended.");
    const action = actionFor(actionRecord);
    const legal = availableActions(state, actor);

    if (state.street === "preflop" && actor === playerId) {
      if (action.type === "call" || action.type === "raise") vpip = 1;
      if (action.type === "raise") pfr = 1;
      if (firstPreflopRaise === opponent && legal.canRaise) {
        threeBetOpportunity = 1;
        if (action.type === "raise") threeBetMade = 1;
      }
    }

    if (state.street === "preflop" && action.type === "raise") {
      if (firstPreflopRaise === null) firstPreflopRaise = actor;
      preflopAggressor = actor;
    }

    if (actor === playerId) {
      if (action.type === "raise") aggressiveActions += 1;
      if (action.type === "call") calls += 1;
      if (waitingForCbetResponse && state.street === "flop" && legal.toCall > 0) {
        facedCbet = 1;
        if (action.type === "fold") foldedToCbet = 1;
        waitingForCbetResponse = false;
      }
    }

    if (state.street === "flop" && actor === preflopAggressor && state.currentBet === 0) {
      if (actor === playerId && legal.canRaise) {
        cbetOpportunity = 1;
        if (action.type === "raise") cbetMade = 1;
      }
      if (actor === opponent && action.type === "raise") waitingForCbetResponse = true;
    }

    state = applyAction(state, action);
  }

  if (!state.result || state.street !== "complete") throw new Error("Saved hand history is incomplete.");
  const netChips = record.endingStacks[playerId] - record.startingStacks[playerId];
  const showdownPot = state.result.pots.reduce((sum, pot) => sum + pot.amount, 0);
  const wonShowdownShare = state.result.reason === "showdown"
    ? state.result.pots.reduce((sum, pot) => sum + (pot.winners.includes(playerId) ? pot.amount / pot.winners.length : 0), 0)
    : 0;
  const showdownShare = showdownPot > 0 ? wonShowdownShare / showdownPot : 0;
  return {
    vpip,
    pfr,
    threeBetOpportunity,
    threeBetMade,
    aggressiveActions,
    calls,
    cbetOpportunity,
    cbetMade,
    facedCbet,
    foldedToCbet,
    sawFlop: record.board.length >= 3 ? 1 : 0,
    showdown: state.result.reason === "showdown" ? 1 : 0,
    showdownShare,
    netChips,
  };
}

function bbPer100(netBigBlinds: number, hands: number): number | null {
  return hands === 0 ? null : netBigBlinds * 100 / hands;
}

function positionStats(records: CompletedHandRecord[], playerId: PlayerId): { button: PositionStats; bigBlind: PositionStats } {
  const result = {} as Record<"button" | "bigBlind", PositionStats>;
  for (const position of ["button", "bigBlind"] as const) {
    const selected = records.filter((record) => (record.button === playerId ? "button" : "bigBlind") === position);
    let vpip = 0;
    let pfr = 0;
    let netChips = 0;
    let netBigBlinds = 0;
    for (const record of selected) {
      const measure = measureHand(record, playerId);
      vpip += measure.vpip;
      pfr += measure.pfr;
      netChips += measure.netChips;
      netBigBlinds += measure.netChips / record.bigBlind;
    }
    result[position] = {
      hands: selected.length,
      vpip: rate(vpip, selected.length),
      pfr: rate(pfr, selected.length),
      netChips,
      bbPer100: bbPer100(netBigBlinds, selected.length),
    };
  }
  return { button: result.button, bigBlind: result.bigBlind };
}

export function calculatePlayerStats(records: CompletedHandRecord[], playerId: PlayerId = "p0"): PlayerStats {
  let vpip = 0;
  let pfr = 0;
  let threeBetOpportunity = 0;
  let threeBetMade = 0;
  let aggressiveActions = 0;
  let calls = 0;
  let cbetOpportunity = 0;
  let cbetMade = 0;
  let facedCbet = 0;
  let foldedToCbet = 0;
  let sawFlop = 0;
  let showdowns = 0;
  let showdownShare = 0;
  let netChips = 0;
  let netBigBlinds = 0;

  for (const record of records) {
    const measure = measureHand(record, playerId);
    vpip += measure.vpip;
    pfr += measure.pfr;
    threeBetOpportunity += measure.threeBetOpportunity;
    threeBetMade += measure.threeBetMade;
    aggressiveActions += measure.aggressiveActions;
    calls += measure.calls;
    cbetOpportunity += measure.cbetOpportunity;
    cbetMade += measure.cbetMade;
    facedCbet += measure.facedCbet;
    foldedToCbet += measure.foldedToCbet;
    sawFlop += measure.sawFlop;
    showdowns += measure.showdown;
    showdownShare += measure.showdownShare;
    netChips += measure.netChips;
    netBigBlinds += measure.netChips / record.bigBlind;
  }

  const hands = records.length;
  return {
    hands,
    vpip: rate(vpip, hands),
    pfr: rate(pfr, hands),
    threeBet: rate(threeBetMade, threeBetOpportunity),
    aggression: { value: calls === 0 ? null : aggressiveActions / calls, aggressiveActions, calls },
    continuationBet: rate(cbetMade, cbetOpportunity),
    foldsToContinuationBet: rate(foldedToCbet, facedCbet),
    wentToShowdown: rate(showdowns, sawFlop),
    wonAtShowdown: rate(showdownShare, showdowns),
    netChips,
    bbPer100: bbPer100(netBigBlinds, hands),
    positions: positionStats(records, playerId),
  };
}

export type LeakIndicator = { id: string; label: string; detail: string; severity: "watch" | "info" };

export function findLeakIndicators(stats: PlayerStats): LeakIndicator[] {
  const indicators: LeakIndicator[] = [];
  if (stats.hands < 20) {
    indicators.push({ id: "sample", severity: "info", label: "Building a sample", detail: `Play ${20 - stats.hands} more hands before common-leak checks are shown.` });
    return indicators;
  }
  if (stats.vpip.value !== null && stats.pfr.value !== null && stats.vpip.value - stats.pfr.value > 0.25) {
    indicators.push({ id: "passive-preflop", severity: "watch", label: "Large VPIP–PFR gap", detail: `You entered ${Math.round((stats.vpip.value - stats.pfr.value) * 100)} points more often than you raised over ${stats.hands} hands; review calls versus raises.` });
  }
  if (stats.foldsToContinuationBet.denominator >= 5 && stats.foldsToContinuationBet.value !== null && stats.foldsToContinuationBet.value > 0.6) {
    indicators.push({ id: "fold-to-cbet", severity: "watch", label: "Frequent folds to flop continuation bets", detail: `${stats.foldsToContinuationBet.numerator} folds in ${stats.foldsToContinuationBet.denominator} opportunities; check the board and price in each hand review.` });
  }
  if (stats.wonAtShowdown.denominator >= 10 && stats.wonAtShowdown.value !== null && stats.wonAtShowdown.value < 0.4) {
    indicators.push({ id: "showdown", severity: "watch", label: "Low showdown win share", detail: `Win share is ${Math.round(stats.wonAtShowdown.value * 100)}% over ${stats.wonAtShowdown.denominator} showdowns; review calls and hand strength.` });
  }
  if (indicators.length === 0) indicators.push({ id: "no-signal", severity: "info", label: "No common leak signal", detail: `No configured indicator crossed its review threshold in this ${stats.hands}-hand sample. This is not a strategy grade.` });
  return indicators;
}
