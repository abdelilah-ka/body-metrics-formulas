import type { Sex, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";
import { round1 } from "./units.js";

export interface LbmInputs {
  heightCm: number;
  weightKg: number;
  sex: Sex;
}

export interface LbmResult {
  leanBodyMassKg: number;
  fatMassKg: number;
  bodyFatPercentEstimate: number;
  sources: Source[];
}

export const LBM_SOURCES: Source[] = [
  {
    citation:
      'Boer P. "Estimated lean body mass as an index for normalization of body fluid volumes in humans." American Journal of Physiology, 1984.',
  },
];

/**
 * Boer (1984) formula — cadaver-derived, ~90% accuracy vs DXA in typical body sizes,
 * known to underestimate lean mass at BMI>30.
 * Men: LBM = 0.407W + 0.267H − 19.2. Women: LBM = 0.252W + 0.473H − 48.3 (W kg, H cm).
 */
export function calculateLbm({ heightCm, weightKg, sex }: LbmInputs): LbmResult {
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("weightKg", weightKg, RANGES.weightKg);

  const raw =
    sex === "male" ? 0.407 * weightKg + 0.267 * heightCm - 19.2 : 0.252 * weightKg + 0.473 * heightCm - 48.3;
  const leanBodyMassKg = Math.min(weightKg, Math.max(0, round1(raw)));
  const fatMassKg = round1(weightKg - leanBodyMassKg);
  const bodyFatPercentEstimate = round1((fatMassKg / weightKg) * 100);

  return { leanBodyMassKg, fatMassKg, bodyFatPercentEstimate, sources: LBM_SOURCES };
}
