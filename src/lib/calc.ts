// Reconstitution & dosing math. This module is pure and fully unit-tested —
// see calc.test.ts, including the KLOW 80mg acceptance fixture from the scope doc.
import type { DoseUnit, SyringeType } from './types'
import { SYRINGE_CAPACITY_UNITS } from './types'

const UNITS_PER_ML_U100 = 100

/** mcg/mL for a given vial strength (mg) reconstituted with bacMl of water. */
export function concentrationMcgPerMl(vialMg: number, bacMl: number): number {
  if (bacMl <= 0) return 0
  return (vialMg * 1000) / bacMl
}

/** mL to draw for a given dose (mcg) at a given concentration (mcg/mL). */
export function volumeMlForDose(doseMcg: number, concentrationMcgPerMl: number): number {
  if (concentrationMcgPerMl <= 0) return 0
  return doseMcg / concentrationMcgPerMl
}

/** Convert a drawn volume (mL) to U-100 syringe units (100 units = 1 mL). */
export function unitsFromMl(volumeMl: number): number {
  return volumeMl * UNITS_PER_ML_U100
}

/** Convert U-100 syringe units to mL. */
export function mlFromUnits(units: number): number {
  return units / UNITS_PER_ML_U100
}

/** How many full doses a vial yields, accounting for per-dose dead volume/hub loss. */
export function dosesPerVial(bacMl: number, volumeMlPerDose: number, deadVolumeMl = 0): number {
  const perDose = volumeMlPerDose + deadVolumeMl
  if (perDose <= 0) return 0
  // Guard against floating-point noise (e.g. 3 / 0.075 evaluating to 39.999999999999993)
  // pushing an exact-division result just under its true integer value.
  const EPSILON = 1e-9
  return Math.floor(bacMl / perDose + EPSILON)
}

/** mcg of one component delivered per syringe unit, for a blend. */
export function componentMcgPerUnit(componentMg: number, bacMl: number): number {
  if (bacMl <= 0) return 0
  return (componentMg * 1000) / bacMl / UNITS_PER_ML_U100
}

/** Convert an IU dose to mcg, given the compound's mcg-per-IU potency (iuPerMg is mg per... see below). */
export function doseMcgFromIU(doseIU: number, iuPerMg: number): number {
  if (!iuPerMg) return 0
  return (doseIU / iuPerMg) * 1000
}

/**
 * Reverse mode: solve for the BAC water volume (mL) needed so that a target
 * dose corresponds to exactly targetUnits on the syringe.
 *   bac_ml = vial_mg * 1000 * target_units / (100 * dose_mcg)
 */
export function reverseBacMlForTargetUnits(vialMg: number, targetUnits: number, doseMcg: number): number {
  if (doseMcg <= 0) return 0
  return (vialMg * 1000 * targetUnits) / (UNITS_PER_ML_U100 * doseMcg)
}

/**
 * For blends dosed by a single component's amount: the draw volume needed to
 * deliver componentDoseMcg of that component.
 *   volume_ml = component_dose_mcg / (component_mg * 1000 / bac_ml)
 */
export function componentBasisVolumeMl(componentDoseMcg: number, componentMg: number, bacMl: number): number {
  const concentration = concentrationMcgPerMl(componentMg, bacMl)
  if (concentration <= 0) return 0
  return componentDoseMcg / concentration
}

/** Normalize a dose entered in mg/mcg/IU to mcg. 'units' cannot be converted without concentration context. */
export function toMcg(dose: number, unit: DoseUnit, iuPerMg?: number): number {
  switch (unit) {
    case 'mcg':
      return dose
    case 'mg':
      return dose * 1000
    case 'IU':
      return iuPerMg ? doseMcgFromIU(dose, iuPerMg) : 0
    case 'units':
      return NaN // requires concentration; convert via volumeMl * concentration elsewhere
  }
}

// ---- Display rounding (spec §6: store full precision, round only for display) ----

export function roundUnitsDisplay(units: number): number {
  return Math.round(units * 2) / 2
}

export function roundMlDisplay(ml: number): number {
  return Math.round(ml * 1000) / 1000
}

export function roundMcgDisplay(mcg: number): number {
  return Math.round(mcg * 10) / 10
}

// ---- Warnings ----

export type CalcWarning =
  | { type: 'low-draw'; units: number }
  | { type: 'over-capacity'; units: number; capacity: number }
  | { type: 'high-water-volume'; bacMl: number; hintMl: number }

export interface CalcWarningOptions {
  lowDrawUnitsThreshold?: number // default 5
  syringeType?: SyringeType
  vialCapacityHintMl?: number // default 3
}

export function getCalcWarnings(
  units: number,
  bacMl: number,
  opts: CalcWarningOptions = {},
): CalcWarning[] {
  const {
    lowDrawUnitsThreshold = 5,
    syringeType = 'U100-1.0',
    vialCapacityHintMl = 3,
  } = opts
  const warnings: CalcWarning[] = []
  if (units > 0 && units < lowDrawUnitsThreshold) {
    warnings.push({ type: 'low-draw', units })
  }
  const capacity = SYRINGE_CAPACITY_UNITS[syringeType]
  if (units > capacity) {
    warnings.push({ type: 'over-capacity', units, capacity })
  }
  if (bacMl > vialCapacityHintMl) {
    warnings.push({ type: 'high-water-volume', bacMl, hintMl: vialCapacityHintMl })
  }
  return warnings
}

/** Full result bundle for the reconstitution calculator UI. */
export interface ReconResult {
  concentrationMcgPerMl: number
  concentrationMgPerMl: number
  mcgPerUnit: number
  volumeMl: number
  units: number
  dosesPerVial: number
  warnings: CalcWarning[]
}

export function computeRecon(params: {
  vialMg: number
  bacMl: number
  doseMcg: number
  deadVolumeMl?: number
  syringeType?: SyringeType
  vialCapacityHintMl?: number
}): ReconResult {
  const { vialMg, bacMl, doseMcg, deadVolumeMl = 0, syringeType, vialCapacityHintMl } = params
  const concentration = concentrationMcgPerMl(vialMg, bacMl)
  const volumeMl = volumeMlForDose(doseMcg, concentration)
  const units = unitsFromMl(volumeMl)
  return {
    concentrationMcgPerMl: concentration,
    concentrationMgPerMl: concentration / 1000,
    mcgPerUnit: concentration / UNITS_PER_ML_U100,
    volumeMl,
    units,
    dosesPerVial: dosesPerVial(bacMl, volumeMl, deadVolumeMl),
    warnings: getCalcWarnings(units, bacMl, { syringeType, vialCapacityHintMl }),
  }
}
