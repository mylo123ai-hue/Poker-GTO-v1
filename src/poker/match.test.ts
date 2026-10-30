import { describe, expect, it } from "vitest";
import { createMatch, applyMatchAction, startNextHand, type MatchSettings } from "./match";
import { runMatchSimulation } from "./matchSimulation";

const settings: MatchSettings = { startingStackChips: 40, smallBlindChips: 1, bigBlindChips: 2 };

describe("continuous heads-up matches", () => {
  it("keeps chips, carries stacks forward, and alternates the button and action order", () => {
    let match = createMatch({ seed: "continuous", settings });
    expect(match.hand.button).toBe("p0");
    expect(match.hand.currentActor).toBe("p0");
    expect(match.hand.players.map((player) => player.streetCommitted)).toEqual([1, 2]);
    match = applyMatchAction(match, { type: "fold" });
    expect(match.status).toBe("hand-complete");
    expect(match.hand.players[0].stack + match.hand.players[1].stack).toBe(80);
    const afterFirstHand = match.hand.players.map((player) => player.stack);

    match = startNextHand(match);
    expect(match.button).toBe("p1");
    expect(match.hand.currentActor).toBe("p1");
    expect(match.hand.players.map((player) => player.stack + player.streetCommitted)).toEqual(afterFirstHand);
    expect(match.hand.players.map((player) => player.streetCommitted)).toEqual([2, 1]);
    expect(match.hand.currentActor).toBe(match.button);
  });

  it("rejects invalid settings and prevents dealing after elimination", () => {
    expect(() => createMatch({ settings: { ...settings, smallBlindChips: 3 } })).toThrow(/blinds/i);
    let match = createMatch({ settings: { startingStackChips: 2, smallBlindChips: 1, bigBlindChips: 2 }, seed: "elimination" });
    match = applyMatchAction(match, { type: "call" });
    expect(match.status).toBe("match-complete");
    expect(() => startNextHand(match)).toThrow(/match is over/i);
  });

  it("reproduces deterministic full match simulations and conserves chips", () => {
    const options = {
      matches: 4,
      seed: "match-simulation",
      settings,
      p0Profile: "balanced" as const,
      p1Profile: "caller" as const,
    };
    const first = runMatchSimulation(options);
    const second = runMatchSimulation(options);
    expect(first).toEqual(second);
    expect(first.matchesCompleted).toBe(4);
    expect(first.outcomes.p0Wins + first.outcomes.p1Wins).toBe(4);
    expect(first.handsCompleted).toBeGreaterThan(4);
    expect(first.chipsConserved).toBe(true);
    expect(first.failures).toEqual([]);
  });
});
