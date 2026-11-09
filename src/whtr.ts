import { bandFor, BAND_COLORS } from "./bands.js";
import type { Band, CalculatorResult, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";

export interface WhtrInputs {
  heightCm: number;
  waistCm: number;
}

/**
 * Bands per NICE NG246 rec 1.9.14 (0.4-0.49 healthy, 0.5-0.59 increased, 0.6+ high central adiposity),
 * https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity
 * (read 2026-11-09). The "possible underweight" band below 0.4 is this site's own framing, not NICE's.
 */
export const WHTR_BANDS: Band[] = [
  { key: "possible-underweight", label: "Possible underweight", max: 0.4, ...BAND_COLORS.green },
  { key: "healthy", label: "Healthy", max: 0.5, ...BAND_COLORS.teal },
  { key: "increased-risk", label: "Increased risk", max: 0.6, ...BAND_COLORS.amber },
  { key: "high-risk", label: "High risk", max: Infinity, ...BAND_COLORS.terracotta },
];

export const WHTR_SOURCES: Source[] = [
  { citation: "NICE guideline NG246, Overweight and obesity management (2025, updated 2026), recommendation 1.9.14.", url: "https://www.nice.org.uk/guidance/ng246" },
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
