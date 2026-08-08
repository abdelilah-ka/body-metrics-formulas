import type { Sex, Source } from "./types.js";
import { calculateBmi } from "./bmi.js";
import { RANGES, assertInRange } from "./validation.js";
import { round1 } from "./units.js";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "very" | "extra";

/** Appendix A activity factors. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export type DeficitPreset = 250 | 500 | 750;

export interface DeficitInputs {
  currentWeightKg: number;
  goalWeightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  deficitKcal: DeficitPreset;
  /** Extra metabolic-adaptation dampening beyond the recomputed-TDEE effect, 5–10% per Hall KD et al. (Appendix B). */
  adaptationDampeningPct?: number;
  /** Injected for deterministic tests; defaults to now. */
  startDate?: Date;
}

const KCAL_PER_KG = 7700;
const MAX_WEEKS = 104;

export const DEFICIT_SOURCES: Source[] = [
  { citation: "Mifflin MD, St Jeor ST et al. \"A new predictive equation for resting energy expenditure in healthy individuals.\" Am J Clin Nutr, 1990." },
  { citation: "Hall KD et al. — energy-balance and metabolic-adaptation modeling references (see PRD Appendix B)." },
];

export interface WeekPoint {
  week: number;
  adaptiveWeightKg: number;
  naiveWeightKg: number;
}

export type DeficitResult =
  | { status: "refused"; reason: "underweight"; message: string }
  | {
      status: "ok";
      bmr: number;
      tdee: number;
      intakeKcal: number;
      effectiveDeficitKcal: number;
      deficitCappedToSafeLimit: boolean;
      safetyFloorTriggered: boolean;
      floorKcal: number;
      weeks: WeekPoint[];
      goalReached: boolean;
      goalDate: string | null;
      weeksToGoal: number | null;
      sources: Source[];
    };

function mifflinBmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/**
 * Weekly weight-projection timeline (PRD §3.1 "Deficit timeline"). Refuses to compute for
 * BMI<18.5 inputs rather than emitting a weight-loss plan for someone already underweight.
 */
export function calculateDeficitTimeline(inputs: DeficitInputs): DeficitResult {
  const { currentWeightKg, goalWeightKg, heightCm, age, sex, activityLevel, deficitKcal } = inputs;
  assertInRange("weightKg", currentWeightKg, RANGES.weightKg);
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("ageYears", age, RANGES.ageYears);
  if (goalWeightKg >= currentWeightKg) {
    throw new RangeError("goalWeightKg must be less than currentWeightKg for a deficit timeline");
  }

  const bmi = calculateBmi(currentWeightKg, heightCm);
  if (bmi < 18.5) {
    return {
      status: "refused",
      reason: "underweight",
      message:
        "Your current weight is already in the underweight BMI range, so we won't generate a weight-loss projection. Please talk to a healthcare provider about a plan that's safe for you.",
    };
  }

  const dampening = inputs.adaptationDampeningPct ?? 0.075;
  const floorKcal = sex === "male" ? 1500 : 1200;
  const activityFactor = ACTIVITY_FACTORS[activityLevel];

  const bmr = mifflinBmr(currentWeightKg, heightCm, age, sex);
  const tdee = round1(bmr * activityFactor);

  // Cap any preset so it never implies more than ~1% bodyweight/week loss (PRD §5.3).
  const maxSafeDeficitPerDay = (0.01 * currentWeightKg * KCAL_PER_KG) / 7;
  const effectiveDeficitKcal = Math.min(deficitKcal, maxSafeDeficitPerDay);
  const deficitCappedToSafeLimit = effectiveDeficitKcal < deficitKcal;

  const intakeKcal = round1(tdee - effectiveDeficitKcal);
  const safetyFloorTriggered = intakeKcal < floorKcal;

  const naiveWeeklyLossKg = (effectiveDeficitKcal * 7) / KCAL_PER_KG;

  const weeks: WeekPoint[] = [{ week: 0, adaptiveWeightKg: round1(currentWeightKg), naiveWeightKg: round1(currentWeightKg) }];
  let adaptiveWeight = currentWeightKg;
  let naiveWeight = currentWeightKg;
  let goalReached = false;
  let weeksToGoal: number | null = null;

  for (let week = 1; week <= MAX_WEEKS; week++) {
    const weekBmr = mifflinBmr(adaptiveWeight, heightCm, age, sex);
    const weekTdee = weekBmr * activityFactor;
    const actualDeficit = Math.max(0, (weekTdee - intakeKcal) * (1 - dampening));
    const adaptiveWeeklyLossKg = (actualDeficit * 7) / KCAL_PER_KG;
    adaptiveWeight = Math.max(goalWeightKg, adaptiveWeight - adaptiveWeeklyLossKg);

    naiveWeight = Math.max(goalWeightKg, naiveWeight - naiveWeeklyLossKg);

    weeks.push({ week, adaptiveWeightKg: round1(adaptiveWeight), naiveWeightKg: round1(naiveWeight) });

    if (!goalReached && adaptiveWeight <= goalWeightKg + 0.05) {
      goalReached = true;
      weeksToGoal = week;
      break;
    }
  }

  const startDate = inputs.startDate ?? new Date();
  const goalDate =
    goalReached && weeksToGoal !== null
      ? new Date(startDate.getTime() + weeksToGoal * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;

  return {
    status: "ok",
    bmr: round1(bmr),
    tdee,
    intakeKcal,
    effectiveDeficitKcal: round1(effectiveDeficitKcal),
    deficitCappedToSafeLimit,
    safetyFloorTriggered,
    floorKcal,
    weeks,
    goalReached,
    goalDate,
    weeksToGoal,
    sources: DEFICIT_SOURCES,
  };
}
