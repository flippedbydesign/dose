import { describe, expect, it } from 'vitest'
import { phaseEndDate } from './schedule'
import { computeProtocolReview } from './reviewStats'
import type { Phase } from './types'

function phase(overrides: Partial<Phase> & Pick<Phase, 'startWeek' | 'endWeek' | 'dose'>): Phase {
  return {
    id: `p-${overrides.startWeek}-${overrides.endWeek}`,
    doseUnit: 'units',
    frequency: { type: 'daily', timesPerDay: 1 },
    ...overrides,
  }
}

describe('computeProtocolReview — KLOW 80mg fixture', () => {
  const product = { vialAmountMg: 80, components: [{ name: 'BPC-157', mg: 10 }] }
  const compound = {}
  const bacMl = 3.0

  it('12-week run needs 5 vials and ends on the right date', () => {
    const protocol = {
      startDate: '2026-01-05',
      doseBasis: 'total' as const,
      phases: [
        phase({ startWeek: 1, endWeek: 2, dose: 7.5 }),
        phase({ startWeek: 3, endWeek: 4, dose: 15 }),
        phase({ startWeek: 5, endWeek: 8, dose: 22.5 }),
        phase({ startWeek: 9, endWeek: 12, dose: 15 }),
      ],
    }
    const stats = computeProtocolReview(protocol, product, compound, bacMl)
    expect(stats.endDate).toBe(phaseEndDate('2026-01-05', 12))
    expect(stats.totalDoses).toBe(12 * 7)
    expect(stats.totalVolumeMl).toBeCloseTo(13.65, 6)
    expect(stats.totalVialsNeeded).toBe(5)
  })

  it('8-week run needs 4 vials', () => {
    const protocol = {
      startDate: '2026-01-05',
      doseBasis: 'total' as const,
      phases: [
        phase({ startWeek: 1, endWeek: 2, dose: 7.5 }),
        phase({ startWeek: 3, endWeek: 4, dose: 15 }),
        phase({ startWeek: 5, endWeek: 8, dose: 22.5 }),
      ],
    }
    const stats = computeProtocolReview(protocol, product, compound, bacMl)
    expect(stats.totalVialsNeeded).toBe(4)
  })

  it('returns zeroed stats with no phases', () => {
    const stats = computeProtocolReview({ startDate: '2026-01-05', doseBasis: 'total', phases: [] }, product, compound, bacMl)
    expect(stats.endDate).toBeUndefined()
    expect(stats.totalDoses).toBe(0)
  })
})
