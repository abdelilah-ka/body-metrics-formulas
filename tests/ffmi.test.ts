import { describe, expect, it } from "vitest";
import { calculateFfmi } from "../src/ffmi.js";

describe("calculateFfmi", () => {
  it("matches the Kouri et al. (1995) formula, normalized to 1.80m", () => {
    const heightCm = 180;
    const weightKg = 90;
    const bodyFatPercent = 12;
    const heightM = 1.8;
    const ffm = weightKg * (1 - bodyFatPercent / 100);
    const expected = ffm / (heightM * heightM) + 6.3 * (1.8 - heightM);

    const result = calculateFfmi({ heightCm, weightKg, bodyFatPercent });
    expect(result.value).toBeCloseTo(expected, 1);
  });

  it("applies the height normalization for a shorter person", () => {
    const heightCm = 165;
    const weightKg = 70;
    const bodyFatPercent = 15;
    const raw = (weightKg * (1 - bodyFatPercent / 100)) / (1.65 * 1.65);
    const result = calculateFfmi({ heightCm, weightKg, bodyFatPercent });
    // Normalized FFMI should be higher than raw FFMI for someone shorter than 1.80m.
    expect(result.value).toBeGreaterThan(raw);
  });

  it("rejects implausible body-fat inputs", () => {
    expect(() => calculateFfmi({ heightCm: 175, weightKg: 75, bodyFatPercent: 1 })).toThrow();
    expect(() => calculateFfmi({ heightCm: 175, weightKg: 75, bodyFatPercent: 80 })).toThrow();
  });
});
