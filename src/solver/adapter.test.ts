import { describe, expect, it } from "vitest";
import { lookupSolverSpot } from "./adapter";

const baseline = { players: 2, effectiveStackBb: 100, rakePercent: 0, street: "flop" as const, betSizingBb: [0.5, 1, 2] };

describe("solver coverage adapter", () => {
  it("returns UNAVAILABLE without fake rows for a spot in the documented abstraction", () => {
    const lookup = lookupSolverSpot(baseline);
    expect(lookup.status).toBe("UNAVAILABLE");
    expect(lookup.datasetId).toBeNull();
    expect(lookup.actionFrequencies).toBeNull();
    expect(lookup.expectedValue).toBeNull();
  });

  it("rejects spots outside supported player, stack, and rake assumptions", () => {
    expect(lookupSolverSpot({ ...baseline, players: 3 }).status).toBe("UNSUPPORTED");
    expect(lookupSolverSpot({ ...baseline, effectiveStackBb: 50 }).status).toBe("UNSUPPORTED");
    expect(lookupSolverSpot({ ...baseline, rakePercent: 5 }).status).toBe("UNSUPPORTED");
  });
});
