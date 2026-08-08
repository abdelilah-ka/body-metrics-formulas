import { bandFor, BAND_COLORS } from "./bands.js";
import type { Band, CalculatorResult, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";

export interface BriInputs {
  heightCm: number;
  waistCm: number;
}

/**
 * Exact quintile boundaries from Zhang X et al., JAMA Netw Open 2024;7(6):e2415051 (verified
 * against the paper directly): Q1 1.05–<3.41, Q2 3.41–<4.45, Q3 4.45–<5.46 (reference), Q4
 * 5.46–<6.91, Q5 ≥6.91. Q2+Q3 are collapsed into one "average" band here (neither was flagged
 * vs the reference group); Q1 and Q4/Q5 boundaries are kept exact since they carry the paper's
 * U-shaped mortality signal — fully adjusted HR 1.25 (95% CI 1.05–1.47) for Q1 vs Q3, and 1.49
 * (95% CI 1.31–1.70) for Q5 vs Q3.
 */
export const BRI_BANDS: Band[] = [
  { key: "lower", label: "Lower range", max: 3.41, ...BAND_COLORS.green },
  { key: "average", label: "Average range", max: 5.46, ...BAND_COLORS.teal },
  { key: "above-average", label: "Above-average range", max: 6.91, ...BAND_COLORS.amber },
  { key: "higher", label: "Higher range", max: Infinity, ...BAND_COLORS.terracotta },
];

export const BRI_SOURCES: Source[] = [
  {
    citation:
      'Thomas DM et al. "Relationships between body roundness with body fat and visceral adipose tissue." Obesity, 2013.',
  },
  {
    citation: 'Zhang X et al. "Body Roundness Index and All-Cause Mortality." JAMA Network Open, 2024.',
  },
];

/**
 * BRI = 364.2 − 365.5 × √(1 − (WC/2π)² / (0.5×H)²), WC & H in meters (Thomas et al., Obesity
 * 2013 — waist-based ellipse eccentricity model, confirmed against the paper: BRI uses only
 * height + waist, not the separate hip-based ellipse the same paper also explores for %VAT).
 * WC and H must be in the SAME unit (both meters here) — the JAMA Netw Open 2024 mortality
 * paper issued a July 2024 correction after a mixed-unit error, explicitly flagging this.
 */
export function calculateBri({ heightCm, waistCm }: BriInputs): CalculatorResult<BriInputs> {
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("waistCm", waistCm, RANGES.waistCm);

  const heightM = heightCm / 100;
  const waistM = waistCm / 100;
  const inner = Math.max(0, 1 - (waistM / (2 * Math.PI)) ** 2 / (0.5 * heightM) ** 2);
  const value = Math.round((364.2 - 365.5 * Math.sqrt(inner)) * 100) / 100;
  const band = bandFor(value, BRI_BANDS);

  return {
    value,
    unit: "",
    band,
    interpretationKey: `bri.${band.key}`,
    inputsEcho: { heightCm, waistCm },
    sources: BRI_SOURCES,
  };
}
