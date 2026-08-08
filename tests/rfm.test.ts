import { describe, expect, it } from "vitest";
import { calculateRfm } from "../src/rfm.js";

describe("calculateRfm", () => {
  it("computes the published formula for men and women", () => {
    // RFM = 64 - 20*(H/WC) for men, 76 - 20*(H/WC) for women (Woolcott & Bergman, Sci Rep 2018).
    const male = calculateRfm({ heightCm: 180, waistCm: 90, sex: "male" });
    expect(male.value).toBeCloseTo(64 - 20 * (180 / 90), 1);

    const female = calculateRfm({ heightCm: 165, waistCm: 80, sex: "female" });
    expect(female.value).toBeCloseTo(76 - 20 * (165 / 80), 1);
  });

  it("stays within 0-60% for valid inputs (property test, PRD §11.2)", () => {
    for (let waist = 40; waist <= 200; waist += 10) {
      for (let height = 100; height <= 230; height += 10) {
        const male = calculateRfm({ heightCm: height, waistCm: waist, sex: "male" });
        const female = calculateRfm({ heightCm: height, waistCm: waist, sex: "female" });
        expect(male.value).toBeGreaterThanOrEqual(0);
        expect(male.value).toBeLessThanOrEqual(60);
        expect(female.value).toBeGreaterThanOrEqual(0);
        expect(female.value).toBeLessThanOrEqual(60);
      }
    }
  });

  it("uses sex-specific band tables — the same RFM% lands in different bands by sex", () => {
    const validKeys = ["lean", "typical", "elevated", "obesity"];
    // waistCm chosen so both compute to RFM = 27.0% exactly, landing in different bands per sex.
    const male = calculateRfm({ heightCm: 180, waistCm: 97.3, sex: "male" });
    const female = calculateRfm({ heightCm: 180, waistCm: 73.47, sex: "female" });
    expect(validKeys).toContain(male.band.key);
    expect(validKeys).toContain(female.band.key);
    expect(male.value).toBeCloseTo(27, 0);
    expect(female.value).toBeCloseTo(27, 0);
    expect(male.band.key).toBe("elevated");
    expect(female.band.key).toBe("typical");
  });

  it("obesity cutoff matches the paper's rounded recommendation (40% women, 30% men)", () => {
    // Woolcott & Bergman, Int J Obes 2020: rounded cutoffs of 40% (women) / 30% (men).
    const justBelowFemale = calculateRfm({ heightCm: 180, waistCm: 20 * 180 / (76 - 39.9), sex: "female" });
    const atFemale = calculateRfm({ heightCm: 180, waistCm: 20 * 180 / (76 - 40), sex: "female" });
    expect(justBelowFemale.band.key).toBe("elevated");
    expect(atFemale.band.key).toBe("obesity");

    const justBelowMale = calculateRfm({ heightCm: 180, waistCm: 20 * 180 / (64 - 29.9), sex: "male" });
    const atMale = calculateRfm({ heightCm: 180, waistCm: 20 * 180 / (64 - 30), sex: "male" });
    expect(justBelowMale.band.key).toBe("elevated");
    expect(atMale.band.key).toBe("obesity");
  });
});
