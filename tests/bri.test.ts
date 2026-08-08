import { describe, expect, it } from "vitest";
import { calculateBri } from "../src/bri.js";
import golden from "./golden/bri.json";

describe("calculateBri", () => {
  for (const c of golden.cases) {
    it(`matches worked example h=${c.heightCm} w=${c.waistCm}`, () => {
      const result = calculateBri({ heightCm: c.heightCm, waistCm: c.waistCm });
      expect(result.value).toBeGreaterThanOrEqual(c.expectedBri - c.tolerance);
      expect(result.value).toBeLessThanOrEqual(c.expectedBri + c.tolerance);
    });
  }

  it("is monotonically increasing in waist for fixed height", () => {
    const a = calculateBri({ heightCm: 170, waistCm: 70 });
    const b = calculateBri({ heightCm: 170, waistCm: 90 });
    const c = calculateBri({ heightCm: 170, waistCm: 110 });
    expect(b.value).toBeGreaterThan(a.value);
    expect(c.value).toBeGreaterThan(b.value);
  });

  it("is monotonically decreasing in height for fixed waist", () => {
    const a = calculateBri({ heightCm: 150, waistCm: 90 });
    const b = calculateBri({ heightCm: 180, waistCm: 90 });
    const c = calculateBri({ heightCm: 210, waistCm: 90 });
    expect(b.value).toBeLessThan(a.value);
    expect(c.value).toBeLessThan(b.value);
  });

  it("assigns bands consistent with the published cutoffs", () => {
    // h=170,w=85 -> BRI ~3.36, just under the 3.4 "average" cutoff.
    expect(calculateBri({ heightCm: 170, waistCm: 85 }).band.key).toBe("lower");
    // h=170,w=95 -> BRI ~4.57, comfortably inside "average".
    expect(calculateBri({ heightCm: 170, waistCm: 95 }).band.key).toBe("average");
  });

  it("rejects out-of-range inputs rather than emitting garbage", () => {
    expect(() => calculateBri({ heightCm: 170, waistCm: 500 })).toThrow();
    expect(() => calculateBri({ heightCm: 5, waistCm: 85 })).toThrow();
  });
});
