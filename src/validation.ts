import { ValidationError, type Range } from "./types.js";

/** Physiologically plausible input ranges, cm/kg/years (PRD §3.1). Block impossible combos rather than emit garbage. */
export const RANGES = {
  heightCm: { min: 100, max: 230 } satisfies Range,
  waistCm: { min: 40, max: 200 } satisfies Range,
  weightKg: { min: 30, max: 300 } satisfies Range,
  ageYears: { min: 18, max: 100 } satisfies Range,
} as const;

export function assertInRange(field: string, value: number, range: Range): void {
  if (!Number.isFinite(value)) {
    throw new ValidationError(field, `${field} must be a finite number`);
  }
  if (value < range.min || value > range.max) {
    throw new ValidationError(
      field,
      `${field} must be between ${range.min} and ${range.max}`,
    );
  }
}

export function clamp(value: number, range: Range): number {
  return Math.min(range.max, Math.max(range.min, value));
}
