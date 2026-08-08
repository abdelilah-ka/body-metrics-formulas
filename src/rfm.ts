import { BAND_COLORS, bandFor } from "./bands.js";
import type { Band, CalculatorResult, Sex, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";

export interface RfmInputs {
  heightCm: number;
  waistCm: number;
  sex: Sex;
}

/**
 * Risk-framed bands. Obesity cutoff verified verbatim against Woolcott & Bergman, Int J Obes
 * 2020 (n=43,793, NHANES 1999–2014 + mortality linkage): two ROC methods against all-cause
 * mortality gave 40.8%/41.6% (women) and 30.9%/28.9% (men); the authors' own conclusion states
 * "We suggest rounded RFM cutoffs of 40% for women and 30% for men to diagnose obesity and
 * identify individuals at higher risk of death" — used here exactly as stated, not a generic
 * body-fat chart. The essential-fat floor is the standard exercise-physiology minimum (ACE);
 * the middle "typical" band is everything between.
 */
export const RFM_BANDS: Record<Sex, Band[]> = {
  female: [
    { key: "lean", label: "Very lean", max: 14, ...BAND_COLORS.green },
    { key: "typical", label: "Typical range", max: 35, ...BAND_COLORS.teal },
    { key: "elevated", label: "Elevated range", max: 40, ...BAND_COLORS.amber },
    { key: "obesity", label: "Obesity range", max: Infinity, ...BAND_COLORS.terracotta },
  ],
  male: [
    { key: "lean", label: "Very lean", max: 6, ...BAND_COLORS.green },
    { key: "typical", label: "Typical range", max: 25, ...BAND_COLORS.teal },
    { key: "elevated", label: "Elevated range", max: 30, ...BAND_COLORS.amber },
    { key: "obesity", label: "Obesity range", max: Infinity, ...BAND_COLORS.terracotta },
  ],
};

export const RFM_SOURCES: Source[] = [
  {
    citation:
      "Woolcott OO, Bergman RN. \"Relative fat mass (RFM) as a new estimator of whole-body fat percentage — a cross-sectional study in American adult individuals.\" Scientific Reports, 2018.",
  },
  {
    citation:
      "Woolcott OO, Bergman RN. \"Defining cutoffs to diagnose obesity using the relative fat mass (RFM): Association with mortality in NHANES 1999-2014.\" International Journal of Obesity, 2020.",
  },
];

/**
 * RFM: men 64 − 20×(H/WC); women 76 − 20×(H/WC) — equivalent to the paper's combined
 * form 64 − 20×(H/WC) + 12×sex (sex=0 male, 1 female). Verified verbatim against the
 * paper's stated equation (Woolcott & Bergman, Sci Rep 2018). Output = estimated body-fat %,
 * with validation-dataset accuracy of 91.5% (women) / 88.9% (men) vs DXA, per the same paper.
 */
export function calculateRfm({ heightCm, waistCm, sex }: RfmInputs): CalculatorResult<RfmInputs> {
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("waistCm", waistCm, RANGES.waistCm);

  const ratio = heightCm / waistCm;
  const raw = sex === "male" ? 64 - 20 * ratio : 76 - 20 * ratio;
  const value = Math.round(Math.min(60, Math.max(0, raw)) * 10) / 10;
  const band = bandFor(value, RFM_BANDS[sex]);

  return {
    value,
    unit: "%",
    band,
    interpretationKey: `rfm.${band.key}`,
    inputsEcho: { heightCm, waistCm, sex },
    sources: RFM_SOURCES,
  };
}
