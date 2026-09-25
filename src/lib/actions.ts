// Mutation helpers shared across screens. Each function owns one user-facing
// action (check off a dose, apply a dose to a date range, reconstitute a vial,
// ...) so screens stay thin and these can be unit tested without React.
import { db } from './db'
import { addDays, dayOfWeek, diffDays, isSameOrBefore, todayStr, type DateStr } from './dates'
import type { DoseEvent, DoseUnit, InjectionSite, Protocol, Vial } from './types'

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

async function findEvent(protocolId: string, date: DateStr, slot: number): Promise<DoseEvent | undefined> {
  return db.doseEvents.where('[protocolId+date]').equals([protocolId, date]).and((e) => e.slot === slot).first()
}

/** Persist (or update) a dose event, defaulting actualDose to plannedDose when marking taken. */
export async function setDoseTaken(
  protocolId: string,
  date: DateStr,
  slot: number,
  planned: { plannedDose: number; plannedUnit: DoseUnit },
  taken: boolean,
): Promise<void> {
  const existing = await findEvent(protocolId, date, slot)
  const base: DoseEvent = existing ?? {
    id: newId('de'),
    protocolId,
    date,
    slot,
    plannedDose: planned.plannedDose,
    plannedUnit: planned.plannedUnit,
    taken: false,
    isOverride: false,
  }
  await db.doseEvents.put({
    ...base,
    taken,
    takenAt: taken ? new Date().toISOString() : undefined,
    skipped: taken ? false : base.skipped,
    actualDose: base.actualDose ?? (taken ? planned.plannedDose : base.actualDose),
  })
}

export async function setDoseSkipped(
  protocolId: string,
  date: DateStr,
  slot: number,
  planned: { plannedDose: number; plannedUnit: DoseUnit },
  skipped: boolean,
): Promise<void> {
  const existing = await findEvent(protocolId, date, slot)
  const base: DoseEvent = existing ?? {
    id: newId('de'),
    protocolId,
    date,
    slot,
    plannedDose: planned.plannedDose,
    plannedUnit: planned.plannedUnit,
    taken: false,
    isOverride: false,
  }
  await db.doseEvents.put({ ...base, skipped, taken: skipped ? false : base.taken })
}

export interface DoseEdit {
  actualDose?: number
  takenAt?: string
  site?: InjectionSite
  notes?: string
  vialId?: string
}

/** Full edit of a single day's dose — always marks it as an override. */
export async function editDoseEvent(
  protocolId: string,
  date: DateStr,
  slot: number,
  planned: { plannedDose: number; plannedUnit: DoseUnit },
  edit: DoseEdit,
): Promise<void> {
  const existing = await findEvent(protocolId, date, slot)
  const base: DoseEvent = existing ?? {
    id: newId('de'),
    protocolId,
    date,
    slot,
    plannedDose: planned.plannedDose,
    plannedUnit: planned.plannedUnit,
    taken: false,
    isOverride: false,
  }
  await db.doseEvents.put({ ...base, ...edit, isOverride: true })
}

/** "Copy from previous dose": find the most recent logged/planned dose for a protocol before `date`. */
export async function findPreviousDose(protocolId: string, beforeDate: DateStr): Promise<DoseEvent | undefined> {
  const events = await db.doseEvents.where('protocolId').equals(protocolId).and((e) => e.date < beforeDate).toArray()
  events.sort((a, b) => (a.date < b.date ? 1 : -1))
  return events[0]
}

export interface ApplyToRangeParams {
  protocolId: string
  startDate: DateStr
  endDate: DateStr
  slot: number
  dose: number
  unit: DoseUnit
  weekdays?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[] // optional filter
}

/** Apply a dose to every date in a range (optionally filtered by weekday), as overrides. Returns dates touched. */
export async function applyDoseToRange(params: ApplyToRangeParams): Promise<DateStr[]> {
  const { protocolId, startDate, endDate, slot, dose, unit, weekdays } = params
  const touched: DateStr[] = []
  let cursor = startDate
  const puts: DoseEvent[] = []
  while (isSameOrBefore(cursor, endDate)) {
    const dow = dayOfWeek(cursor)
    if (!weekdays || weekdays.includes(dow)) {
      const existing = await findEvent(protocolId, cursor, slot)
      const base: DoseEvent = existing ?? {
        id: newId('de'),
        protocolId,
        date: cursor,
        slot,
        plannedDose: dose,
        plannedUnit: unit,
        taken: false,
        isOverride: false,
      }
      puts.push({ ...base, plannedDose: dose, plannedUnit: unit, isOverride: true })
      touched.push(cursor)
    }
    cursor = addDays(cursor, 1)
  }
  await db.doseEvents.bulkPut(puts)
  return touched
}

