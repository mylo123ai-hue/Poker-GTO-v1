import { evaluateBest } from "./evaluate";
import { createRng } from "./random";
import type { OpponentProfile, PlayerView, PokerAction } from "./types";

export const OPPONENT_PROFILES: { id: OpponentProfile; name: string; description: string }[] = [
  { id: "tight", name: "Tight", description: "Folds marginal hands and mostly plays for value." },
  { id: "caller", name: "Calling station", description: "Calls too often and rarely raises." },
  { id: "aggressive", name: "Aggressive", description: "Raises and bluffs more often than the other profiles." },
  { id: "balanced", name: "Balanced", description: "Mixes checks, calls, and value raises using a simple heuristic." },
];

export function approximateHandStrength(view: Pick<PlayerView, "ownCards" | "board">): number {
  const cards = [...view.ownCards, ...view.board];
  if (cards.length < 5) {
    const [first, second] = view.ownCards;
    if (!first || !second) return 0;
    const high = Math.max(first.rank, second.rank);
    const low = Math.min(first.rank, second.rank);
    if (first.rank === second.rank) return Math.min(0.94, 0.37 + (high - 2) * 0.044);
    const gap = high - low - 1;
    const suited = first.suit === second.suit;
    return Math.max(0.18, Math.min(0.83,
      0.17 + (high - 2) * 0.027 + (low - 2) * 0.012 + (suited ? 0.075 : 0) + (gap <= 1 ? 0.055 : -gap * 0.018),
    ));
  }

  const value = evaluateBest(cards);
  const topRank = value.rank[1] ?? 2;
  const kicker = (topRank - 2) / 12;
  const categoryBaselines = [0.2, 0.39, 0.62, 0.74, 0.82, 0.87, 0.93, 0.975, 0.992];
  return Math.min(0.999, (categoryBaselines[value.rank[0] ?? 0] ?? 0.2) + kicker * 0.045);
}

function raiseAction(view: PlayerView, sizing: number): PokerAction | null {
  if (!view.canRaise) return null;
  const potAfterCall = view.pot + view.toCall;
  const desiredTo = view.toCall === 0
    ? Math.ceil(potAfterCall * sizing)
    : view.minRaiseTo + Math.ceil(potAfterCall * sizing);
  const target = Math.min(view.maxRaiseTo, Math.max(view.minRaiseTo, desiredTo));
  return { type: "raise", amountTo: target };
}

export function chooseAIAction(
  view: PlayerView,
  profile: OpponentProfile,
  random: () => number = createRng(`${profile}:${view.player}:${view.street}:${view.pot}:${view.ownCards.map((card) => `${card.rank}${card.suit}`).join("-")}`),
): PokerAction {
  const strength = approximateHandStrength(view);
  const potOdds = view.toCall > 0 ? view.toCall / (view.pot + view.toCall) : 0;
  const roll = random();

  if (view.toCall === 0) {
    const aggression = {
      tight: strength > 0.8 ? 0.12 : 0,
      caller: strength > 0.87 ? 0.07 : 0,
      aggressive: strength > 0.64 ? 0.54 : 0.22,
      balanced: strength > 0.74 ? 0.28 : 0.035,
    }[profile];
    if (roll < aggression) {
      const sized = raiseAction(view, profile === "aggressive" ? 0.55 : 0.25);
      if (sized) return sized;
    }
    return { type: "check" };
  }

  if (profile === "tight") {
    if (strength > 0.84 && roll < 0.2) return raiseAction(view, 0.3) ?? { type: "call" };
    return strength < potOdds + 0.13 ? { type: "fold" } : { type: "call" };
  }
  if (profile === "caller") {
    if (strength > 0.93 && roll < 0.055) return raiseAction(view, 0.25) ?? { type: "call" };
    return strength < 0.09 && view.toCall > view.pot * 0.65 ? { type: "fold" } : { type: "call" };
  }
  if (profile === "aggressive") {
    if (strength > 0.56 && roll < 0.45) return raiseAction(view, 0.65) ?? { type: "call" };
    if (strength <= 0.56 && roll < 0.17) return raiseAction(view, 0.55) ?? { type: "call" };
    return strength < potOdds - 0.08 ? { type: "fold" } : { type: "call" };
  }

  if (strength > 0.78 && roll < 0.2) return raiseAction(view, 0.35) ?? { type: "call" };
  return strength + 0.065 >= potOdds ? { type: "call" } : { type: "fold" };
}

export function chooseAIActionForHand(
  view: PlayerView,
  profile: OpponentProfile,
  actionCount: number,
  handSeed: string,
): PokerAction {
  return chooseAIAction(view, profile, createRng(`${handSeed}:ai:${profile}:${actionCount}`));
}
