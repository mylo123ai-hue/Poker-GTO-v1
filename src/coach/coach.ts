import { approximateHandStrength } from "../poker/ai";
import { evaluateBest, type HandCategory } from "../poker/evaluate";
import type { PlayerView } from "../poker/types";

export type CoachAdvice = {
  action: "fold" | "check" | "call" | "raise";
  amountTo?: number;
  label: string;
  rationale: string;
  status: "APPROXIMATE";
  potOdds: number | null;
  strengthScore: number;
  madeHandCategory: HandCategory | null;
  positionHint: string;
  preflopHint: string | null;
  betSizingHint: string;
};

function startingHandHint(view: PlayerView): string {
  const [first, second] = view.ownCards;
  if (!first || !second) return "Starting cards are unavailable.";
  const high = Math.max(first.rank, second.rank);
  const low = Math.min(first.rank, second.rank);
  const suited = first.suit === second.suit;
  const pair = first.rank === second.rank;
  const broadway = low >= 10;
  const gap = high - low - 1;
  const shape = pair ? "a pocket pair"
    : suited && high === 14 ? "a suited ace"
      : broadway ? "two broadway cards"
        : suited && gap <= 1 ? "a suited connector or one-gap hand"
          : high === 14 ? "an ace with a lower kicker"
            : "a less connected starting hand";
  const position = view.position === "button"
    ? "On the button you act first before the flop and last on later streets."
    : "In the big blind you act last before the flop and first on later streets.";
  const thought = pair || (high === 14 && low >= 10) || broadway
    ? "This shape is commonly playable, but stack depth and the action still matter."
    : "This shape is more sensitive to price and position; avoid treating a chart as a guarantee.";
  return `You have ${shape}. ${position} ${thought}`;
}

function madeHandCategory(view: PlayerView): HandCategory | null {
  const cards = [...view.ownCards, ...view.board];
  return cards.length >= 5 ? evaluateBest(cards).category : null;
}

export function explainBetSize(view: PlayerView, amountTo: number): string {
  const added = Math.max(0, amountTo - view.streetCommitted);
  if (view.toCall === 0) {
    const ratio = view.pot > 0 ? added / view.pot : null;
    return ratio === null
      ? `A bet-to size adds ${added} chips to this street.`
      : `A bet-to size adds ${added} chips, about ${(ratio * 100).toFixed(0)}% of the current ${view.pot}-chip pot.`;
  }
  const raiseBy = Math.max(0, amountTo - view.currentBet);
  return `This raise-to adds ${added} chips total, including the ${view.callAmount}-chip call; it raises ${raiseBy} chips beyond the current bet.`;
}

export function getCoachAdvice(view: PlayerView): CoachAdvice {
  const strengthScore = approximateHandStrength(view);
  const potOdds = view.callAmount > 0 ? view.callAmount / (view.pot + view.callAmount) : null;
  let action: CoachAdvice["action"];
  let amountTo: number | undefined;

  if (view.toCall === 0) {
    if (view.canRaise && strengthScore >= 0.79) {
      action = "raise";
      amountTo = view.minRaiseTo;
    } else {
      action = "check";
    }
  } else if (view.canRaise && strengthScore >= 0.78 && strengthScore > (potOdds ?? 1) + 0.18) {
    action = "raise";
    amountTo = view.minRaiseTo;
  } else if (strengthScore >= (potOdds ?? 1) + 0.07) {
    action = "call";
  } else {
    action = "fold";
  }

  const labels: Record<CoachAdvice["action"], string> = {
    fold: "Fold",
    check: "Check",
    call: `Call ${view.callAmount} chip${view.callAmount === 1 ? "" : "s"}`,
    raise: `Raise to ${amountTo ?? view.minRaiseTo} chips`,
  };
  const currentHand = strengthScore >= 0.78 ? "strong" : strengthScore >= 0.48 ? "middling" : "weak";
  const price = potOdds === null
    ? "There is no call price to meet."
    : `The call needs about ${(potOdds * 100).toFixed(0)}% of the final called pot before future betting.`;
  const rationale = `${currentHand[0]!.toUpperCase()}${currentHand.slice(1)} visible-card heuristic strength informs this choice; ${price.toLowerCase()} This is approximate guidance, not a calibrated equity model.`;
  const sizingTarget = amountTo ?? view.minRaiseTo;
  const positionHint = view.position === "button"
    ? "Button: small blind preflop, first to act preflop, last to act postflop."
    : "Big blind: second to act preflop, first to act postflop.";
  const preflopHint = view.street === "preflop" ? startingHandHint(view) : null;

  return {
    action,
    ...(amountTo === undefined ? {} : { amountTo }),
    label: labels[action],
    rationale,
    status: "APPROXIMATE",
    potOdds,
    strengthScore,
    madeHandCategory: madeHandCategory(view),
    positionHint,
    preflopHint,
    betSizingHint: view.canRaise ? explainBetSize(view, sizingTarget) : "No legal raise is available in this spot.",
  };
}
