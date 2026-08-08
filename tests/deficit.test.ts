import { describe, expect, it } from "vitest";
import { calculateDeficitTimeline } from "../src/deficit.js";
import golden from "./golden/mifflin.json";

function mifflin(weightKg: number, heightCm: number, age: number, sex: "male" | "female") {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

describe("Mifflin-St Jeor BMR", () => {
  for (const c of golden.cases) {
    it(`matches reference case (${c.sex}, ${c.weightKg}kg, ${c.heightCm}cm, age ${c.age})`, () => {
      expect(mifflin(c.weightKg, c.heightCm, c.age, c.sex as "male" | "female")).toBeCloseTo(c.expectedBmr, 2);
    });
  }
});

describe("calculateDeficitTimeline", () => {
  const startDate = new Date("2026-01-01T00:00:00Z");

  it("projects a goal date for a normal deficit", () => {
    const result = calculateDeficitTimeline({
      currentWeightKg: 90,
      goalWeightKg: 80,
      heightCm: 175,
      age: 35,
      sex: "male",
      activityLevel: "moderate",
      deficitKcal: 500,
      startDate,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.weeks.length).toBeGreaterThan(1);
      expect(result.weeks[0].adaptiveWeightKg).toBeCloseTo(90, 0);
      const last = result.weeks[result.weeks.length - 1];
      expect(last.adaptiveWeightKg).toBeLessThanOrEqual(90);
      // Adaptive (honest) curve should never outrun the naive linear line.
      for (const w of result.weeks) {
        expect(w.adaptiveWeightKg).toBeGreaterThanOrEqual(w.naiveWeightKg - 0.2);
      }
    }
  });

  it("refuses to project for BMI < 18.5 inputs (PRD §5.3)", () => {
    const result = calculateDeficitTimeline({
      currentWeightKg: 50,
      goalWeightKg: 45,
      heightCm: 175,
      age: 25,
      sex: "female",
      activityLevel: "sedentary",
      deficitKcal: 500,
      startDate,
    });
    expect(result.status).toBe("refused");
  });

  it("flags the safety floor when the target calories drop too low", () => {
    const result = calculateDeficitTimeline({
      currentWeightKg: 55,
      goalWeightKg: 50,
      heightCm: 160,
      age: 40,
      sex: "female",
      activityLevel: "sedentary",
      deficitKcal: 750,
      startDate,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.safetyFloorTriggered).toBe(true);
    }
  });

  it("never lets the effective daily deficit exceed ~1% bodyweight/week", () => {
    const result = calculateDeficitTimeline({
      currentWeightKg: 60,
      goalWeightKg: 55,
      heightCm: 165,
      age: 30,
      sex: "female",
      activityLevel: "sedentary",
      deficitKcal: 750,
      startDate,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const maxSafe = (0.01 * 60 * 7700) / 7;
      expect(result.effectiveDeficitKcal).toBeLessThanOrEqual(maxSafe + 0.5);
    }
  });

  it("rejects a goal weight that is not less than the current weight", () => {
    expect(() =>
      calculateDeficitTimeline({
        currentWeightKg: 70,
        goalWeightKg: 75,
        heightCm: 170,
        age: 30,
        sex: "male",
        activityLevel: "moderate",
        deficitKcal: 500,
        startDate,
      }),
    ).toThrow();
  });
});
