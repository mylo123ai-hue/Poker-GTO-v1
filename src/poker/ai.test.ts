import { describe, expect, it } from "vitest";
import { chooseAIAction, OPPONENT_PROFILES } from "./ai";
import type { Card, PlayerView } from "./types";

const c = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });

describe("opponent profiles", () => {
  it("exposes four independently configurable styles", () => {
    expect(OPPONENT_PROFILES.map((profile) => profile.id)).toEqual(["tight", "caller", "aggressive", "balanced"]);
  });

  it("makes deterministic and distinct choices from only the acting player's view", () => {
    const view: PlayerView = {
      player: "p1",
      ownCards: [c(13, "spades"), c(13, "clubs")],
      board: [],
      street: "preflop",
      pot: 5,
      stack: 200,
      toCall: 1,
      callAmount: 1,
      canCheck: false,
      canRaise: true,
      minRaiseTo: 4,
      maxRaiseTo: 200,
      position: "button",
    };
    const choices = OPPONENT_PROFILES.map((profile) => chooseAIAction(view, profile.id, () => 0.25));
    expect(choices.map((choice) => `${choice.type}:${choice.type === "raise" ? choice.amountTo : ""}`)).toEqual(
      OPPONENT_PROFILES.map((profile) => {
        const choice = chooseAIAction(view, profile.id, () => 0.25);
        return `${choice.type}:${choice.type === "raise" ? choice.amountTo : ""}`;
      }),
    );
    expect(choices.filter((choice) => choice.type === "raise").length).toBeGreaterThanOrEqual(1);
    expect(choices.map((choice) => choice.type).filter((type, index, all) => all.indexOf(type) === index).length).toBeGreaterThan(1);
    expect(view).not.toHaveProperty("opponentCards");
  });
});
