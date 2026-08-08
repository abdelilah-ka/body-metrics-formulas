import { describe, expect, it } from "vitest";
import { cmToIn, inToCm, kgToLb, lbToKg } from "../src/units.js";

describe("unit conversions", () => {
  it("round-trips cm/in losslessly to ~1 decimal", () => {
    for (const cm of [100, 150.5, 172, 200.5, 88.5]) {
      expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 0);
    }
  });

  it("round-trips kg/lb losslessly to ~1 decimal", () => {
    for (const kg of [40, 65.5, 90, 120.5]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 0);
    }
  });
});
