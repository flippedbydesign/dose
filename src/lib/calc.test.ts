import { describe, expect, it } from 'vitest'
import {
  componentBasisVolumeMl,
  componentMcgPerUnit,
  computeRecon,
  concentrationMcgPerMl,
  doseMcgFromIU,
  dosesPerVial,
  getCalcWarnings,
  mlFromUnits,
  reverseBacMlForTargetUnits,
  roundMcgDisplay,
  roundMlDisplay,
  roundUnitsDisplay,
  unitsFromMl,
  volumeMlForDose,
} from './calc'

describe('concentrationMcgPerMl', () => {
  it('computes basic concentration', () => {
    expect(concentrationMcgPerMl(5, 2)).toBe(2500)
  })
  it('returns 0 for zero water', () => {
    expect(concentrationMcgPerMl(5, 0)).toBe(0)
  })
})

describe('volumeMlForDose / unitsFromMl', () => {
  it('computes draw volume and units', () => {
    const conc = concentrationMcgPerMl(5, 2) // 2500 mcg/mL
    const vol = volumeMlForDose(250, conc) // 0.1 mL
    expect(vol).toBeCloseTo(0.1, 6)
    expect(unitsFromMl(vol)).toBeCloseTo(10, 6)
  })
})

describe('mlFromUnits', () => {
  it('round-trips with unitsFromMl', () => {
    expect(mlFromUnits(unitsFromMl(0.37))).toBeCloseTo(0.37, 9)
  })
})

describe('dosesPerVial', () => {
  it('floors and accounts for dead volume', () => {
    expect(dosesPerVial(3, 0.1, 0)).toBe(30)
    expect(dosesPerVial(3, 0.1, 0.02)).toBe(25) // 3 / 0.12 = 25
  })
  it('handles zero volume gracefully', () => {
    expect(dosesPerVial(3, 0, 0)).toBe(0)
  })
})

describe('doseMcgFromIU', () => {
  it('converts using iuPerMg potency', () => {
    // e.g. HGH ~3 IU/mg -> 1 IU = 333.3 mcg
    expect(doseMcgFromIU(1, 3)).toBeCloseTo(333.333, 2)
  })
  it('returns 0 when potency unknown', () => {
    expect(doseMcgFromIU(1, 0)).toBe(0)
  })
})

describe('reverseBacMlForTargetUnits', () => {
  it('solves for water volume given a target unit draw', () => {
    // vial 5mg, want 250mcg dose to land at 10 units
    const bac = reverseBacMlForTargetUnits(5, 10, 250)
    expect(bac).toBeCloseTo(2, 6)
    // sanity: forward-check
    const conc = concentrationMcgPerMl(5, bac)
    expect(unitsFromMl(volumeMlForDose(250, conc))).toBeCloseTo(10, 6)
  })
})

describe('componentBasisVolumeMl', () => {
  it('computes draw volume from a component dose', () => {
    // KLOW: BPC-157 10mg component in 3mL water, want 250mcg of BPC-157
    const vol = componentBasisVolumeMl(250, 10, 3)
    expect(vol).toBeCloseTo(0.075, 6)
  })
})

describe('rounding helpers', () => {
  it('rounds units to nearest 0.5', () => {
    expect(roundUnitsDisplay(7.24)).toBe(7)
    expect(roundUnitsDisplay(7.26)).toBe(7.5)
    expect(roundUnitsDisplay(7.76)).toBe(8)
  })
  it('rounds mL to 3 decimals', () => {
    expect(roundMlDisplay(0.0754321)).toBe(0.075)
  })
  it('rounds mcg to 1 decimal', () => {
    expect(roundMcgDisplay(266.666)).toBe(266.7)
  })
})

