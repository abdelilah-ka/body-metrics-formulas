import { describe, expect, it } from "vitest";
import { calculateProtein } from "../src/protein.js";

describe("calculateProtein", () => {
  it("uses the sedentary RDA of 0.8 g/kg", () => {
    const result = calculateProtein({
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      goal: "sedentary",
      inDeficit: false,
    });
    expect(result.minGramsPerDay).toBeCloseTo(56, 0);
    expect(result.maxGramsPerDay).toBeCloseTo(56, 0);
  });

  it("stays within the general-active 1.2-1.6 g/kg range", () => {
    const result = calculateProtein({
      weightKg: 70,
      heightCm: 175,
      sex: "female",
      goal: "general-active",
      inDeficit: false,
    });
    expect(result.perKg.min).toBeCloseTo(1.2, 2);
    expect(result.perKg.max).toBeCloseTo(1.6, 2);
  });

  it("biases toward the upper range when in a stated deficit", () => {
    const notDeficit = calculateProtein({
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      goal: "muscle-gain",
      inDeficit: false,
    });
    const deficit = calculateProtein({
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      goal: "muscle-gain",
      inDeficit: true,
    });
    expect(deficit.perKg.min).toBeGreaterThan(notDeficit.perKg.min);
    expect(deficit.minGramsPerDay).toBeGreaterThan(notDeficit.minGramsPerDay);
  });

  it("caps displayed values at 2.5 g/kg", () => {
    const result = calculateProtein({
      weightKg: 60,
      heightCm: 170,
      sex: "male",
      goal: "muscle-gain",
      inDeficit: true,
    });
    expect(result.perKg.max).toBeLessThanOrEqual(2.5);
  });

  it("uses adjusted bodyweight above BMI 30", () => {
    // 120kg at 170cm is BMI ~41.5.
    const result = calculateProtein({
      weightKg: 120,
      heightCm: 170,
      sex: "male",
      goal: "general-active",
      inDeficit: false,
    });
    expect(result.usedAdjustedBodyWeight).toBe(true);
    expect(result.effectiveWeightKg).toBeLessThan(120);
  });

  it("produces a per-meal split and food-equivalents table", () => {
    const result = calculateProtein({
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      goal: "general-active",
      inDeficit: false,
    });
    expect(result.perMeal.meals).toBe(4);
    expect(result.perMeal.minPerMeal * 4).toBeCloseTo(result.minGramsPerDay, 0);
    expect(result.foodEquivalents.length).toBeGreaterThan(0);
    for (const item of result.foodEquivalents) {
      expect(item.quantity).toBeGreaterThan(0);
    }
  });
});
