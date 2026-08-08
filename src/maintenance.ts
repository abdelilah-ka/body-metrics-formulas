import type { Sex, Source } from "./types.js";
import { ACTIVITY_FACTORS, type ActivityLevel } from "./deficit.js";
import { RANGES, assertInRange } from "./validation.js";
import { round1 } from "./units.js";

export type PriorDietIntensity = "brief" | "moderate" | "extended";

/**
 * Rough adaptive-thermogenesis suppression assumptions by how long/aggressive the prior
 * diet was — actual metabolic adaptation varies widely by individual (Trexler et al. 2014
 * review; Fothergill et al. 2016 found much larger, more persistent suppression after an
 * extreme intervention). These are deliberately conservative planning estimates, not a
 * prediction of any one person's exact metabolic rate.
 */
const ADAPTATION_BY_INTENSITY: Record<PriorDietIntensity, number> = {
  brief: 0.03,
  moderate: 0.07,
  extended: 0.12,
};

export interface MaintenanceInputs {
  currentWeightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  priorDietIntensity: PriorDietIntensity;
}

export interface WeeklyStep {
  week: number;
  targetKcal: number;
}

export interface MaintenanceResult {
  bmr: number;
  predictedTdee: number;
  adaptationPct: number;
  lowEstimateKcal: number;
  highEstimateKcal: number;
  weeklySteps: WeeklyStep[];
  sources: Source[];
}

const WEEKLY_INCREMENT_KCAL = 75;

export const MAINTENANCE_SOURCES: Source[] = [
  { citation: "Mifflin MD, St Jeor ST et al. \"A new predictive equation for resting energy expenditure in healthy individuals.\" Am J Clin Nutr, 1990." },
  {
    citation:
      'Trexler ET, Smith-Ryan AE, Norton LE. "Metabolic adaptation to weight loss: implications for the athlete." J Int Soc Sports Nutr, 2014.',
  },
  {
    citation:
      'Fothergill E et al. "Persistent metabolic adaptation 6 years after "The Biggest Loser" competition." Obesity, 2016.',
  },
];

function mifflinBmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/**
 * Maintenance calories after a weight-loss phase ("reverse diet", PRD Tier-2). Rather than
 * jumping straight to the Mifflin-St Jeor-predicted TDEE (which can outrun a dieted-down
 * metabolism and cause faster-than-expected regain), this returns a conservative low
 * estimate plus a weekly step-up schedule toward the naive predicted maintenance.
 */
export function calculateMaintenanceAfterLoss(inputs: MaintenanceInputs): MaintenanceResult {
  const { currentWeightKg, heightCm, age, sex, activityLevel, priorDietIntensity } = inputs;
  assertInRange("weightKg", currentWeightKg, RANGES.weightKg);
  assertInRange("heightCm", heightCm, RANGES.heightCm);
  assertInRange("ageYears", age, RANGES.ageYears);

  const bmr = round1(mifflinBmr(currentWeightKg, heightCm, age, sex));
  const predictedTdee = round1(bmr * ACTIVITY_FACTORS[activityLevel]);
  const adaptationPct = ADAPTATION_BY_INTENSITY[priorDietIntensity];
  const lowEstimateKcal = round1(predictedTdee * (1 - adaptationPct));
  const highEstimateKcal = predictedTdee;

  const weeklySteps: WeeklyStep[] = [];
  let target = lowEstimateKcal;
  let week = 0;
  while (target < highEstimateKcal) {
    weeklySteps.push({ week, targetKcal: Math.round(target) });
    target = Math.min(highEstimateKcal, target + WEEKLY_INCREMENT_KCAL);
    week += 1;
  }
  weeklySteps.push({ week, targetKcal: Math.round(highEstimateKcal) });

  return {
    bmr,
    predictedTdee,
    adaptationPct,
    lowEstimateKcal,
    highEstimateKcal,
    weeklySteps,
    sources: MAINTENANCE_SOURCES,
  };
}
