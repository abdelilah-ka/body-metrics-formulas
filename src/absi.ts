import { bandFor, BAND_COLORS } from "./bands.js";
import { absiReference } from "./absiReferenceTable.js";
import type { Band, CalculatorResult, Sex, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";

export interface AbsiInputs {
  heightCm: number;
  waistCm: number;
  weightKg: number;
  age: number;
  sex: Sex;
}

export const ABSI_SOURCES: Source[] = [
  {
    citation:
      'Krakauer NY, Krakauer JC. "A New Body Shape Index Predicts Mortality Hazard Independently of Body Mass Index." PLoS ONE, 2012.',
  },
];

/**
 * Bands are z-score based — standard deviations from the age/sex-matched population mean —
 * rather than one fixed scale for every adult. This matters because ABSI drifts meaningfully
 * with age: the paper's own Table S1 shows the male mean rising from ~0.077 at 20 to ~0.088 at
 * 85, so a fixed scale would flag an average 85-year-old as "above typical" purely for being
 * 85. `max` values are in raw ABSI units for a specific age/sex mean+SD, computed fresh per
 * request in calculateAbsi() below (see absiReferenceTable.ts), not exported as a single
 * static table like the other metrics' bands.
 */
function bandsForReference(mean: number, sd: number): Band[] {
  return [
    { key: "lower", label: "Lower range", max: mean - sd, ...BAND_COLORS.green },
    { key: "typical", label: "Typical range", max: mean + sd, ...BAND_COLORS.teal },
    { key: "above-typical", label: "Above-typical range", max: mean + 2 * sd, ...BAND_COLORS.amber },
    { key: "higher", label: "Higher range", max: Infinity, ...BAND_COLORS.terracotta },
  ];
}

/** ABSI = WC / (BMI^(2/3) × H^(1/2)), WC & H in meters, BMI in kg/m² (Krakauer & Krakauer, 2012). */
export function calculateAbsi({ heightCm, waistCm, weightKg, age, sex }: AbsiInputs): CalculatorResult<AbsiInputs> {
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("waistCm", waistCm, RANGES.waistCm);
  assertInRange("weightKg", weightKg, RANGES.weightKg);
  assertInRange("age", age, RANGES.ageYears);

  const heightM = heightCm / 100;
  const waistM = waistCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const raw = waistM / (bmi ** (2 / 3) * heightM ** 0.5);
  const value = Math.round(raw * 100000) / 100000;

  const { mean, sd } = absiReference(age, sex);
  const bands = bandsForReference(mean, sd);
  const band = bandFor(value, bands);
  const zScore = Math.round(((value - mean) / sd) * 100) / 100;

  return {
    value,
    unit: "",
    band,
    bands,
    zScore,
    interpretationKey: `absi.${band.key}`,
    inputsEcho: { heightCm, waistCm, weightKg, age, sex },
    sources: ABSI_SOURCES,
  };
}
