import { describe, expect, it } from 'vitest'
import { deriveProtocolEndDate, generateSchedule, phaseEndDate, weekStartDate } from './schedule'
import type { Phase, Protocol } from './types'

function phase(overrides: Partial<Phase> & Pick<Phase, 'startWeek' | 'endWeek' | 'dose'>): Phase {
  return {
    id: `p-${overrides.startWeek}-${overrides.endWeek}`,
    doseUnit: 'units',
    frequency: { type: 'daily', timesPerDay: 1 },
    ...overrides,
  }
}

describe('weekStartDate / phaseEndDate', () => {
  it('week 1 starts on the protocol start date', () => {
    expect(weekStartDate('2026-01-05', 1)).toBe('2026-01-05')
  })
  it('week 2 starts 7 days later', () => {
    expect(weekStartDate('2026-01-05', 2)).toBe('2026-01-12')
  })
  it('phase ending at week 2 ends the day before week 3 starts', () => {
    expect(phaseEndDate('2026-01-05', 2)).toBe('2026-01-18')
    expect(weekStartDate('2026-01-05', 3)).toBe('2026-01-19')
  })
})

describe('generateSchedule — frequency types', () => {
  const base = { id: 'pr1', startDate: '2026-01-05', status: 'active' as const }

  it('daily x1', () => {
    const protocol = { ...base, phases: [phase({ startWeek: 1, endWeek: 1, dose: 100 })] }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-11')
    expect(occ).toHaveLength(7)
    expect(occ.every((o) => o.slot === 0)).toBe(true)
  })

  it('daily x2 produces two slots per day', () => {
    const protocol = {
      ...base,
      phases: [phase({ startWeek: 1, endWeek: 1, dose: 100, frequency: { type: 'daily', timesPerDay: 2 } })],
    }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-05')
    expect(occ).toHaveLength(2)
    expect(occ.map((o) => o.slot)).toEqual([0, 1])
  })

  it('weekdays (Mon/Wed/Fri)', () => {
    // 2026-01-05 is a Monday
    const protocol = {
      ...base,
      phases: [phase({ startWeek: 1, endWeek: 2, dose: 100, frequency: { type: 'weekdays', days: [1, 3, 5] } })],
    }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-11')
    expect(occ.map((o) => o.date)).toEqual(['2026-01-05', '2026-01-07', '2026-01-09'])
  })

  it('everyNDays', () => {
    const protocol = {
      ...base,
      phases: [phase({ startWeek: 1, endWeek: 2, dose: 100, frequency: { type: 'everyNDays', n: 3 } })],
    }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-14')
    expect(occ.map((o) => o.date)).toEqual(['2026-01-05', '2026-01-08', '2026-01-11', '2026-01-14'])
  })

  it('weekly on a fixed weekday', () => {
    const protocol = {
      ...base,
      phases: [phase({ startWeek: 1, endWeek: 4, dose: 100, frequency: { type: 'weekly', day: 3 } })], // Wednesday
    }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-25')
    expect(occ.map((o) => o.date)).toEqual(['2026-01-07', '2026-01-14', '2026-01-21'])
  })

  it('cycle (5 on / 2 off)', () => {
    const protocol = {
      ...base,
      phases: [phase({ startWeek: 1, endWeek: 2, dose: 100, frequency: { type: 'cycle', onDays: 5, offDays: 2 } })],
    }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-18')
    // on: Jan5-9, off: Jan10-11, on: Jan12-16, off: Jan17-18
    expect(occ.map((o) => o.date)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
      '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16',
    ])
  })

  it('paused protocol yields no occurrences', () => {
    const protocol = { ...base, status: 'paused' as const, phases: [phase({ startWeek: 1, endWeek: 1, dose: 100 })] }
    expect(generateSchedule(protocol, '2026-01-05', '2026-01-11')).toHaveLength(0)
  })

  it('range before protocol start clamps to the start date', () => {
    const protocol = { ...base, phases: [phase({ startWeek: 1, endWeek: 1, dose: 100 })] }
    const occ = generateSchedule(protocol, '2025-12-01', '2026-01-06')
    expect(occ.map((o) => o.date)).toEqual(['2026-01-05', '2026-01-06'])
  })
})

