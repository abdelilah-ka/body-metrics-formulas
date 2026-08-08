import { describe, expect, it } from "vitest";
import { calculateLbm } from "../src/lbm.js";

describe("calculateLbm", () => {
  it("matches the Boer (1984) formula for men", () => {
    const weightKg = 85;
    const heightCm = 180;
    const expected = 0.407 * weightKg + 0.267 * heightCm - 19.2;
    const result = calculateLbm({ heightCm, weightKg, sex: "male" });
    expect(result.leanBodyMassKg).toBeCloseTo(expected, 1);
  });

  it("matches the Boer (1984) formula for women", () => {
    const weightKg = 65;
    const heightCm = 165;
    const expected = 0.252 * weightKg + 0.473 * heightCm - 48.3;
    const result = calculateLbm({ heightCm, weightKg, sex: "female" });
    expect(result.leanBodyMassKg).toBeCloseTo(expected, 1);
  });

  it("fat mass and LBM sum back to total bodyweight", () => {
    const result = calculateLbm({ heightCm: 170, weightKg: 75, sex: "female" });
    expect(result.leanBodyMassKg + result.fatMassKg).toBeCloseTo(75, 1);
  });

  it("never returns a lean mass exceeding total bodyweight", () => {
    // A very short, light input can otherwise drive the linear formula negative or absurd.
    const result = calculateLbm({ heightCm: 100, weightKg: 30, sex: "male" });
    expect(result.leanBodyMassKg).toBeLessThanOrEqual(30);
    expect(result.leanBodyMassKg).toBeGreaterThanOrEqual(0);
  });
});
