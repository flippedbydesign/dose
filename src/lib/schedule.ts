// Schedule generation: expands a Protocol's Phases + Frequency into scheduled
// dose occurrences for a date range. Pure, deterministic, and does NOT touch
// persistence — callers merge the result against persisted DoseEvent overrides.
import type { Frequency, Phase, Protocol } from './types'
import { addDays, dayOfWeek, diffDays, isSameOrAfter, isSameOrBefore, weekIndexSinceStart, type DateStr } from './dates'

export interface ScheduledOccurrence {
  protocolId: string
  date: DateStr
  slot: number
  plannedDose: number
  plannedUnit: Phase['doseUnit']
  phaseId: string
}

/** True if `date` is an active day under the given frequency rule, relative to the phase's own start. */
export function isActiveDay(frequency: Frequency, date: DateStr, phaseStartDate: DateStr): boolean {
  switch (frequency.type) {
    case 'daily':
      return true
    case 'weekdays':
      return frequency.days.includes(dayOfWeek(date))
    case 'everyNDays': {
      const days = diffDays(date, phaseStartDate)
      return days >= 0 && days % frequency.n === 0
    }
    case 'weekly':
      return dayOfWeek(date) === frequency.day
    case 'cycle': {
      const days = diffDays(date, phaseStartDate)
      if (days < 0) return false
      const cycleLen = frequency.onDays + frequency.offDays
      const posInCycle = days % cycleLen
      return posInCycle < frequency.onDays
    }
  }
}

export function timesPerDay(frequency: Frequency): number {
  return frequency.type === 'daily' ? frequency.timesPerDay : 1
}

/** The calendar date a given 1-based protocol week starts on. */
export function weekStartDate(protocolStart: DateStr, week: number): DateStr {
  return addDays(protocolStart, (week - 1) * 7)
}

/** The last calendar date covered by a phase (inclusive), given its endWeek. */
export function phaseEndDate(protocolStart: DateStr, endWeek: number): DateStr {
  return addDays(protocolStart, endWeek * 7 - 1)
}

/**
 * Derive a protocol's overall end date from its phases (the last day of the
 * last phase), or undefined if there are no phases.
 */
export function deriveProtocolEndDate(protocol: Pick<Protocol, 'startDate' | 'phases'>): DateStr | undefined {
  if (protocol.phases.length === 0) return undefined
  const maxEndWeek = Math.max(...protocol.phases.map((p) => p.endWeek))
  return phaseEndDate(protocol.startDate, maxEndWeek)
}

/**
 * Generate scheduled occurrences for a protocol between rangeStart and rangeEnd
 * (inclusive), derived purely from its phases — no persisted overrides applied.
 */
export function generateSchedule(
  protocol: Pick<Protocol, 'id' | 'startDate' | 'phases' | 'status' | 'pausedAt'>,
  rangeStart: DateStr,
  rangeEnd: DateStr,
): ScheduledOccurrence[] {
  if (protocol.status === 'paused' || protocol.phases.length === 0) return []

  const occurrences: ScheduledOccurrence[] = []
  let cursor = isSameOrAfter(rangeStart, protocol.startDate) ? rangeStart : protocol.startDate
  const end = rangeEnd

  while (isSameOrBefore(cursor, end)) {
    const week = weekIndexSinceStart(protocol.startDate, cursor)
    const phase = protocol.phases.find((p) => week >= p.startWeek && week <= p.endWeek)
    if (phase) {
      const phaseStart = weekStartDate(protocol.startDate, phase.startWeek)
      if (isActiveDay(phase.frequency, cursor, phaseStart)) {
        const slots = timesPerDay(phase.frequency)
        for (let slot = 0; slot < slots; slot++) {
          occurrences.push({
            protocolId: protocol.id,
            date: cursor,
            slot,
            plannedDose: phase.dose,
            plannedUnit: phase.doseUnit,
            phaseId: phase.id,
          })
        }
      }
    }
    cursor = addDays(cursor, 1)
  }

  return occurrences
}

export interface SimpleOccurrence {
  date: DateStr
  slot: number
}

/** Generic single-frequency occurrence generator, reused by the Supplements tab (scope doc §5.8). */
export function generateFrequencyOccurrences(
  frequency: Frequency,
  startDate: DateStr,
  rangeStart: DateStr,
  rangeEnd: DateStr,
): SimpleOccurrence[] {
  const occurrences: SimpleOccurrence[] = []
  let cursor = isSameOrAfter(rangeStart, startDate) ? rangeStart : startDate
  while (isSameOrBefore(cursor, rangeEnd)) {
    if (isActiveDay(frequency, cursor, startDate)) {
      const slots = timesPerDay(frequency)
      for (let slot = 0; slot < slots; slot++) occurrences.push({ date: cursor, slot })
    }
    cursor = addDays(cursor, 1)
  }
  return occurrences
}
