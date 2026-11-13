#!/usr/bin/env node
/**
 * Builds packages/engine/src/nhanesPercentiles.ts: weighted percentiles of waist, waist-to-height
 * ratio, BRI, RFM and BMI for US adults by sex and age group, from the public NHANES
 * August 2021–August 2023 files (CDC / NCHS).
 *
 *   node packages/engine/scripts/nhanes-percentiles.mjs [--data <dir>]
 *
 * The two source files are downloaded into <dir> (default: a temp folder) if they are not there:
 *   https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/DEMO_L.xpt  (age, sex, exam weight)
 *   https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/BMX_L.xpt   (height, weight, waist)
 *
 * Method: adults 18+, excluding participants recorded as pregnant (RIDEXPRG = 1). Each person is
 * weighted by the examination weight WTMEC2YR, as NCHS requires for measured body data. A
 * percentile is the smallest value at which the cumulative weight reaches that share of the
 * group's total weight. No dependencies: the SAS transport (XPT) reader is below.
 *
 * The run prints the weighted obesity prevalence (BMI ≥ 30, adults 20+) so it can be compared with
 * the figure NCHS published for the same survey cycle (Data Brief 508: 40.3%).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/nhanesPercentiles.ts");
const BASE_URL = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles";

export const PERCENTILE_POINTS = [1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 97, 99];
export const AGE_GROUPS = [
  { key: "18-29", min: 18, max: 29 },
  { key: "30-39", min: 30, max: 39 },
  { key: "40-49", min: 40, max: 49 },
  { key: "50-59", min: 50, max: 59 },
  { key: "60-69", min: 60, max: 69 },
  { key: "70+", min: 70, max: 200 },
];

// The same formulas as the engine (bri.ts, rfm.ts, whtr.ts, bmi.ts), unrounded and unclamped so
// the distribution is not distorted. tests/nhanesPercentiles.test.ts checks they agree.
export const formulas = {
  whtr: ({ heightCm, waistCm }) => waistCm / heightCm,
  bri: ({ heightCm, waistCm }) => {
    const inner = Math.max(0, 1 - (waistCm / 100 / (2 * Math.PI)) ** 2 / (0.5 * (heightCm / 100)) ** 2);
    return 364.2 - 365.5 * Math.sqrt(inner);
  },
  rfm: ({ heightCm, waistCm, sex }) => (sex === "male" ? 64 : 76) - 20 * (heightCm / waistCm),
  bmi: ({ heightCm, weightKg }) => weightKg / (heightCm / 100) ** 2,
};

/** IBM System/360 double (the number format of SAS transport files) → JS number, or null if missing. */
export function ibmDouble(buf, offset) {
  const first = buf[offset];
  let restZero = true;
  for (let i = 1; i < 8; i++) if (buf[offset + i] !== 0) restZero = false;
  if (restZero && (first === 0x2e || first === 0x5f || (first >= 0x41 && first <= 0x5a))) return null;
  if (restZero && first === 0) return 0;
  const sign = first & 0x80 ? -1 : 1;
  const exponent = (first & 0x7f) - 64;
  let fraction = 0;
  for (let i = 1; i < 8; i++) fraction = fraction * 256 + buf[offset + i];
  return sign * (fraction / 2 ** 56) * 16 ** exponent;
}

