import {
  NHANES_AGE_GROUPS,
  NHANES_PERCENTILES,
  NHANES_PERCENTILE_POINTS,
  type NhanesAgeGroupKey,
  type NhanesMetric,
} from "./nhanesPercentiles.js";
import type { Sex, Source } from "./types.js";
import { RANGES, assertInRange } from "./validation.js";

export const PERCENTILE_SOURCES: Source[] = [
  {
    citation:
      "National Center for Health Statistics. National Health and Nutrition Examination Survey, August 2021–August 2023: demographics (DEMO_L) and body measures (BMX_L) data files. Centers for Disease Control and Prevention.",
    url: "https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?Cycle=2021-2023",
  },
];

export interface PercentileResult {
  /** Whole-number percentile, 1–99: the share of the reference group with a lower value. */
  percentile: number;
  /** True when the value is below the 1st or above the 99th percentile of the reference group. */
  beyondRange: "below" | "above" | null;
  ageGroup: NhanesAgeGroupKey;
  /** People in the reference group (same sex and age group) in the survey sample. */
  sampleSize: number;
}

export function nhanesAgeGroup(ageYears: number): NhanesAgeGroupKey {
  assertInRange("ageYears", ageYears, RANGES.ageYears);
  for (const group of NHANES_AGE_GROUPS) {
    if (ageYears >= group.min && (group.max === null || ageYears <= group.max)) return group.key;
  }
  return NHANES_AGE_GROUPS[NHANES_AGE_GROUPS.length - 1].key;
}

/**
 * Where a value sits among US adults of the same sex and age group (NHANES August 2021–August
 * 2023, see nhanesPercentiles.ts). The stored table has 23 percentile points; values between two
 * points are placed by straight-line interpolation. This is a description of a population, not a
 * health rating: a typical value is not necessarily a healthy one.
 */
export function percentileAmongUsAdults(metric: NhanesMetric, sex: Sex, ageYears: number, value: number): PercentileResult {
  if (!Number.isFinite(value)) throw new RangeError("value must be a finite number");
  const ageGroup = nhanesAgeGroup(ageYears);
  const cell = NHANES_PERCENTILES[sex][ageGroup];
  const values = cell[metric];
  const points = NHANES_PERCENTILE_POINTS;
  const base = { ageGroup, sampleSize: cell.n };

  if (value < values[0]) return { ...base, percentile: 1, beyondRange: "below" };
  if (value > values[values.length - 1]) return { ...base, percentile: 99, beyondRange: "above" };

  for (let i = 1; i < values.length; i++) {
    if (value <= values[i]) {
      const span = values[i] - values[i - 1];
      const share = span === 0 ? 1 : (value - values[i - 1]) / span;
      const percentile = points[i - 1] + share * (points[i] - points[i - 1]);
      return { ...base, percentile: Math.min(99, Math.max(1, Math.round(percentile))), beyondRange: null };
    }
  }
  return { ...base, percentile: 99, beyondRange: null };
}

/** The value at one of the stored percentile points, e.g. the median (50) waist for men aged 40–49. */
export function nhanesValueAt(metric: NhanesMetric, sex: Sex, ageGroup: NhanesAgeGroupKey, point: (typeof NHANES_PERCENTILE_POINTS)[number]): number {
  return NHANES_PERCENTILES[sex][ageGroup][metric][NHANES_PERCENTILE_POINTS.indexOf(point)];
}
