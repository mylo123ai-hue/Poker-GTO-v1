import { describe, expect, it } from "vitest";
import { calculateSidePots, applyAction, availableActions, createHand, playerView, potSize } from "./engine";
import { compareHands, evaluateBest } from "./evaluate";
import type { Card } from "./types";

function c(rank: number, suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("hand evaluation", () => {
  it("ranks all major categories and handles the ace-low straight", () => {
    expect(evaluateBest([c(14, "spades"), c(13, "spades"), c(12, "spades"), c(11, "spades"), c(10, "spades")]).category).toBe("straight flush");
    expect(evaluateBest([c(14, "spades"), c(2, "clubs"), c(3, "diamonds"), c(4, "hearts"), c(5, "spades")]).rank).toEqual([4, 5]);
    expect(evaluateBest([c(9, "spades"), c(9, "hearts"), c(9, "clubs"), c(2, "clubs"), c(2, "hearts")]).category).toBe("full house");
    expect(evaluateBest([c(6, "spades"), c(6, "hearts"), c(6, "clubs"), c(6, "diamonds"), c(14, "hearts")]).category).toBe("four of a kind");
  });

  it("compares kickers and split-pot hands correctly", () => {
    const board = [c(14, "clubs"), c(14, "diamonds"), c(10, "hearts"), c(8, "spades"), c(2, "clubs")];
    expect(compareHands([c(13, "clubs"), c(7, "clubs"), ...board], [c(12, "clubs"), c(7, "diamonds"), ...board])).toBe(1);
    expect(compareHands([c(13, "clubs"), c(12, "clubs"), ...board], [c(13, "diamonds"), c(12, "diamonds"), ...board])).toBe(0);
  });
});

describe("heads-up hand engine", () => {
  it("deals reproducibly, posts heads-up blinds, and rotates action by position", () => {
    const first = createHand({ seed: "same-seed" });
    const second = createHand({ seed: "same-seed" });
    expect(first.players.map((player) => player.holeCards)).toEqual(second.players.map((player) => player.holeCards));
    expect(first.currentActor).toBe("p0");
    expect(first.players[0].streetCommitted).toBe(1);
    expect(first.players[1].streetCommitted).toBe(2);
    expect(potSize(first)).toBe(3);
    const called = applyAction(first, { type: "call" });
    expect(called.currentActor).toBe("p1");
    const flop = applyAction(called, { type: "check" });
    expect(flop.street).toBe("flop");
    expect(flop.board).toHaveLength(3);
    expect(flop.currentActor).toBe("p1");
  });

  it("uses configurable blinds and handles stacks shorter than a blind", () => {
    const custom = createHand({ seed: "custom-blinds", stack: 100, smallBlind: 2, bigBlind: 5 });
    expect(custom.players.map((player) => player.streetCommitted)).toEqual([2, 5]);
    expect(custom.currentBet).toBe(5);
    expect(custom.lastFullRaise).toBe(5);
    expect(availableActions(custom, "p0").minRaiseTo).toBe(10);

    const shortButton = createHand({
      seed: "button-short-blind",
      button: "p0",
      startingStacks: { p0: 1, p1: 20 },
    });
    expect(shortButton.street).toBe("complete");
    expect(shortButton.currentActor).toBeNull();
    expect(shortButton.players[0].stack + shortButton.players[1].stack).toBe(21);
    expect(shortButton.result?.reason).toBe("showdown");
  });

  it("enforces minimum full raises and accepts a short all-in size", () => {
    const state = createHand({ seed: 8, stack: 20 });
    expect(availableActions(state, "p0").minRaiseTo).toBe(4);
    expect(() => applyAction(state, { type: "raise", amountTo: 3 })).toThrow(/at least 4/);
    const raised = applyAction(state, { type: "raise", amountTo: 4 });
    expect(raised.currentBet).toBe(4);
    expect(availableActions(raised, "p1").minRaiseTo).toBe(6);

    const short = createHand({ seed: 9, stack: 3 });
    expect(availableActions(short, "p0").maxRaiseTo).toBe(3);
    const shortRaised = applyAction(short, { type: "raise", amountTo: 3 });
    expect(shortRaised.currentBet).toBe(3);
    expect(shortRaised.currentActor).toBe("p1");
    expect(availableActions(shortRaised, "p1").canRaise).toBe(false);
  });

  it("resolves a fold and a short all-in blind hand without losing chips", () => {
    const folded = applyAction(createHand({ seed: 12 }), { type: "raise", amountTo: 4 });
    const foldResult = applyAction(folded, { type: "fold" });
    expect(foldResult.result?.reason).toBe("fold");
    expect(foldResult.players[0].stack + foldResult.players[1].stack).toBe(400);

    const blindAllIn = createHand({ seed: 13, stack: 2 });
    expect(blindAllIn.currentActor).toBe("p0");
    const allIn = applyAction(blindAllIn, { type: "call" });
    expect(allIn.street).toBe("complete");
    expect(allIn.board).toHaveLength(5);
    expect(allIn.result?.reason).toBe("showdown");
    expect(allIn.players[0].stack + allIn.players[1].stack).toBe(4);
    expect(allIn.result!.payouts.p0 + allIn.result!.payouts.p1).toBe(allIn.result!.pot);
  });

  it("returns unmatched excess when an all-in opponent cannot cover it", () => {
    const resolution = calculateSidePots({ p0: 16, p1: 5 });
    expect(resolution.refunds).toEqual({ p0: 11, p1: 0 });
    expect(resolution.pots).toEqual([{ amount: 10, eligible: ["p0", "p1"] }]);
  });

  it("splits a tied showdown and preserves all chips", () => {
    const state = createHand({ seed: "board-tie" });
    const board = [c(10, "spades"), c(11, "spades"), c(12, "spades"), c(13, "spades"), c(14, "spades")];
    state.board = board;
    state.street = "river";
    state.currentActor = "p0";
    state.currentBet = 0;
    state.actedThisStreet = [];
    state.players[0].holeCards = [c(2, "clubs"), c(3, "clubs")];
    state.players[1].holeCards = [c(4, "clubs"), c(5, "clubs")];
    for (const player of state.players) {
      player.stack = 196;
      player.totalCommitted = 4;
      player.streetCommitted = 0;
    }
    let resultState = applyAction(state, { type: "check" });
    resultState = applyAction(resultState, { type: "check" });
    expect(resultState.result?.winner).toBe("tie");
    expect(resultState.result?.payouts).toEqual({ p0: 4, p1: 4 });
    expect(resultState.players[0].stack + resultState.players[1].stack).toBe(400);
  });

  it("refunds excess chips after a short all-in call before the showdown", () => {
    const state = createHand({ seed: "short-call", stack: 20 });
    state.players[0].stack += 15;
    state.players[1].stack -= 15;
    const bet = applyAction(state, { type: "raise", amountTo: 20 });
    const called = applyAction(bet, { type: "call" });
    expect(called.street).toBe("complete");
    expect(called.result?.refunds).toEqual({ p0: 15, p1: 0 });
    expect(called.result?.pot).toBe(10);
    expect(called.players[0].stack + called.players[1].stack).toBe(40);
  });

  it("keeps opponent hole cards out of player-facing state", () => {
    const state = createHand({ seed: "privacy" });
    const view = playerView(state, "p0");
    expect(view.ownCards).toEqual(state.players[0].holeCards);
    expect(view).not.toHaveProperty("opponentCards");
    expect(view).not.toHaveProperty("players");
    expect(view.ownCards).not.toEqual(state.players[1].holeCards);
  });

  it("fails closed on illegal actions and impossible starting stacks", () => {
    const state = createHand({ seed: "bad-action" });
    expect(() => applyAction(state, { type: "check" })).toThrow(/not legal/);
    expect(() => createHand({ seed: "too-short", stack: 1 })).toThrow(/at least 2 chips/);
  });
});
