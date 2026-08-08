import { describe, expect, it } from "vitest";
import { calculateAbsi } from "../src/absi.js";
import { absiReference } from "../src/absiReferenceTable.js";

describe("calculateAbsi", () => {
  it("computes the published raw formula", () => {
    // ABSI = WC / (BMI^(2/3) * H^(1/2)), WC & H in meters (Krakauer & Krakauer, 2012).
    const heightCm = 175;
    const waistCm = 90;
    const weightKg = 80;
    const heightM = 1.75;
    const waistM = 0.9;
    const bmi = weightKg / (heightM * heightM);
    const expected = waistM / (bmi ** (2 / 3) * heightM ** 0.5);

    const result = calculateAbsi({ heightCm, waistCm, weightKg, age: 40, sex: "male" });
    expect(result.value).toBeCloseTo(expected, 4);
  });

  it("matches the worked example shown on the ABSI page (h=1.75m, w=0.90m, weight=80kg, 40yo male)", () => {
    const result = calculateAbsi({ heightCm: 175, waistCm: 90, weightKg: 80, age: 40, sex: "male" });
    expect(result.value).toBeCloseTo(0.0773, 3);
  });

  it("age does not change the raw ABSI value, only its band", () => {
    // Table S1 (Krakauer & Krakauer 2012): male mean rises from ~0.0773 at 20 to ~0.0871 at
    // 80. The same body (h=175cm, w=97.8cm, wt=80kg -> raw ABSI ~0.0840) sits "above-typical"
    // for a 20-year-old but only "typical" for an 80-year-old — the exact bias a fixed,
    // age-blind scale would introduce.
    const young = calculateAbsi({ heightCm: 175, waistCm: 97.8, weightKg: 80, age: 20, sex: "male" });
    const old = calculateAbsi({ heightCm: 175, waistCm: 97.8, weightKg: 80, age: 80, sex: "male" });

    expect(young.value).toBe(old.value);
    expect(young.band.key).toBe("above-typical");
    expect(old.band.key).toBe("typical");
  });

  it("z-score matches (value - reference mean) / reference sd", () => {
    const result = calculateAbsi({ heightCm: 175, waistCm: 97.8, weightKg: 80, age: 20, sex: "male" });
    const ref = absiReference(20, "male");
    expect(result.zScore).toBeCloseTo((result.value - ref.mean) / ref.sd, 1);
  });

  it("clamps reference lookup for ages outside the paper's 18-85 table range", () => {
    // RANGES.ageYears allows up to 100 (consistent with the other calculators), but Table S1
    // has no data past 85 — ages 86-100 should reuse the age-85 row rather than throwing.
    const at85 = calculateAbsi({ heightCm: 175, waistCm: 90, weightKg: 80, age: 85, sex: "female" });
    const at99 = calculateAbsi({ heightCm: 175, waistCm: 90, weightKg: 80, age: 99, sex: "female" });
    expect(at99.zScore).toBe(at85.zScore);
  });

  it("uses sex-specific reference values — same body, different z-score by sex", () => {
    const male = calculateAbsi({ heightCm: 170, waistCm: 85, weightKg: 70, age: 45, sex: "male" });
    const female = calculateAbsi({ heightCm: 170, waistCm: 85, weightKg: 70, age: 45, sex: "female" });
    expect(male.value).toBe(female.value);
    expect(male.zScore).not.toBe(female.zScore);
  });

  it("is monotonically increasing in waist for fixed height/weight/age/sex", () => {
    const a = calculateAbsi({ heightCm: 170, waistCm: 70, weightKg: 70, age: 30, sex: "male" });
    const b = calculateAbsi({ heightCm: 170, waistCm: 100, weightKg: 70, age: 30, sex: "male" });
    expect(b.value).toBeGreaterThan(a.value);
  });

  it("rejects an out-of-range age rather than emitting garbage", () => {
    expect(() => calculateAbsi({ heightCm: 170, waistCm: 85, weightKg: 70, age: 17, sex: "male" })).toThrow();
    expect(() => calculateAbsi({ heightCm: 170, waistCm: 85, weightKg: 70, age: 150, sex: "male" })).toThrow();
  });
});
