import { describe, expect, it } from "vitest";
import { calculateBmi } from "../src/bmi.js";
import { calculateBri } from "../src/bri.js";
import { calculateRfm } from "../src/rfm.js";
import { calculateWhtr } from "../src/whtr.js";
import { NHANES_AGE_GROUPS, NHANES_PERCENTILES, NHANES_PERCENTILE_POINTS } from "../src/nhanesPercentiles.js";
import { nhanesAgeGroup, nhanesValueAt, percentileAmongUsAdults } from "../src/percentile.js";
// @ts-expect-error — plain .mjs build script without type declarations
import { formulas, ibmDouble, weightedPercentiles } from "../scripts/nhanes-percentiles.mjs";

const METRICS = ["waist", "whtr", "bri", "rfm", "bmi"] as const;

describe("NHANES percentile table", () => {
  it("has a full, non-decreasing series for every sex, age group and metric", () => {
    for (const sex of ["female", "male"] as const) {
      for (const group of NHANES_AGE_GROUPS) {
        const cell = NHANES_PERCENTILES[sex][group.key];
        expect(cell.n, `${sex} ${group.key} sample size`).toBeGreaterThanOrEqual(300);
        for (const metric of METRICS) {
          const series = cell[metric];
          expect(series).toHaveLength(NHANES_PERCENTILE_POINTS.length);
          for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
        }
      }
    }
  });

  it("holds physiologically plausible medians", () => {
    // Loose bounds: these catch a unit or parsing error (inches for cm, a shifted column), not drift.
    for (const sex of ["female", "male"] as const) {
      for (const group of NHANES_AGE_GROUPS) {
        expect(nhanesValueAt("waist", sex, group.key, 50)).toBeGreaterThan(75);
        expect(nhanesValueAt("waist", sex, group.key, 50)).toBeLessThan(115);
        expect(nhanesValueAt("bmi", sex, group.key, 50)).toBeGreaterThan(22);
        expect(nhanesValueAt("bmi", sex, group.key, 50)).toBeLessThan(33);
        expect(nhanesValueAt("whtr", sex, group.key, 50)).toBeGreaterThan(0.45);
        expect(nhanesValueAt("whtr", sex, group.key, 50)).toBeLessThan(0.7);
      }
    }
  });
});

describe("percentileAmongUsAdults", () => {
  it("returns 50 for the stored median and the stored point for any stored value", () => {
    const median = nhanesValueAt("waist", "male", "40-49", 50);
    expect(percentileAmongUsAdults("waist", "male", 45, median).percentile).toBe(50);
    const p90 = nhanesValueAt("bri", "female", "60-69", 90);
    expect(percentileAmongUsAdults("bri", "female", 65, p90).percentile).toBe(90);
  });

  it("interpolates between stored points", () => {
    const p50 = nhanesValueAt("bmi", "female", "30-39", 50);
    const p55 = nhanesValueAt("bmi", "female", "30-39", 55);
    const mid = percentileAmongUsAdults("bmi", "female", 35, (p50 + p55) / 2).percentile;
    expect(mid).toBeGreaterThanOrEqual(52);
    expect(mid).toBeLessThanOrEqual(53);
  });

  it("is monotonic in the value", () => {
    let previous = 0;
    for (let waist = 55; waist <= 160; waist += 5) {
      const { percentile } = percentileAmongUsAdults("waist", "female", 52, waist);
      expect(percentile).toBeGreaterThanOrEqual(previous);
      previous = percentile;
    }
  });

  it("flags values outside the 1st–99th percentile instead of extrapolating", () => {
    expect(percentileAmongUsAdults("waist", "male", 30, 45)).toMatchObject({ percentile: 1, beyondRange: "below" });
    expect(percentileAmongUsAdults("waist", "male", 30, 199)).toMatchObject({ percentile: 99, beyondRange: "above" });
  });

  it("maps ages to the survey's groups, and rejects ages the site does not cover", () => {
    expect(nhanesAgeGroup(18)).toBe("18-29");
    expect(nhanesAgeGroup(29)).toBe("18-29");
    expect(nhanesAgeGroup(30)).toBe("30-39");
    expect(nhanesAgeGroup(70)).toBe("70+");
    expect(nhanesAgeGroup(95)).toBe("70+");
    expect(() => nhanesAgeGroup(17)).toThrow();
  });
});

describe("NHANES build script", () => {
  it("uses the same formulas as the engine", () => {
    for (const heightCm of [150, 165, 180, 195]) {
      for (const waistCm of [65, 85, 105, 130]) {
        expect(formulas.bri({ heightCm, waistCm })).toBeCloseTo(calculateBri({ heightCm, waistCm }).value, 2);
        expect(formulas.whtr({ heightCm, waistCm })).toBeCloseTo(calculateWhtr({ heightCm, waistCm }).value, 2);
        for (const sex of ["male", "female"] as const) {
          expect(formulas.rfm({ heightCm, waistCm, sex })).toBeCloseTo(calculateRfm({ heightCm, waistCm, sex }).value, 1);
        }
        expect(formulas.bmi({ heightCm, weightKg: 80 })).toBeCloseTo(calculateBmi(80, heightCm), 1);
      }
    }
  });

  it("decodes IBM floating-point numbers from SAS transport files", () => {
    // 1.0 = 0x41 10 00 … ; 100.0 = 0x42 64 00 … ; -2.5 = 0xC1 28 00 … ; "." = missing
    expect(ibmDouble(new Uint8Array([0x41, 0x10, 0, 0, 0, 0, 0, 0]), 0)).toBe(1);
    expect(ibmDouble(new Uint8Array([0x42, 0x64, 0, 0, 0, 0, 0, 0]), 0)).toBe(100);
    expect(ibmDouble(new Uint8Array([0xc1, 0x28, 0, 0, 0, 0, 0, 0]), 0)).toBe(-2.5);
    expect(ibmDouble(new Uint8Array([0x2e, 0, 0, 0, 0, 0, 0, 0]), 0)).toBeNull();
  });

  it("weights percentiles by survey weight", () => {
    const items = [
      { value: 1, weight: 1 },
      { value: 2, weight: 1 },
      { value: 3, weight: 8 }, // carries 80% of the population
    ];
    expect(weightedPercentiles(items, [10, 20, 50, 99])).toEqual([1, 2, 3, 3]);
  });
});
