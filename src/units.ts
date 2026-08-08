/** cm↔in, kg↔lb conversions, kept lossless to 1 decimal for round-trip tests (PRD §11.2). */

export function cmToIn(cm: number): number {
  return round1(cm / 2.54);
}

export function inToCm(inches: number): number {
  return round1(inches * 2.54);
}

export function kgToLb(kg: number): number {
  return round1(kg * 2.20462);
}

export function lbToKg(lb: number): number {
  return round1(lb / 2.20462);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
