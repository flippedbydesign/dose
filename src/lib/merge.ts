// Merges generated schedule occurrences with persisted DoseEvent overrides.
// Key rule (scope doc §4): a DoseEvent row is only persisted once the user
// checks it, edits it, or overrides it. Editing a phase regenerates future
// non-overridden days; past and overridden days are never touched — which
// falls out naturally here because persisted rows always win over generated ones.
import type { ScheduledOccurrence, SimpleOccurrence } from './schedule'
import type { DoseEvent, SupplementDoseEvent } from './types'

function keyOf(protocolId: string, date: string, slot: number): string {
  return `${protocolId}|${date}|${slot}`
}

/** A dose event that may or may not have been persisted yet. */
export type MergedDoseEvent = DoseEvent & { persisted: boolean }

export function mergeDoseEvents(
  occurrences: ScheduledOccurrence[],
  persisted: DoseEvent[],
): MergedDoseEvent[] {
  const byKey = new Map<string, DoseEvent>()
  for (const event of persisted) {
    byKey.set(keyOf(event.protocolId, event.date, event.slot), event)
  }

  const result: MergedDoseEvent[] = []
  const seenKeys = new Set<string>()

  for (const occ of occurrences) {
    const key = keyOf(occ.protocolId, occ.date, occ.slot)
    seenKeys.add(key)
    const existing = byKey.get(key)
    if (existing) {
      result.push({ ...existing, persisted: true })
    } else {
      result.push({
        id: `virtual-${key}`,
        protocolId: occ.protocolId,
        date: occ.date,
        slot: occ.slot,
        plannedDose: occ.plannedDose,
        plannedUnit: occ.plannedUnit,
        taken: false,
        isOverride: false,
        persisted: false,
      })
    }
  }

  // Persisted rows with no matching generated occurrence (e.g. a manual
  // override on a day a later phase edit removed, or a fully custom entry)
  // still show up — past/overridden days are never silently dropped.
  for (const event of persisted) {
    const key = keyOf(event.protocolId, event.date, event.slot)
    if (!seenKeys.has(key)) {
      result.push({ ...event, persisted: true })
    }
  }

  result.sort((a, b) => (a.date === b.date ? a.slot - b.slot : a.date < b.date ? -1 : 1))
  return result
}

export type MergedSupplementDoseEvent = SupplementDoseEvent & { persisted: boolean }

export function mergeSupplementDoseEvents(
  supplementId: string,
  plannedAmount: number,
  plannedUnit: SupplementDoseEvent['plannedUnit'],
  occurrences: SimpleOccurrence[],
  persisted: SupplementDoseEvent[],
): MergedSupplementDoseEvent[] {
  const byKey = new Map<string, SupplementDoseEvent>()
  for (const event of persisted) byKey.set(`${event.date}|${event.slot}`, event)

  const result: MergedSupplementDoseEvent[] = []
  for (const occ of occurrences) {
    const key = `${occ.date}|${occ.slot}`
    const existing = byKey.get(key)
    if (existing) {
      result.push({ ...existing, persisted: true })
    } else {
      result.push({
        id: `virtual-${supplementId}-${key}`,
        supplementId,
        date: occ.date,
        slot: occ.slot,
        plannedAmount,
        plannedUnit,
        taken: false,
        isOverride: false,
        persisted: false,
      })
    }
  }
  result.sort((a, b) => (a.date === b.date ? a.slot - b.slot : a.date < b.date ? -1 : 1))
  return result
}