describe('generateSchedule — multi-phase titration', () => {
  it('switches dose at phase boundaries', () => {
    const protocol = {
      id: 'pr2',
      startDate: '2026-01-05',
      status: 'active' as const,
      phases: [
        phase({ startWeek: 1, endWeek: 1, dose: 250 }),
        phase({ startWeek: 2, endWeek: 2, dose: 500 }),
      ],
    }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-18')
    const week1 = occ.filter((o) => o.date < '2026-01-12')
    const week2 = occ.filter((o) => o.date >= '2026-01-12')
    expect(week1.every((o) => o.plannedDose === 250)).toBe(true)
    expect(week2.every((o) => o.plannedDose === 500)).toBe(true)
  })

  it('days outside any phase produce no occurrence', () => {
    const protocol = {
      id: 'pr3',
      startDate: '2026-01-05',
      status: 'active' as const,
      phases: [phase({ startWeek: 1, endWeek: 1, dose: 250 })], // only week 1 defined
    }
    const occ = generateSchedule(protocol, '2026-01-05', '2026-01-20')
    expect(occ.every((o) => o.date < '2026-01-12')).toBe(true)
  })
})

describe('deriveProtocolEndDate', () => {
  it('returns undefined with no phases', () => {
    expect(deriveProtocolEndDate({ startDate: '2026-01-05', phases: [] })).toBeUndefined()
  })
  it('returns the last day of the highest-numbered phase', () => {
    const protocol: Pick<Protocol, 'startDate' | 'phases'> = {
      startDate: '2026-01-05',
      phases: [phase({ startWeek: 1, endWeek: 2, dose: 100 }), phase({ startWeek: 3, endWeek: 12, dose: 200 })],
    }
    expect(deriveProtocolEndDate(protocol)).toBe(phaseEndDate('2026-01-05', 12))
  })
})

// ---------------------------------------------------------------------------
// KLOW acceptance fixture — Wk 1–2 = 7.5u, Wk 3–4 = 15u, Wk 5–8 = 22.5u, Wk 9–12 = 15u, daily
// ---------------------------------------------------------------------------
describe('KLOW phase table fixture', () => {
  const protocol = {
    id: 'klow',
    startDate: '2026-01-05',
    status: 'active' as const,
    phases: [
      phase({ startWeek: 1, endWeek: 2, dose: 7.5 }),
      phase({ startWeek: 3, endWeek: 4, dose: 15 }),
      phase({ startWeek: 5, endWeek: 8, dose: 22.5 }),
      phase({ startWeek: 9, endWeek: 12, dose: 15 }),
    ],
  }

  it('produces one daily occurrence per day for the full 12-week run, dose per phase', () => {
    const start = protocol.startDate
    const end = phaseEndDate(start, 12)
    const occ = generateSchedule(protocol, start, end)
    expect(occ).toHaveLength(12 * 7)

    const wk1to2 = occ.filter((o) => o.date < weekStartDate(start, 3))
    const wk3to4 = occ.filter((o) => o.date >= weekStartDate(start, 3) && o.date < weekStartDate(start, 5))
    const wk5to8 = occ.filter((o) => o.date >= weekStartDate(start, 5) && o.date < weekStartDate(start, 9))
    const wk9to12 = occ.filter((o) => o.date >= weekStartDate(start, 9))

    expect(wk1to2.every((o) => o.plannedDose === 7.5)).toBe(true)
    expect(wk1to2).toHaveLength(14)
    expect(wk3to4.every((o) => o.plannedDose === 15)).toBe(true)
    expect(wk3to4).toHaveLength(14)
    expect(wk5to8.every((o) => o.plannedDose === 22.5)).toBe(true)
    expect(wk5to8).toHaveLength(28)
    expect(wk9to12.every((o) => o.plannedDose === 15)).toBe(true)
    expect(wk9to12).toHaveLength(28)
  })
})
