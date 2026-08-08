import { bandFor, BAND_COLORS } from "./bands.js";
import type { Band, CalculatorResult, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";

export interface WhtrInputs {
  heightCm: number;
  waistCm: number;
}

/** Bands per NICE 2022 guidance framing ("keep your waist to less than half your height"). */
export const WHTR_BANDS: Band[] = [
  { key: "possible-underweight", label: "Possible underweight", max: 0.4, ...BAND_COLORS.green },
  { key: "healthy", label: "Healthy", max: 0.5, ...BAND_COLORS.teal },
  { key: "increased-risk", label: "Increased risk", max: 0.6, ...BAND_COLORS.amber },
  { key: "high-risk", label: "High risk", max: Infinity, ...BAND_COLORS.terracotta },
];

export const WHTR_SOURCES: Source[] = [
  { citation: "NICE Guideline (CG189, updated 2022) — waist-to-height ratio guidance." },
];

/** WHtR = Waist ÷ Height (same units). */
export function calculateWhtr({ heightCm, waistCm }: WhtrInputs): CalculatorResult<WhtrInputs> {
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("waistCm", waistCm, RANGES.waistCm);

  const value = Math.round((waistCm / heightCm) * 100) / 100;
  const band = bandFor(value, WHTR_BANDS);

  return {
    value,
    unit: "",
    band,
    interpretationKey: `whtr.${band.key}`,
    inputsEcho: { heightCm, waistCm },
    sources: WHTR_SOURCES,
  };
}
