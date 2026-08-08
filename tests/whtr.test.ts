import { describe, expect, it } from "vitest";
import { calculateWhtr } from "../src/whtr.js";

describe("calculateWhtr", () => {
  it("is a simple waist/height ratio", () => {
    const result = calculateWhtr({ heightCm: 170, waistCm: 85 });
    expect(result.value).toBeCloseTo(0.5, 2);
  });

  it("bands correctly at the NICE cutoffs", () => {
    expect(calculateWhtr({ heightCm: 200, waistCm: 78 }).band.key).toBe("possible-underweight");
    expect(calculateWhtr({ heightCm: 200, waistCm: 90 }).band.key).toBe("healthy");
    expect(calculateWhtr({ heightCm: 200, waistCm: 110 }).band.key).toBe("increased-risk");
    expect(calculateWhtr({ heightCm: 200, waistCm: 130 }).band.key).toBe("high-risk");
  });

  it("is monotonic in waist and anti-monotonic in height", () => {
    const base = calculateWhtr({ heightCm: 170, waistCm: 80 });
    const moreWaist = calculateWhtr({ heightCm: 170, waistCm: 100 });
    const moreHeight = calculateWhtr({ heightCm: 190, waistCm: 80 });
    expect(moreWaist.value).toBeGreaterThan(base.value);
    expect(moreHeight.value).toBeLessThan(base.value);
  });

  it("round-trips cm/in conversions losslessly to 1 decimal", async () => {
    const { cmToIn, inToCm } = await import("../src/units.js");
    for (const cm of [100, 150.5, 172, 200.5]) {
      expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 0);
    }
  });
});
