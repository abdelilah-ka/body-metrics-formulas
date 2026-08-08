import type { Band } from "./types.js";

/** Shared 4-step band palette used across every metric (mockup-derived, PRD §9). */
export const BAND_COLORS = {
  green: { color: "#6b9b6e", bg: "#eaf1ea" },
  teal: { color: "#0f6e63", bg: "#e6f2f0" },
  amber: { color: "#a5811f", bg: "#f7ecd4" },
  terracotta: { color: "#b56a3f", bg: "#f6e7dd" },
} as const;

export function bandFor(value: number, bands: Band[]): Band {
  for (const b of bands) {
    if (value < b.max) return b;
  }
  return bands[bands.length - 1];
}