/** Reads the first dataset of a SAS transport (XPORT v5) file into an array of row objects. */
export function readXpt(path, wanted) {
  const buf = readFileSync(path);
  const text = (from, len) => buf.toString("latin1", from, from + len);
  const find = (marker, from = 0) => buf.indexOf(Buffer.from(marker, "latin1"), from);

  const namestrHeader = find("HEADER RECORD*******NAMESTR HEADER RECORD!!!!!!!");
  if (namestrHeader < 0) throw new Error(`${path}: not a SAS transport file`);
  const nvars = Number(text(namestrHeader + 54, 4));
  const namestrStart = namestrHeader + 80;
  const variables = [];
  for (let i = 0; i < nvars; i++) {
    const at = namestrStart + i * 140;
    variables.push({
      numeric: buf.readInt16BE(at) === 1,
      length: buf.readInt16BE(at + 4),
      name: text(at + 8, 8).trim(),
      position: buf.readInt32BE(at + 84),
    });
  }
  const obsHeader = find("HEADER RECORD*******OBS     HEADER RECORD!!!!!!!", namestrStart);
  const dataStart = obsHeader + 80;
  const rowLength = variables.reduce((sum, v) => sum + v.length, 0);
  const columns = variables.filter((v) => wanted.includes(v.name));
  const missing = wanted.filter((name) => !columns.some((c) => c.name === name));
  if (missing.length) throw new Error(`${path}: missing variables ${missing.join(", ")}`);

  const rows = [];
  for (let at = dataStart; at + rowLength <= buf.length; at += rowLength) {
    const row = {};
    for (const col of columns) {
      if (!col.numeric || col.length !== 8) throw new Error(`${col.name}: only 8-byte numerics are supported`);
      row[col.name] = ibmDouble(buf, at + col.position);
    }
    if (row[wanted[0]] !== null) rows.push(row); // trailing padding rows have no id
  }
  return rows;
}

/** Smallest value at which the cumulative weight reaches each requested share of the total. */
export function weightedPercentiles(items, points) {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  const out = [];
  let cumulative = 0;
  let i = 0;
  for (const p of points) {
    const target = (p / 100) * total;
    while (i < sorted.length - 1 && cumulative + sorted[i].weight < target) {
      cumulative += sorted[i].weight;
      i++;
    }
    out.push(sorted[i].value);
  }
  return out;
}

