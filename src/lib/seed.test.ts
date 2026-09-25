import { describe, expect, it } from 'vitest'
import { SEED_COMPOUNDS } from './seed'

describe('SEED_COMPOUNDS', () => {
  it('has unique ids', () => {
    const ids = new Set(SEED_COMPOUNDS.map((c) => c.id))
    expect(ids.size).toBe(SEED_COMPOUNDS.length)
  })

  it('marks every entry as not user-defined', () => {
    expect(SEED_COMPOUNDS.every((c) => c.isUserDefined === false)).toBe(true)
  })

  it('seeds no default doses or protocols (no dose-shaped fields present)', () => {
    for (const c of SEED_COMPOUNDS) {
      expect(c).not.toHaveProperty('dose')
      expect(c).not.toHaveProperty('phases')
    }
  })

  it('includes the KLOW 80mg blend with correct components', () => {
    const klow = SEED_COMPOUNDS.find((c) => c.name === 'KLOW 80 mg')
    expect(klow).toBeDefined()
    expect(klow!.kind).toBe('blend')
    expect(klow!.components).toEqual([
      { name: 'GHK-Cu', mgPerVial: 50 },
      { name: 'BPC-157', mgPerVial: 10 },
      { name: 'TB-500', mgPerVial: 10 },
      { name: 'KPV', mgPerVial: 10 },
    ])
  })

  it('blend total vial size hint sums its components', () => {
    const klow = SEED_COMPOUNDS.find((c) => c.name === 'KLOW 80 mg')!
    expect(klow.commonVialSizesMg).toEqual([80])
  })

  it('includes both single compounds and blends', () => {
    expect(SEED_COMPOUNDS.some((c) => c.kind === 'single')).toBe(true)
    expect(SEED_COMPOUNDS.some((c) => c.kind === 'blend')).toBe(true)
  })

  it('every single compound has a name and category', () => {
    for (const c of SEED_COMPOUNDS) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.category.length).toBeGreaterThan(0)
    }
  })
})
