import { bandFor, BAND_COLORS } from "./bands.js";
import type { Band, CalculatorResult, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";

export interface FfmiInputs {
  heightCm: number;
  weightKg: number;
  bodyFatPercent: number;
}

/**
 * Descriptive bands. The FFMI-25 "natural limit" reference point comes from Kouri et al.
 * (1995), a male-only sample of 157 athletes — it is not a validated female reference, so
 * bands here are purely descriptive ranges, not a natural/enhanced classification, for either sex.
 */
export const FFMI_BANDS: Band[] = [
  { key: "below-average", label: "Below average", max: 18, ...BAND_COLORS.green },
  { key: "average", label: "Average", max: 20, ...BAND_COLORS.teal },
  { key: "above-average", label: "Above average", max: 22, ...BAND_COLORS.teal },
  { key: "muscular", label: "Very muscular", max: 25, ...BAND_COLORS.amber },
  { key: "exceptional", label: "Exceptional", max: Infinity, ...BAND_COLORS.terracotta },
];

export const FFMI_SOURCES: Source[] = [
  {
    citation:
      'Kouri EM et al. "Fat-free mass index in users and nonusers of anabolic-androgenic steroids." Clinical Journal of Sport Medicine, 1995.',
  },
];

export interface FfmiResult extends CalculatorResult<FfmiInputs> {
  rawFfmi: number;
}

/**
 * FFMI = fat-free mass / height², normalized to a 1.80m frame via +6.3×(1.80 − H) so
 * results are comparable across heights (Kouri et al., 1995).
 */
export function calculateFfmi({ heightCm, weightKg, bodyFatPercent }: FfmiInputs): FfmiResult {
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("weightKg", weightKg, RANGES.weightKg);
  if (bodyFatPercent < 3 || bodyFatPercent > 60) {
    throw new RangeError("bodyFatPercent must be between 3 and 60");
  }

  const heightM = heightCm / 100;
  const fatFreeMassKg = weightKg * (1 - bodyFatPercent / 100);
  const rawFfmi = fatFreeMassKg / (heightM * heightM);
  const normalizedFfmi = rawFfmi + 6.3 * (1.8 - heightM);
  const value = Math.round(normalizedFfmi * 10) / 10;
  const band = bandFor(value, FFMI_BANDS);

  return {
    value,
    unit: "",
    band,
    interpretationKey: `ffmi.${band.key}`,
    inputsEcho: { heightCm, weightKg, bodyFatPercent },
    sources: FFMI_SOURCES,
    rawFfmi: Math.round(rawFfmi * 10) / 10,
  };
}
