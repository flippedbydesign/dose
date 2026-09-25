import { describe, expect, it } from 'vitest'
import { mlFromUnits } from './calc'
import { addDays } from './dates'
import { forecast, type DoseConsumption } from './forecast'
import { generateSchedule, phaseEndDate } from './schedule'
import type { Phase } from './types'

function phase(overrides: Partial<Phase> & Pick<Phase, 'startWeek' | 'endWeek' | 'dose'>): Phase {
  return {
    id: `p-${overrides.startWeek}-${overrides.endWeek}`,
    doseUnit: 'units',
    frequency: { type: 'daily', timesPerDay: 1 },
    ...overrides,
  }
}

const KLOW_START = '2026-01-05'
const klowProtocol = {
  id: 'klow',
  startDate: KLOW_START,
  status: 'active' as const,
  phases: [
    phase({ startWeek: 1, endWeek: 2, dose: 7.5 }),
    phase({ startWeek: 3, endWeek: 4, dose: 15 }),
    phase({ startWeek: 5, endWeek: 8, dose: 22.5 }),
    phase({ startWeek: 9, endWeek: 12, dose: 15 }),
  ],
}

function klowDoses(weeks: number): DoseConsumption[] {
  const end = phaseEndDate(KLOW_START, weeks)
  return generateSchedule(klowProtocol, KLOW_START, end).map((o) => ({
    date: o.date,
    volumeMl: mlFromUnits(o.plannedDose),
  }))
}

describe('forecast — KLOW 80mg acceptance fixture', () => {
  it('exhausts vial 1 exactly after the day-27 dose', () => {
    const doses = klowDoses(12)
    const result = forecast({
      doses,
      vialCapacityMl: 3.0,
      deadVolumeMl: 0,
      inventory: { activeVialRemainingMl: 3.0, unopenedVialCount: 0 },
    })
    const day27 = addDays(KLOW_START, 26) // day 1 = start date
    expect(result.currentVialRunOutDate).toBe(day27)
    // With no backup vial on hand, "all stock" runs out at the same point.
    expect(result.allStockRunOutDate).toBe(day27)
  })

  it('8-week run: 945 units consumed = 3.15 vials -> 4 vials needed (rounded up, not down)', () => {
    const doses = klowDoses(8)
    const result = forecast({
      doses,
      vialCapacityMl: 3.0,
      deadVolumeMl: 0,
      inventory: { activeVialRemainingMl: 3.0, unopenedVialCount: 0 },
    })
    expect(result.totalVolumeNeededMl).toBeCloseTo(9.45, 6) // 945 units * 0.01 mL
    expect(result.vialsNeededExact).toBeCloseTo(3.15, 6)
    expect(result.vialsNeededTotal).toBe(4)
    expect(result.vialsStillNeeded).toBe(3) // 4 total - 1 already on hand
  })

  it('12-week run: 1365 units consumed = 4.55 vials -> 5 vials needed', () => {
    const doses = klowDoses(12)
    const result = forecast({
      doses,
      vialCapacityMl: 3.0,
      deadVolumeMl: 0,
      inventory: { activeVialRemainingMl: 3.0, unopenedVialCount: 0 },
    })
    expect(result.totalVolumeNeededMl).toBeCloseTo(13.65, 6) // 1365 units * 0.01 mL
    expect(result.vialsNeededExact).toBeCloseTo(4.55, 6)
    expect(result.vialsNeededTotal).toBe(5)
    expect(result.vialsStillNeeded).toBe(4)
  })

  it('coversFullProtocol is false when on-hand stock runs dry before protocol end', () => {
    const doses = klowDoses(12)
    const protocolEndDate = phaseEndDate(KLOW_START, 12)
    const result = forecast({
      doses,
      vialCapacityMl: 3.0,
      inventory: { activeVialRemainingMl: 3.0, unopenedVialCount: 0 },
      protocolEndDate,
    })
    expect(result.coversFullProtocol).toBe(false)
  })

  it('coversFullProtocol is true when enough unopened vials are on hand', () => {
    const doses = klowDoses(12)
    const protocolEndDate = phaseEndDate(KLOW_START, 12)
    const result = forecast({
      doses,
      vialCapacityMl: 3.0,
      inventory: { activeVialRemainingMl: 3.0, unopenedVialCount: 4 }, // 5 vials total on hand, need 5
      protocolEndDate,
    })
    expect(result.allStockRunOutDate).toBeUndefined()
    expect(result.coversFullProtocol).toBe(true)
    expect(result.vialsStillNeeded).toBe(0)
  })

  it('syringe and alcohol swab counts match dose count', () => {
    const doses = klowDoses(8)
    const result = forecast({ doses, vialCapacityMl: 3.0, inventory: { unopenedVialCount: 10 } })
    expect(result.syringeCount).toBe(doses.length)
    expect(result.alcoholSwabCount).toBe(doses.length * 2)
  })

  it('dead volume shortens run-out and increases vials needed', () => {
    const doses = klowDoses(8)
    const noDead = forecast({ doses, vialCapacityMl: 3.0, deadVolumeMl: 0, inventory: { unopenedVialCount: 10 } })
    const withDead = forecast({ doses, vialCapacityMl: 3.0, deadVolumeMl: 0.01, inventory: { unopenedVialCount: 10 } })
    expect(withDead.totalVolumeNeededMl).toBeGreaterThan(noDead.totalVolumeNeededMl)
    expect(withDead.vialsNeededExact).toBeGreaterThan(noDead.vialsNeededExact)
  })
})

