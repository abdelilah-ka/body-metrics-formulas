export interface Source {
  citation: string;
  url?: string;
}

export interface Band {
  key: string;
  label: string;
  /** Upper bound of this band, exclusive. Infinity for the top band. */
  max: number;
  color: string;
  bg: string;
}

/**
 * Canonical shape every calculator returns. UI, share-image, and the
 * embeddable widget all render generically off this object (PRD §3.1).
 */
export interface CalculatorResult<TInputs = Record<string, number | string>> {
  value: number;
  unit: string;
  band: Band;
  interpretationKey: string;
  inputsEcho: TInputs;
  sources: Source[];
  /** Only set where band thresholds are computed per-request (e.g. ABSI's age/sex-adjusted
   * bands) rather than fixed — lets the UI render a gauge in the same units as `value`. */
  bands?: Band[];
  /** Only set where the result has a natural standard-score framing (e.g. ABSI). */
  zScore?: number;
}

export type Sex = "male" | "female";

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface Range {
  min: number;
  max: number;
}
