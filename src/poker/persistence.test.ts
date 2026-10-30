import { describe, expect, it } from "vitest";
import { applyMatchAction, createMatch, startNextHand, toCompletedHandRecord } from "./match";
import { availableActions } from "./engine";
import { applyTrainerAction, createDefaultTrainerData, loadTrainerData, saveTrainerData, TRAINER_STORAGE_KEY } from "./persistence";
import { calculatePlayerStats, findLeakIndicators } from "./stats";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("trainer persistence and sample-correct metrics", () => {
  it("restores an interrupted hand and recovers safely from corrupted storage", () => {
    const storage = new MemoryStorage();
    let trainer = createDefaultTrainerData();
    trainer = applyTrainerAction(trainer, { type: "call" });
    expect(saveTrainerData(storage, trainer)).toBe(true);
    const saved = JSON.parse(storage.data.get(TRAINER_STORAGE_KEY) ?? "{}") as { match?: { hand?: Record<string, unknown> } };
    expect(saved.match?.hand).toEqual({ startingStacks: { p0: 200, p1: 200 }, actions: expect.any(Array) });
    expect(saved.match?.hand).not.toHaveProperty("deck");
    expect(saved.match?.hand).not.toHaveProperty("players");
    const restored = loadTrainerData(storage);
    expect(restored.recovered).toBe(false);
    expect(restored.data.match.hand.currentActor).toBe("p1");
    expect(restored.data.match.hand.actionCount).toBe(1);

    storage.data.set(TRAINER_STORAGE_KEY, "{bad json");
    const recovered = loadTrainerData(storage);
    expect(recovered.recovered).toBe(true);
    expect(recovered.data.match.hand.street).toBe("preflop");
  });

  it("uses action-based denominators for VPIP, PFR, 3-bet, c-bet, and folds to c-bets", () => {
    let trainer = createDefaultTrainerData();
    trainer = applyTrainerAction(trainer, { type: "raise", amountTo: 4 });
    trainer = applyTrainerAction(trainer, { type: "call" });
    trainer = applyTrainerAction(trainer, { type: "check" });
    trainer = applyTrainerAction(trainer, { type: "raise", amountTo: 2 });
    trainer = applyTrainerAction(trainer, { type: "fold" });

    const hero = calculatePlayerStats(trainer.history, "p0");
    const opponent = calculatePlayerStats(trainer.history, "p1");
    expect(trainer.history).toHaveLength(1);
    expect(hero.vpip).toEqual({ value: 1, numerator: 1, denominator: 1 });
    expect(hero.pfr).toEqual({ value: 1, numerator: 1, denominator: 1 });
    expect(hero.continuationBet).toEqual({ value: 1, numerator: 1, denominator: 1 });
    expect(opponent.threeBet).toEqual({ value: 0, numerator: 0, denominator: 1 });
    expect(opponent.foldsToContinuationBet).toEqual({ value: 1, numerator: 1, denominator: 1 });
    expect(hero.wentToShowdown).toEqual({ value: 0, numerator: 0, denominator: 1 });
  });

  it("uses showdown, hand, and position denominators for W$SD, BB/100, and aggression", () => {
    const finishByChecking = (initial: ReturnType<typeof createMatch>) => {
      let match = initial;
      while (match.status === "active") {
        const actor = match.hand.currentActor!;
        const legal = availableActions(match.hand, actor);
        match = applyMatchAction(match, legal.toCall > 0 ? { type: "call" } : { type: "check" });
      }
      return match;
    };
    const firstMatch = finishByChecking(createMatch({ seed: "stats-button" }));
    const firstRecord = toCompletedHandRecord(firstMatch);
    const secondMatch = finishByChecking(startNextHand(firstMatch));
    const secondRecord = toCompletedHandRecord(secondMatch);
    const records = [firstRecord, secondRecord];
    const stats = calculatePlayerStats(records, "p0");
    const expectedShowdownShare = records.reduce((sum, record) => {
      const pots = record.result.pots;
      const potTotal = pots.reduce((total, pot) => total + pot.amount, 0);
      const won = pots.reduce((total, pot) => total + (pot.winners.includes("p0") ? pot.amount / pot.winners.length : 0), 0);
      return sum + (potTotal === 0 ? 0 : won / potTotal);
    }, 0) / records.length;
    const expectedBbPer100 = records.reduce((sum, record) => sum
      + (record.endingStacks.p0 - record.startingStacks.p0) / record.bigBlind, 0) * 100 / records.length;

    expect(stats.aggression).toEqual({ value: 0, aggressiveActions: 0, calls: 1 });
    expect(stats.wentToShowdown).toEqual({ value: 1, numerator: 2, denominator: 2 });
    expect(stats.wonAtShowdown).toEqual({ value: expectedShowdownShare, numerator: expectedShowdownShare * 2, denominator: 2 });
    expect(stats.bbPer100).toBe(expectedBbPer100);
    expect(stats.positions.button.hands).toBe(1);
    expect(stats.positions.bigBlind.hands).toBe(1);
    expect(stats.positions.button.vpip).toEqual({ value: 1, numerator: 1, denominator: 1 });
    expect(stats.positions.bigBlind.vpip).toEqual({ value: 0, numerator: 0, denominator: 1 });
  });

  it("keeps zero-sample metrics explicit instead of inventing percentages", () => {
    const stats = calculatePlayerStats([]);
    expect(stats.hands).toBe(0);
    expect(stats.vpip).toEqual({ value: null, numerator: 0, denominator: 0 });
    expect(stats.threeBet.value).toBeNull();
    expect(stats.bbPer100).toBeNull();
  });

  it("waits for the declared sample before showing common leak prompts", () => {
    const records = Array.from({ length: 20 }, (_, index) => {
      const empty = createDefaultTrainerData();
      let data = { ...empty, match: createMatch({ seed: `passive-${index}`, id: `passive-match-${index}`, settings: empty.match.settings }) };
      data = applyTrainerAction(data, { type: "call" });
      data = applyTrainerAction(data, { type: "check" });
      for (let street = 0; street < 3; street += 1) {
        data = applyTrainerAction(data, { type: "check" });
        data = applyTrainerAction(data, { type: "check" });
      }
      return data.history[0]!;
    });
    const stats = calculatePlayerStats(records);
    expect(stats.vpip.value).toBe(1);
    expect(stats.pfr.value).toBe(0);
    expect(findLeakIndicators(calculatePlayerStats(records.slice(0, 19))).map((item) => item.id)).toEqual(["sample"]);
    expect(findLeakIndicators(stats).map((item) => item.id)).toContain("passive-preflop");
  });
});
