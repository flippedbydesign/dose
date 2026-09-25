import { beforeEach, describe, expect, it } from 'vitest'
import {
  addVialsBulk,
  adjustVialRemainingMl,
  applyDoseToRange,
  bulkCheckOff,
  decrementActiveVial,
  deleteProtocol,
  editDoseEvent,
  pauseProtocol,
  reconstituteVial,
  restoreSnapshot,
  resumeProtocol,
  setDoseSkipped,
  setDoseTaken,
  snapshotFor,
} from './actions'
import { db } from './db'
import type { Protocol } from './types'

beforeEach(async () => {
  await db.transaction('rw', [db.protocols, db.doseEvents, db.vials], async () => {
    await Promise.all([db.protocols.clear(), db.doseEvents.clear(), db.vials.clear()])
  })
})

const protocol: Protocol = {
  id: 'pr1',
  name: 'Test',
  productId: 'prod1',
  startDate: '2026-01-01',
  status: 'active',
  doseBasis: 'total',
  phases: [{ id: 'ph1', startWeek: 1, endWeek: 52, dose: 250, doseUnit: 'mcg', frequency: { type: 'daily', timesPerDay: 1 } }],
  color: '#000',
}

describe('setDoseTaken', () => {
  it('creates a new persisted row defaulting actualDose to planned', async () => {
    await setDoseTaken('pr1', '2026-01-01', 0, { plannedDose: 250, plannedUnit: 'mcg' }, true)
    const rows = await db.doseEvents.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ taken: true, actualDose: 250 })
    expect(rows[0].takenAt).toBeDefined()
  })

  it('un-checking clears takenAt', async () => {
    await setDoseTaken('pr1', '2026-01-01', 0, { plannedDose: 250, plannedUnit: 'mcg' }, true)
    await setDoseTaken('pr1', '2026-01-01', 0, { plannedDose: 250, plannedUnit: 'mcg' }, false)
    const rows = await db.doseEvents.toArray()
    expect(rows[0].taken).toBe(false)
    expect(rows[0].takenAt).toBeUndefined()
  })
})

describe('setDoseSkipped', () => {
  it('marks skipped and clears taken', async () => {
    await setDoseTaken('pr1', '2026-01-01', 0, { plannedDose: 250, plannedUnit: 'mcg' }, true)
    await setDoseSkipped('pr1', '2026-01-01', 0, { plannedDose: 250, plannedUnit: 'mcg' }, true)
    const rows = await db.doseEvents.toArray()
    expect(rows[0].skipped).toBe(true)
    expect(rows[0].taken).toBe(false)
  })
})

describe('editDoseEvent', () => {
  it('always marks the row as an override', async () => {
    await editDoseEvent('pr1', '2026-01-02', 0, { plannedDose: 250, plannedUnit: 'mcg' }, { actualDose: 300, notes: 'felt fine' })
    const rows = await db.doseEvents.toArray()
    expect(rows[0]).toMatchObject({ actualDose: 300, notes: 'felt fine', isOverride: true })
  })
})

describe('applyDoseToRange', () => {
  it('creates override rows for every date in range', async () => {
    const touched = await applyDoseToRange({
      protocolId: 'pr1',
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      slot: 0,
      dose: 500,
      unit: 'mcg',
    })
    expect(touched).toHaveLength(5)
    const rows = await db.doseEvents.toArray()
    expect(rows).toHaveLength(5)
    expect(rows.every((r) => r.plannedDose === 500 && r.isOverride)).toBe(true)
  })

  it('filters by weekday when provided', async () => {
    // 2026-01-05 is Monday; restrict to Mon(1)/Wed(3)/Fri(5)
    const touched = await applyDoseToRange({
      protocolId: 'pr1',
      startDate: '2026-01-05',
      endDate: '2026-01-11',
      slot: 0,
      dose: 100,
      unit: 'mcg',
      weekdays: [1, 3, 5],
    })
    expect(touched).toEqual(['2026-01-05', '2026-01-07', '2026-01-09'])
  })
})