/** Bulk check-off: mark every dose in a list of (date, slot, planned) as taken. */
export async function bulkCheckOff(
  protocolId: string,
  items: { date: DateStr; slot: number; plannedDose: number; plannedUnit: DoseUnit }[],
): Promise<void> {
  const puts: DoseEvent[] = []
  for (const item of items) {
    const existing = await findEvent(protocolId, item.date, item.slot)
    const base: DoseEvent = existing ?? {
      id: newId('de'),
      protocolId,
      date: item.date,
      slot: item.slot,
      plannedDose: item.plannedDose,
      plannedUnit: item.plannedUnit,
      taken: false,
      isOverride: false,
    }
    puts.push({ ...base, taken: true, takenAt: new Date().toISOString(), actualDose: base.actualDose ?? item.plannedDose })
  }
  await db.doseEvents.bulkPut(puts)
}

/** Undo support: snapshot + restore for the last bulk mutation (single-level undo). */
export interface UndoSnapshot {
  keys: { protocolId: string; date: DateStr; slot: number }[]
  previous: (DoseEvent | undefined)[]
}

export async function snapshotFor(keys: { protocolId: string; date: DateStr; slot: number }[]): Promise<UndoSnapshot> {
  const previous = await Promise.all(keys.map((k) => findEvent(k.protocolId, k.date, k.slot)))
  return { keys, previous }
}

export async function restoreSnapshot(snapshot: UndoSnapshot): Promise<void> {
  for (let i = 0; i < snapshot.keys.length; i++) {
    const prior = snapshot.previous[i]
    if (prior) {
      await db.doseEvents.put(prior)
    } else {
      const k = snapshot.keys[i]
      const existing = await findEvent(k.protocolId, k.date, k.slot)
      if (existing) await db.doseEvents.delete(existing.id)
    }
  }
}

// ---- Protocol actions ----

export async function pauseProtocol(id: string): Promise<void> {
  await db.protocols.update(id, { status: 'paused', pausedAt: todayStr() })
}

export async function resumeProtocol(id: string): Promise<void> {
  const protocol = await db.protocols.get(id)
  if (!protocol || !protocol.pausedAt) return
  // Shift future phase weeks forward by the paused duration so the schedule
  // continues where it left off rather than skipping ahead.
  const pausedDays = Math.max(0, diffDays(todayStr(), protocol.pausedAt))
  const shiftedWeeks = Math.round(pausedDays / 7)
  const shiftedStart = shiftedWeeks > 0 ? addDays(protocol.startDate, shiftedWeeks * 7) : protocol.startDate
  await db.protocols.update(id, { status: 'active', pausedAt: undefined, startDate: shiftedStart })
}

export async function duplicateProtocol(id: string, newStartDate: DateStr): Promise<string> {
  const protocol = await db.protocols.get(id)
  if (!protocol) throw new Error('Protocol not found')
  const newId_ = newId('pr')
  const copy: Protocol = {
    ...protocol,
    id: newId_,
    name: `${protocol.name} (copy)`,
    startDate: newStartDate,
    status: 'active',
    pausedAt: undefined,
    phases: protocol.phases.map((p) => ({ ...p, id: newId('ph') })),
  }
  await db.protocols.add(copy)
  return newId_
}

export async function endProtocolEarly(id: string, endDate: DateStr = todayStr()): Promise<void> {
  await db.protocols.update(id, { status: 'completed', endDate })
}

export async function deleteProtocol(id: string): Promise<void> {
  await db.transaction('rw', [db.protocols, db.doseEvents], async () => {
    await db.doseEvents.where('protocolId').equals(id).delete()
    await db.protocols.delete(id)
  })
}

// ---- Vial / inventory actions ----

export async function addVialsBulk(productId: string, count: number, lot?: string): Promise<void> {
  const now = todayStr()
  const vials: Vial[] = Array.from({ length: count }, () => ({
    id: newId('vial'),
    productId,
    status: 'unopened',
    lot,
    createdAt: now,
  }))
  await db.vials.bulkAdd(vials)
}

export async function reconstituteVial(vialId: string, bacWaterMl: number, beyondUseDays: number, date: DateStr = todayStr()): Promise<void> {
  await db.vials.update(vialId, {
    status: 'reconstituted',
    bacWaterMl,
    reconstitutedOn: date,
    beyondUseDate: addDays(date, beyondUseDays),
    remainingMl: bacWaterMl,
  })
}

export async function correctRemainingMl(vialId: string, remainingMl: number): Promise<void> {
  await db.vials.update(vialId, { remainingMl })
}

export async function decrementActiveVial(vialId: string, byMl: number): Promise<void> {
  const vial = await db.vials.get(vialId)
  if (!vial) return
  const remaining = Math.max(0, (vial.remainingMl ?? 0) - byMl)
  await db.vials.update(vialId, { remainingMl: remaining, status: remaining <= 0 ? 'empty' : vial.status })
}

/** Adjust a vial's remaining volume by a signed delta (negative = consume, positive = give back). */
export async function adjustVialRemainingMl(vialId: string, deltaMl: number): Promise<void> {
  const vial = await db.vials.get(vialId)
  if (!vial) return
  const remaining = Math.max(0, (vial.remainingMl ?? 0) + deltaMl)
  const status = remaining <= 0 ? 'empty' : vial.status === 'empty' ? 'reconstituted' : vial.status
  await db.vials.update(vialId, { remainingMl: remaining, status })
}