describe('getCalcWarnings', () => {
  it('flags a low draw under 5 units', () => {
    const warnings = getCalcWarnings(3, 2)
    expect(warnings).toContainEqual({ type: 'low-draw', units: 3 })
  })
  it('flags over syringe capacity', () => {
    const warnings = getCalcWarnings(120, 2, { syringeType: 'U100-1.0' })
    expect(warnings).toContainEqual({ type: 'over-capacity', units: 120, capacity: 100 })
  })
  it('flags high water volume vs hint', () => {
    const warnings = getCalcWarnings(50, 5, { vialCapacityHintMl: 3 })
    expect(warnings).toContainEqual({ type: 'high-water-volume', bacMl: 5, hintMl: 3 })
  })
  it('produces no warnings for a normal draw', () => {
    expect(getCalcWarnings(15, 2)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Acceptance fixture — KLOW 80 mg (scope doc §6)
// Product: 80 mg blend = GHK-Cu 50 + BPC-157 10 + TB-500 10 + KPV 10. BAC water 3.0 mL.
// ---------------------------------------------------------------------------
describe('KLOW 80mg acceptance fixture', () => {
  const vialMg = 80
  const bacMl = 3.0
  const components = { ghkCu: 50, bpc157: 10, tb500: 10, kpv: 10 }

  it('total concentration is 26.67 mg/mL', () => {
    const conc = concentrationMcgPerMl(vialMg, bacMl)
    expect(conc / 1000).toBeCloseTo(26.67, 2)
  })

  it('mcg per unit (total) is 266.7', () => {
    const conc = concentrationMcgPerMl(vialMg, bacMl)
    const mcgPerUnit = conc / 100
    expect(roundMcgDisplay(mcgPerUnit)).toBeCloseTo(266.7, 1)
  })

  it('BPC-157 / TB-500 / KPV are 33.3 mcg per unit each', () => {
    expect(roundMcgDisplay(componentMcgPerUnit(components.bpc157, bacMl))).toBeCloseTo(33.3, 1)
    expect(roundMcgDisplay(componentMcgPerUnit(components.tb500, bacMl))).toBeCloseTo(33.3, 1)
    expect(roundMcgDisplay(componentMcgPerUnit(components.kpv, bacMl))).toBeCloseTo(33.3, 1)
  })

  it('GHK-Cu is 166.7 mcg per unit', () => {
    expect(roundMcgDisplay(componentMcgPerUnit(components.ghkCu, bacMl))).toBeCloseTo(166.7, 1)
  })

  it('7.5 units = 0.075 mL = 250 mcg BPC/TB/KPV + 1.25 mg GHK-Cu', () => {
    const units = 7.5
    const ml = mlFromUnits(units)
    expect(roundMlDisplay(ml)).toBeCloseTo(0.075, 3)

    const bpcDelivered = componentMcgPerUnit(components.bpc157, bacMl) * units
    const tbDelivered = componentMcgPerUnit(components.tb500, bacMl) * units
    const kpvDelivered = componentMcgPerUnit(components.kpv, bacMl) * units
    const ghkDelivered = componentMcgPerUnit(components.ghkCu, bacMl) * units

    expect(roundMcgDisplay(bpcDelivered)).toBeCloseTo(250, 0)
    expect(roundMcgDisplay(tbDelivered)).toBeCloseTo(250, 0)
    expect(roundMcgDisplay(kpvDelivered)).toBeCloseTo(250, 0)
    expect(ghkDelivered / 1000).toBeCloseTo(1.25, 2)
  })

  it('units per vial is 300', () => {
    // 300 units = 3.0 mL, exactly the full vial (0 dead volume)
    const totalUnits = unitsFromMl(bacMl)
    expect(totalUnits).toBeCloseTo(300, 6)
  })

  it('computeRecon bundles the same figures for a 7.5-unit (250mcg component) draw', () => {
    // Using total-basis dose that lands at 7.5 units: 266.7 mcg/unit * 7.5 = 2000 mcg total
    const conc = concentrationMcgPerMl(vialMg, bacMl)
    const totalDoseMcg = (conc / 100) * 7.5
    const result = computeRecon({ vialMg, bacMl, doseMcg: totalDoseMcg })
    expect(roundUnitsDisplay(result.units)).toBeCloseTo(7.5, 1)
    expect(result.dosesPerVial).toBe(40) // 3.0 / 0.075
  })
})
