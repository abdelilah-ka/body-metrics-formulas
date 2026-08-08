import type { Sex, Source } from "./types.js";
import { adjustedBodyWeightKg, calculateBmi } from "./bmi.js";
import { RANGES, assertInRange } from "./validation.js";
import { round, round1 } from "./units.js";

export type ProteinGoal = "sedentary" | "general-active" | "muscle-gain";

export interface ProteinInputs {
  weightKg: number;
  heightCm: number;
  sex: Sex;
  goal: ProteinGoal;
  inDeficit: boolean;
}

/** g/kg ranges per goal (ISSN Position Stand 2017; Morton et al., Br J Sports Med 2018 meta-analysis). */
const GOAL_RANGES: Record<ProteinGoal, { min: number; max: number }> = {
  sedentary: { min: 0.8, max: 0.8 },
  "general-active": { min: 1.2, max: 1.6 },
  "muscle-gain": { min: 1.6, max: 2.2 },
};

const CAP_G_PER_KG = 2.5;

export interface FoodEquivalent {
  food: string;
  /** grams of protein per unit, unit is either "100g" or "each" per foodUnit */
  proteinPerUnit: number;
  unit: string;
  quantity: number;
}

const FOOD_TEMPLATE: Array<Omit<FoodEquivalent, "quantity"> & { baseQty: number }> = [
  { food: "Chicken breast", proteinPerUnit: 31, unit: "g", baseQty: 150 },
  { food: "Eggs", proteinPerUnit: 6, unit: "egg", baseQty: 2 },
  { food: "Greek yogurt", proteinPerUnit: 10, unit: "g", baseQty: 200 },
  { food: "Protein shake (1 scoop)", proteinPerUnit: 24, unit: "scoop", baseQty: 1 },
];

export interface ProteinResult {
  minGramsPerDay: number;
  maxGramsPerDay: number;
  perKg: { min: number; max: number };
  effectiveWeightKg: number;
  usedAdjustedBodyWeight: boolean;
  cappedByCeiling: boolean;
  perMeal: { meals: number; minPerMeal: number; maxPerMeal: number };
  foodEquivalents: FoodEquivalent[];
  sources: Source[];
}

export const PROTEIN_SOURCES: Source[] = [
  { citation: "ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr, 2017." },
  {
    citation:
      "Morton RW et al. \"A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength.\" Br J Sports Med, 2018.",
  },
];

/** Protein range (g/day) per PRD §3.1: presets by goal, biased upper in a deficit, adjusted bodyweight above BMI 30, capped at 2.5 g/kg. */
export function calculateProtein({
  weightKg,
  heightCm,
  sex,
  goal,
  inDeficit,
}: ProteinInputs): ProteinResult {
  assertInRange("weightKg", weightKg, RANGES.weightKg);
  assertInRange("heightCm", heightCm, RANGES.heightCm);

  const bmi = calculateBmi(weightKg, heightCm);
  const usedAdjustedBodyWeight = bmi > 30;
  const effectiveWeightKg = usedAdjustedBodyWeight
    ? adjustedBodyWeightKg(weightKg, heightCm, sex)
    : weightKg;

  let { min, max } = GOAL_RANGES[goal];
  if (inDeficit && goal !== "sedentary") {
    // Bias to the upper half of the range while dieting (PRD §3.1).
    min = min + (max - min) * 0.5;
  }

  const cappedByCeiling = max > CAP_G_PER_KG;
  max = Math.min(max, CAP_G_PER_KG);
  min = Math.min(min, max);

  const minGramsPerDay = round1(min * effectiveWeightKg);
  const maxGramsPerDay = round1(max * effectiveWeightKg);

  const meals = 4;
  const perMeal = {
    meals,
    minPerMeal: round1(minGramsPerDay / meals),
    maxPerMeal: round1(maxGramsPerDay / meals),
  };

  const target = (minGramsPerDay + maxGramsPerDay) / 2;
  const baseTotal = FOOD_TEMPLATE.reduce(
    (sum, item) => sum + (item.proteinPerUnit * item.baseQty) / (item.unit === "g" ? 100 : 1),
    0,
  );
  const scale = baseTotal > 0 ? target / baseTotal : 0;
  const foodEquivalents: FoodEquivalent[] = FOOD_TEMPLATE.map((item) => ({
    food: item.food,
    proteinPerUnit: item.proteinPerUnit,
    unit: item.unit,
    quantity: round1(item.baseQty * scale),
  }));

  return {
    minGramsPerDay,
    maxGramsPerDay,
    perKg: { min: round(min, 2), max: round(max, 2) },
    effectiveWeightKg: round1(effectiveWeightKg),
    usedAdjustedBodyWeight,
    cappedByCeiling,
    perMeal,
    foodEquivalents,
    sources: PROTEIN_SOURCES,
  };
}
