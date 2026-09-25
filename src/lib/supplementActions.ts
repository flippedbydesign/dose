import { db } from './db'
import type { DateStr } from './dates'
import type { SupplementDoseEvent, SupplementUnit } from './types'

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

async function findEvent(supplementId: string, date: DateStr, slot: number): Promise<SupplementDoseEvent | undefined> {
  return db.supplementDoseEvents
    .where('[supplementId+date]')
    .equals([supplementId, date])
    .and((e) => e.slot === slot)
    .first()
}

export async function setSupplementTaken(
  supplementId: string,
  date: DateStr,
  slot: number,
  planned: { plannedAmount: number; plannedUnit: SupplementUnit },
  taken: boolean,
): Promise<void> {
  const existing = await findEvent(supplementId, date, slot)
  const base: SupplementDoseEvent = existing ?? {
    id: newId('sde'),
    supplementId,
    date,
    slot,
    plannedAmount: planned.plannedAmount,
    plannedUnit: planned.plannedUnit,
    taken: false,
    isOverride: false,
  }
  await db.supplementDoseEvents.put({
    ...base,
    taken,
    takenAt: taken ? new Date().toISOString() : undefined,
    actualAmount: base.actualAmount ?? (taken ? planned.plannedAmount : base.actualAmount),
  })

  if (taken) {
    const supplement = await db.supplements.get(supplementId)
    if (supplement) {
      await db.supplements.update(supplementId, { stockCount: Math.max(0, supplement.stockCount - planned.plannedAmount) })
    }
  }
}

export async function deleteSupplement(id: string): Promise<void> {
  await db.transaction('rw', [db.supplements, db.supplementDoseEvents], async () => {
    await db.supplementDoseEvents.where('supplementId').equals(id).delete()
    await db.supplements.delete(id)
  })
}
