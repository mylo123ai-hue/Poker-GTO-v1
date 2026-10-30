import { describe, expect, it } from "vitest";
import { getCoachAdvice } from "./coach";
import { createHand, playerView } from "../poker/engine";
import { estimateEquity } from "../poker/equity";

describe("coach and metrics boundaries", () => {
  it("labels recommendations approximate and never invents solver frequencies or EV", () => {
    const state = createHand({ seed: 44 });
    const advice = getCoachAdvice(playerView(state, "p0"));
    expect(advice.status).toBe("APPROXIMATE");
    expect(advice.strategyFrequencies).toBeNull();
    expect(advice.expectedValue).toBeNull();
    expect(advice.rationale.split(/[.!?]+/).filter(Boolean).length).toBeLessThanOrEqual(2);
    expect(advice.rationale.toLowerCase()).toContain("approximate");
  });

  it("estimates equity reproducibly against an explicitly uniform random hand", () => {
    const state = createHand({ seed: "equity" });
    const cards = state.players[0].holeCards;
    const first = estimateEquity(cards, [], 32, "stable");
    const second = estimateEquity(cards, [], 32, "stable");
    expect(first).toEqual(second);
    expect(first.samples).toBe(32);
    expect(first.opponentModel).toBe("uniform random legal hand");
    expect(first.equity).toBeGreaterThanOrEqual(0);
    expect(first.equity).toBeLessThanOrEqual(1);
  });
});