async function ensureFile(dir, name) {
  const path = join(dir, name);
  if (existsSync(path)) return path;
  mkdirSync(dir, { recursive: true });
  const res = await fetch(`${BASE_URL}/${name}`);
  if (!res.ok) throw new Error(`Download of ${name} failed: ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

const round = (value, decimals) => Number(value.toFixed(decimals));
const DECIMALS = { waist: 1, whtr: 3, bri: 2, rfm: 1, bmi: 1 };

async function main() {
  const argDir = process.argv.indexOf("--data");
  const dir = argDir > 0 ? resolve(process.argv[argDir + 1]) : join(tmpdir(), "nhanes-2021-2023");
  const demo = readXpt(await ensureFile(dir, "DEMO_L.xpt"), ["SEQN", "RIAGENDR", "RIDAGEYR", "RIDEXPRG", "WTMEC2YR"]);
  const body = readXpt(await ensureFile(dir, "BMX_L.xpt"), ["SEQN", "BMXWT", "BMXHT", "BMXWAIST"]);
  const bodyById = new Map(body.map((row) => [row.SEQN, row]));

  const people = [];
  for (const d of demo) {
    const b = bodyById.get(d.SEQN);
    if (!b || d.RIDAGEYR === null || d.RIDAGEYR < 18 || !d.WTMEC2YR || d.RIDEXPRG === 1) continue;
    people.push({
      sex: d.RIAGENDR === 1 ? "male" : "female",
      age: d.RIDAGEYR,
      weight: d.WTMEC2YR,
      heightCm: b.BMXHT,
      weightKg: b.BMXWT,
      waistCm: b.BMXWAIST,
    });
  }

  // Check against NCHS Data Brief 508 (obesity in adults 20 and over, August 2021–August 2023,
  // pregnant women excluded, BMI rounded to one decimal before the ≥ 30 cut-off):
  // https://www.cdc.gov/nchs/products/databriefs/db508.htm (read 2026-11-13).
  const prevalence = (subset) => {
    const valid = subset.filter((p) => p.age >= 20 && p.heightCm && p.weightKg);
    const total = valid.reduce((s, p) => s + p.weight, 0);
    return (100 * valid.filter((p) => Number(formulas.bmi(p).toFixed(1)) >= 30).reduce((s, p) => s + p.weight, 0)) / total;
  };
  const check = {
    all: prevalence(people),
    men: prevalence(people.filter((p) => p.sex === "male")),
    women: prevalence(people.filter((p) => p.sex === "female")),
    age20to39: prevalence(people.filter((p) => p.age <= 39)),
    age40to59: prevalence(people.filter((p) => p.age >= 40 && p.age <= 59)),
    age60plus: prevalence(people.filter((p) => p.age >= 60)),
  };
  console.log(
    `Obesity prevalence, adults 20+: ${check.all.toFixed(1)}% (men ${check.men.toFixed(1)}%, women ${check.women.toFixed(1)}%). NCHS Data Brief 508 reports 40.3% (men 39.2%, women 41.3%).`,
  );
  console.log(
    `By age: 20–39 ${check.age20to39.toFixed(1)}%, 40–59 ${check.age40to59.toFixed(1)}%, 60+ ${check.age60plus.toFixed(1)}%. NCHS reports 35.5%, 46.4%, 38.9%.`,
  );

  const table = {};
  for (const sex of ["female", "male"]) {
    table[sex] = {};
    for (const group of AGE_GROUPS) {
      const cell = people.filter((p) => p.sex === sex && p.age >= group.min && p.age <= group.max);
      const withWaist = cell.filter((p) => p.heightCm && p.waistCm);
      const withWeight = cell.filter((p) => p.heightCm && p.weightKg);
      const series = (rows, fn, decimals) =>
        weightedPercentiles(rows.map((p) => ({ value: fn(p), weight: p.weight })), PERCENTILE_POINTS).map((v) => round(v, decimals));
      table[sex][group.key] = {
        n: withWaist.length,
        waist: series(withWaist, (p) => p.waistCm, DECIMALS.waist),
        whtr: series(withWaist, formulas.whtr, DECIMALS.whtr),
        bri: series(withWaist, formulas.bri, DECIMALS.bri),
        rfm: series(withWaist, formulas.rfm, DECIMALS.rfm),
        bmi: series(withWeight, formulas.bmi, DECIMALS.bmi),
      };
      console.log(`${sex} ${group.key}: n=${withWaist.length}, median waist ${table[sex][group.key].waist[11]} cm`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    "// GENERATED by packages/engine/scripts/nhanes-percentiles.mjs — do not edit by hand.",
    "//",
    "// Weighted percentiles for US adults (18+, not pregnant) from NHANES August 2021–August 2023,",
    "// the CDC/NCHS examination survey: DEMO_L.xpt and BMX_L.xpt at",
    `// ${BASE_URL}/ (read ${today}).`,
    "// Examination weights (WTMEC2YR) applied. Check value from the same run: obesity prevalence in",
    `// adults 20+ = ${check.all.toFixed(1)}% (NCHS Data Brief 508 reports 40.3%).`,
    'import type { Sex } from "./types.js";',
    "",
    `export const NHANES_PERCENTILE_POINTS = ${JSON.stringify(PERCENTILE_POINTS)} as const;`,
    "",
    `export const NHANES_AGE_GROUPS = ${JSON.stringify(AGE_GROUPS.map((g) => ({ ...g, max: g.max === 200 ? null : g.max })))} as const;`,
    "",
    'export type NhanesAgeGroupKey = (typeof NHANES_AGE_GROUPS)[number]["key"];',
    'export type NhanesMetric = "waist" | "whtr" | "bri" | "rfm" | "bmi";',
    "export type NhanesCell = { n: number } & Record<NhanesMetric, number[]>;",
    "",
    "export const NHANES_PERCENTILES: Record<Sex, Record<NhanesAgeGroupKey, NhanesCell>> = {",
  ];
  for (const sex of ["female", "male"]) {
    lines.push(`  ${sex}: {`);
    for (const group of AGE_GROUPS) {
      const cell = table[sex][group.key];
      lines.push(`    "${group.key}": {`);
      lines.push(`      n: ${cell.n},`);
      for (const metric of ["waist", "whtr", "bri", "rfm", "bmi"]) lines.push(`      ${metric}: ${JSON.stringify(cell[metric])},`);
      lines.push("    },");
    }
    lines.push("  },");
  }
  lines.push("};", "");
  writeFileSync(OUT, lines.join("\n"));
  console.log(`Wrote ${OUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
