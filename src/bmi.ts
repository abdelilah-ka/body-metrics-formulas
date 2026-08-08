/** Plain BMI, used only as the comparison baseline on the /vs-bmi/ page and as a safety-rail input elsewhere — not a standalone calculator page. */
export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** Devine-formula ideal body weight, used to derive "adjusted bodyweight" for protein dosing above BMI 30 (PRD §3.1). */
export function idealBodyWeightKg(heightCm: number, sex: "male" | "female"): number {
  const heightIn = heightCm / 2.54;
  const inchesOver5ft = Math.max(0, heightIn - 60);
  const base = sex === "male" ? 50 : 45.5;
  return base + 2.3 * inchesOver5ft;
}

/** Adjusted bodyweight = IBW + 0.4 × (actual − IBW), the standard clinical correction for obesity dosing. */
export function adjustedBodyWeightKg(weightKg: number, heightCm: number, sex: "male" | "female"): number {
  const ibw = idealBodyWeightKg(heightCm, sex);
  if (weightKg <= ibw) return weightKg;
  return ibw + 0.4 * (weightKg - ibw);
}
