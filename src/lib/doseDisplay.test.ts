import { describe, expect, it } from 'vitest'
import { roundUnitsDisplay } from './calc'
import { computeDoseDisplay } from './doseDisplay'

describe('computeDoseDisplay', () => {
  it('units dose passes straight through', () => {
    const result = computeDoseDisplay({
      dose: 7.5,
      doseUnit: 'units',
      product: { vialAmountMg: 80 },
      compound: {},
      doseBasis: 'total',
      bacMl: 3,
    })
    expect(result.units).toBe(7.5)
    expect(result.volumeMl).toBeCloseTo(0.075, 6)
  })

  it('mcg total-basis dose on a single compound', () => {
    const result = computeDoseDisplay({
      dose: 250,
      doseUnit: 'mcg',
      product: { vialAmountMg: 5 },
      compound: {},
      doseBasis: 'total',
      bacMl: 2,
    })
    // concentration = 2500 mcg/mL, volume = 0.1mL, units = 10
    expect(result.volumeMl).toBeCloseTo(0.1, 6)
    expect(result.units).toBeCloseTo(10, 6)
  })

  it('KLOW component-basis dose (250mcg BPC-157) resolves to 7.5 units', () => {
    const result = computeDoseDisplay({
      dose: 250,
      doseUnit: 'mcg',
      product: {
        vialAmountMg: 80,
        components: [
          { name: 'GHK-Cu', mg: 50 },
          { name: 'BPC-157', mg: 10 },
          { name: 'TB-500', mg: 10 },
          { name: 'KPV', mg: 10 },
        ],
      },
      compound: {},
      doseBasis: 'component',
      basisComponent: 'BPC-157',
      bacMl: 3,
    })
    expect(roundUnitsDisplay(result.units)).toBeCloseTo(7.5, 1)
  })

  it('IU dose converts via compound potency before computing volume', () => {
    const result = computeDoseDisplay({
      dose: 1,
      doseUnit: 'IU',
      product: { vialAmountMg: 10 },
      compound: { iuPerMg: 3 },
      doseBasis: 'total',
      bacMl: 1,
    })
    // 1 IU -> 333.3 mcg; concentration 10000 mcg/mL -> 0.0333 mL -> 3.33 units
    expect(result.units).toBeCloseTo(3.333, 2)
  })
})
