import { approximateHandStrength } from "../poker/ai";
import type { PlayerView } from "../poker/types";

export type CoachAdvice = {
  action: "fold" | "check" | "call" | "raise";
  amountTo?: number;
  label: string;
  rationale: string;
  status: "APPROXIMATE";
  potOdds: number | null;
  strengthScore: number;
  strategyFrequencies: null;
  expectedValue: null;
};

export function getCoachAdvice(view: PlayerView): CoachAdvice {
  const strengthScore = approximateHandStrength(view);
  const potOdds = view.toCall > 0 ? view.toCall / (view.pot + view.toCall) : null;
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
    : `The call needs about ${(potOdds * 100).toFixed(0)}% equity before future betting.`;
  const rationale = `${currentHand[0]!.toUpperCase()}${currentHand.slice(1)} visible-card strength favors this heuristic choice; ${price.toLowerCase()} This is an approximate coach rule, not solver output.`;

  return {
    action,
    ...(amountTo === undefined ? {} : { amountTo }),
    label: labels[action],
    rationale,
    status: "APPROXIMATE",
    potOdds,
    strengthScore,
    strategyFrequencies: null,
    expectedValue: null,
  };
}
