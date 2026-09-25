import { describe, expect, it } from 'vitest'
import { mergeDoseEvents } from './merge'
import type { ScheduledOccurrence } from './schedule'
import type { DoseEvent } from './types'

function occ(date: string, slot = 0, dose = 250): ScheduledOccurrence {
  return { protocolId: 'pr1', date, slot, plannedDose: dose, plannedUnit: 'mcg', phaseId: 'ph1' }
}

describe('mergeDoseEvents', () => {
  it('synthesizes a virtual, untaken event for a day with no persisted row', () => {
    const merged = mergeDoseEvents([occ('2026-01-01')], [])
    expect(merged).toHaveLength(1)
    expect(merged[0].persisted).toBe(false)
    expect(merged[0].taken).toBe(false)
    expect(merged[0].plannedDose).toBe(250)
  })

  it('a persisted row overrides the generated occurrence for the same day/slot', () => {
    const persisted: DoseEvent = {
      id: 'e1',
      protocolId: 'pr1',
      date: '2026-01-01',
      slot: 0,
      plannedDose: 250,
      plannedUnit: 'mcg',
      actualDose: 300,
      taken: true,
      isOverride: true,
    }
    const merged = mergeDoseEvents([occ('2026-01-01')], [persisted])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ persisted: true, taken: true, actualDose: 300 })
  })

  it('editing a phase regenerates future non-overridden days without touching persisted ones', () => {
    // Simulate: day 1 was checked off (persisted), day 2 regenerated with a new dose after a phase edit.
    const persisted: DoseEvent = {
      id: 'e1',
      protocolId: 'pr1',
      date: '2026-01-01',
      slot: 0,
      plannedDose: 250,
      plannedUnit: 'mcg',
      taken: true,
      isOverride: false,
    }
    const newOccurrences = [occ('2026-01-01', 0, 999 /* would-be new dose, ignored */), occ('2026-01-02', 0, 500)]
    const merged = mergeDoseEvents(newOccurrences, [persisted])
    const day1 = merged.find((m) => m.date === '2026-01-01')!
    const day2 = merged.find((m) => m.date === '2026-01-02')!
    expect(day1.plannedDose).toBe(250) // untouched, not overwritten by regenerated 999
    expect(day1.taken).toBe(true)
    expect(day2.plannedDose).toBe(500)
    expect(day2.taken).toBe(false)
  })

  it('keeps a persisted override even when it falls outside the newly generated range', () => {
    const persisted: DoseEvent = {
      id: 'e1',
      protocolId: 'pr1',
      date: '2026-03-01',
      slot: 0,
      plannedDose: 250,
      plannedUnit: 'mcg',
      taken: true,
      isOverride: true,
    }
    const merged = mergeDoseEvents([occ('2026-01-01')], [persisted])
    expect(merged.some((m) => m.id === 'e1')).toBe(true)
  })

  it('sorts by date then slot', () => {
    const merged = mergeDoseEvents(
      [occ('2026-01-02', 1), occ('2026-01-01', 1), occ('2026-01-01', 0)],
      [],
    )
    expect(merged.map((m) => `${m.date}#${m.slot}`)).toEqual(['2026-01-01#0', '2026-01-01#1', '2026-01-02#1'])
  })
})
