import { describe, expect, it } from "vitest";
import {
  makeSplitBudPlans,
  SPLIT_TIMING,
  splitTravelProgress,
} from "../lib/split-formation";

describe("lineage split formation", () => {
  it("sends every root left and every branch right", () => {
    const ids = [11, 22, 33, 44, 55, 66];
    expect(makeSplitBudPlans(ids, "back").every((plan) => plan.x < 0)).toBe(true);
    expect(makeSplitBudPlans(ids, "forward").every((plan) => plan.x > 0)).toBe(
      true
    );
  });

  it("fans a family around both sides of the parent", () => {
    const plans = makeSplitBudPlans([1, 2, 3, 4, 5], "forward");
    expect(plans.some((plan) => plan.y < 0)).toBe(true);
    expect(plans.some((plan) => plan.y > 0)).toBe(true);
  });

  it("gives a large family more release room than a small one", () => {
    const small = makeSplitBudPlans([1, 2, 3], "forward");
    const large = makeSplitBudPlans([1, 2, 3, 4, 5, 6, 7, 8], "forward");
    const average = (plans: typeof small) =>
      plans.reduce((sum, plan) => sum + plan.distance, 0) / plans.length;
    expect(average(large)).toBeGreaterThan(average(small));
  });

  it("holds tension, overshoots, then lands exactly at rest", () => {
    expect(splitTravelProgress(0)).toBeCloseTo(0.015);
    expect(splitTravelProgress(SPLIT_TIMING.membranesRelease)).toBeCloseTo(0.58);
    expect(splitTravelProgress(SPLIT_TIMING.dropletsSettle)).toBeCloseTo(1.045);
    expect(splitTravelProgress(SPLIT_TIMING.physicsHandoff)).toBeCloseTo(1);
  });
});
