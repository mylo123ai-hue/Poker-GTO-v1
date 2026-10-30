import { describe, expect, it } from "vitest";
import { explainBetSize, getCoachAdvice } from "./coach";
import { applyAction, createHand, playerView } from "../poker/engine";
import { estimateEquity, equitySamplingRange95 } from "../poker/equity";

describe("coach and metrics boundaries", () => {
  it("labels recommendations approximate and does not attach strategy frequencies or EV", () => {
    const state = createHand({ seed: 44 });
    const advice = getCoachAdvice(playerView(state, "p0"));
    expect(advice.status).toBe("APPROXIMATE");
    expect(advice).not.toHaveProperty("strategyFrequencies");
    expect(advice).not.toHaveProperty("expectedValue");
    expect(advice.rationale.split(/[.!?]+/).filter(Boolean).length).toBeLessThanOrEqual(2);
    expect(advice.rationale.toLowerCase()).toContain("approximate");
    expect(advice.potOdds).toBeCloseTo(0.25);
    expect(advice.preflopHint).toContain("button");
    expect(advice.madeHandCategory).toBeNull();
    expect(explainBetSize(playerView(state, "p0"), 4)).toContain("1-chip call");
  });

  it("reports a made category after the flop and has nonzero uncertainty at sample extremes", () => {
    const preflop = createHand({ seed: "made-category" });
    const called = applyAction(preflop, { type: "call" });
    const flop = applyAction(called, { type: "check" });
    expect(getCoachAdvice(playerView(flop, "p1")).madeHandCategory).not.toBeNull();

    const low = equitySamplingRange95({ equity: 0, wins: 0, ties: 0, samples: 96, opponentModel: "uniform random legal hand" });
    const high = equitySamplingRange95({ equity: 1, wins: 96, ties: 0, samples: 96, opponentModel: "uniform random legal hand" });
    expect(low.low).toBe(0);
    expect(low.high).toBeGreaterThan(0);
    expect(high.high).toBe(1);
    expect(high.low).toBeLessThan(1);
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