describe('forecast — beyond-use date waste', () => {
  it('flags waste when the vial expires before it would be used up', () => {
    const doses = klowDoses(8)
    const result = forecast({
      doses,
      vialCapacityMl: 3.0,
      inventory: {
        activeVialRemainingMl: 3.0,
        activeVialBeyondUseDate: addDays(KLOW_START, 10), // expires well before day-27 run-out
        unopenedVialCount: 0,
      },
    })
    expect(result.beyondUseWaste).toBeDefined()
    expect(result.beyondUseWaste!.beyondUseDate).toBe(addDays(KLOW_START, 10))
    expect(result.beyondUseWaste!.wastedMl).toBeGreaterThan(0)
  })

  it('does not flag waste when the vial is used up before its beyond-use date', () => {
    const doses = klowDoses(8)
    const result = forecast({
      doses,
      vialCapacityMl: 3.0,
      inventory: {
        activeVialRemainingMl: 3.0,
        activeVialBeyondUseDate: addDays(KLOW_START, 90), // long after day-27 run-out
        unopenedVialCount: 0,
      },
    })
    expect(result.beyondUseWaste).toBeUndefined()
  })
})

describe('forecast — simple non-KLOW sanity cases', () => {
  it('with no inventory at all, everything still needed is reported', () => {
    const doses: DoseConsumption[] = [
      { date: '2026-02-01', volumeMl: 0.1 },
      { date: '2026-02-02', volumeMl: 0.1 },
    ]
    const result = forecast({ doses, vialCapacityMl: 1, inventory: { unopenedVialCount: 0 } })
    expect(result.totalVolumeNeededMl).toBeCloseTo(0.2, 6)
    expect(result.vialsNeededTotal).toBe(1)
    expect(result.vialsStillNeeded).toBe(1)
    expect(result.allStockRunOutDate).toBe('2026-02-01') // first dose already exceeds 0 mL on hand
  })

  it('empty dose list yields zeroed-out result', () => {
    const result = forecast({ doses: [], vialCapacityMl: 3, inventory: { unopenedVialCount: 1 } })
    expect(result.totalVolumeNeededMl).toBe(0)
    expect(result.vialsNeededTotal).toBe(0)
    expect(result.vialsStillNeeded).toBe(0)
    expect(result.syringeCount).toBe(0)
  })
})