describe('bulkCheckOff + undo', () => {
  it('marks a batch taken and undo restores prior state', async () => {
    const items = [
      { date: '2026-01-01', slot: 0, plannedDose: 250, plannedUnit: 'mcg' as const },
      { date: '2026-01-02', slot: 0, plannedDose: 250, plannedUnit: 'mcg' as const },
    ]
    const snapshot = await snapshotFor(items.map((i) => ({ protocolId: 'pr1', date: i.date, slot: i.slot })))
    await bulkCheckOff('pr1', items)
    let rows = await db.doseEvents.toArray()
    expect(rows.every((r) => r.taken)).toBe(true)

    await restoreSnapshot(snapshot)
    rows = await db.doseEvents.toArray()
    expect(rows).toHaveLength(0) // both were newly created, so undo deletes them
  })

  it('undo restores the prior value rather than deleting when a row already existed', async () => {
    await setDoseTaken('pr1', '2026-01-01', 0, { plannedDose: 250, plannedUnit: 'mcg' }, false)
    const snapshot = await snapshotFor([{ protocolId: 'pr1', date: '2026-01-01', slot: 0 }])
    await bulkCheckOff('pr1', [{ date: '2026-01-01', slot: 0, plannedDose: 250, plannedUnit: 'mcg' }])
    expect((await db.doseEvents.toArray())[0].taken).toBe(true)

    await restoreSnapshot(snapshot)
    const rows = await db.doseEvents.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].taken).toBe(false)
  })
})

describe('protocol lifecycle actions', () => {
  it('pause sets status and pausedAt', async () => {
    await db.protocols.put(protocol)
    await pauseProtocol('pr1')
    const p = await db.protocols.get('pr1')
    expect(p?.status).toBe('paused')
    expect(p?.pausedAt).toBeDefined()
  })

  it('resume clears pausedAt and shifts startDate forward by whole weeks paused', async () => {
    await db.protocols.put({ ...protocol, status: 'paused', pausedAt: '2026-01-01' })
    await resumeProtocol('pr1')
    const p = await db.protocols.get('pr1')
    expect(p?.status).toBe('active')
    expect(p?.pausedAt).toBeUndefined()
  })

  it('deleteProtocol removes the protocol and its dose events', async () => {
    await db.protocols.put(protocol)
    await setDoseTaken('pr1', '2026-01-01', 0, { plannedDose: 250, plannedUnit: 'mcg' }, true)
    await deleteProtocol('pr1')
    expect(await db.protocols.get('pr1')).toBeUndefined()
    expect(await db.doseEvents.where('protocolId').equals('pr1').count()).toBe(0)
  })
})

describe('vial inventory actions', () => {
  it('addVialsBulk creates N unopened vials', async () => {
    await addVialsBulk('prod1', 4, 'LOT123')
    const vials = await db.vials.where('productId').equals('prod1').toArray()
    expect(vials).toHaveLength(4)
    expect(vials.every((v) => v.status === 'unopened' && v.lot === 'LOT123')).toBe(true)
  })

  it('reconstituteVial sets bac water, dates, and remainingMl', async () => {
    await addVialsBulk('prod1', 1)
    const [vial] = await db.vials.toArray()
    await reconstituteVial(vial.id, 3.0, 28, '2026-01-05')
    const updated = await db.vials.get(vial.id)
    expect(updated?.status).toBe('reconstituted')
    expect(updated?.remainingMl).toBe(3.0)
    expect(updated?.beyondUseDate).toBe('2026-02-02')
  })

  it('decrementActiveVial reduces remainingMl and marks empty at zero', async () => {
    await addVialsBulk('prod1', 1)
    const [vial] = await db.vials.toArray()
    await reconstituteVial(vial.id, 1.0, 28)
    await decrementActiveVial(vial.id, 0.4)
    expect((await db.vials.get(vial.id))?.remainingMl).toBeCloseTo(0.6, 6)
    await decrementActiveVial(vial.id, 1.0)
    const final = await db.vials.get(vial.id)
    expect(final?.remainingMl).toBe(0)
    expect(final?.status).toBe('empty')
  })

  it('adjustVialRemainingMl supports negative (consume) and positive (undo) deltas', async () => {
    await addVialsBulk('prod1', 1)
    const [vial] = await db.vials.toArray()
    await reconstituteVial(vial.id, 1.0, 28)
    await adjustVialRemainingMl(vial.id, -1.0)
    expect((await db.vials.get(vial.id))?.status).toBe('empty')
    await adjustVialRemainingMl(vial.id, 0.3)
    const revived = await db.vials.get(vial.id)
    expect(revived?.remainingMl).toBeCloseTo(0.3, 6)
    expect(revived?.status).toBe('reconstituted')
  })
})
