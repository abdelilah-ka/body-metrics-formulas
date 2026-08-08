import { describe, expect, it } from "vitest";
import { calculateMaintenanceAfterLoss } from "../src/maintenance.js";

describe("calculateMaintenanceAfterLoss", () => {
  it("low estimate is below the naive predicted TDEE for any adaptation beyond 'brief'", () => {
    const result = calculateMaintenanceAfterLoss({
      currentWeightKg: 70,
      heightCm: 170,
      age: 30,
      sex: "female",
      activityLevel: "moderate",
      priorDietIntensity: "extended",
    });
    expect(result.lowEstimateKcal).toBeLessThan(result.highEstimateKcal);
    expect(result.highEstimateKcal).toBe(result.predictedTdee);
  });

  it("a longer/more aggressive prior diet implies a lower starting point", () => {
    const base = {
      currentWeightKg: 80,
      heightCm: 178,
      age: 35,
      sex: "male" as const,
      activityLevel: "sedentary" as const,
    };
    const brief = calculateMaintenanceAfterLoss({ ...base, priorDietIntensity: "brief" });
    const extended = calculateMaintenanceAfterLoss({ ...base, priorDietIntensity: "extended" });
    expect(extended.lowEstimateKcal).toBeLessThan(brief.lowEstimateKcal);
  });

  it("weekly step-up schedule starts at the low estimate and ends at the high estimate", () => {
    const result = calculateMaintenanceAfterLoss({
      currentWeightKg: 90,
      heightCm: 180,
      age: 40,
      sex: "male",
      activityLevel: "light",
      priorDietIntensity: "moderate",
    });
    expect(result.weeklySteps[0].targetKcal).toBe(Math.round(result.lowEstimateKcal));
    expect(result.weeklySteps[result.weeklySteps.length - 1].targetKcal).toBe(Math.round(result.highEstimateKcal));
    // Monotonically non-decreasing.
    for (let i = 1; i < result.weeklySteps.length; i++) {
      expect(result.weeklySteps[i].targetKcal).toBeGreaterThanOrEqual(result.weeklySteps[i - 1].targetKcal);
    }
  });
});
