import { beforeEach, describe, expect, it } from 'vitest'
import { db, DEFAULT_SETTINGS } from './db'
import {
  doseLogToCsv,
  exportAllData,
  importData,
  parseImportFile,
  previewImport,
} from './exportImport'
import { seedIfEmpty } from './seed'
import type { Compound, DoseEvent, Protocol } from './types'

beforeEach(async () => {
  await db.transaction(
    'rw',
    [db.compounds, db.products, db.vials, db.protocols, db.doseEvents, db.supplements, db.supplementDoseEvents, db.settings],
    async () => {
      await Promise.all([
        db.compounds.clear(),
        db.products.clear(),
        db.vials.clear(),
        db.protocols.clear(),
        db.doseEvents.clear(),
        db.supplements.clear(),
        db.supplementDoseEvents.clear(),
        db.settings.clear(),
      ])
    },
  )
})

const sampleCompound: Compound = {
  id: 'c1',
  name: 'BPC-157',
  category: 'Healing / recovery',
  kind: 'single',
  commonVialSizesMg: [5, 10],
  isUserDefined: false,
}

const sampleProtocol: Protocol = {
  id: 'pr1',
  name: 'Test protocol',
  productId: 'prod1',
  startDate: '2026-01-01',
  status: 'active',
  doseBasis: 'total',
  phases: [{ id: 'ph1', startWeek: 1, endWeek: 4, dose: 250, doseUnit: 'mcg', frequency: { type: 'daily', timesPerDay: 1 } }],
  color: '#4f46e5',
}

const sampleDoseEvent: DoseEvent = {
  id: 'de1',
  protocolId: 'pr1',
  date: '2026-01-01',
  slot: 0,
  plannedDose: 250,
  plannedUnit: 'mcg',
  taken: true,
  isOverride: false,
}

describe('seedIfEmpty', () => {
  it('seeds the compound library into an empty db', async () => {
    await seedIfEmpty(db)
    const count = await db.compounds.count()
    expect(count).toBeGreaterThan(50)
  })

  it('does not duplicate on a second call', async () => {
    await seedIfEmpty(db)
    const first = await db.compounds.count()
    await seedIfEmpty(db)
    const second = await db.compounds.count()
    expect(second).toBe(first)
  })
})

describe('export -> wipe -> import round trip', () => {
  it('restores all data exactly', async () => {
    await db.compounds.put(sampleCompound)
    await db.protocols.put(sampleProtocol)
    await db.doseEvents.put(sampleDoseEvent)
    await db.settings.put({ ...DEFAULT_SETTINGS, deadVolumeMl: 0.02 })

    const bundle = await exportAllData()
    expect(bundle.compounds).toHaveLength(1)
    expect(bundle.protocols).toHaveLength(1)
    expect(bundle.doseEvents).toHaveLength(1)
    expect(bundle.settings.deadVolumeMl).toBe(0.02)

    // wipe
    await Promise.all([db.compounds.clear(), db.protocols.clear(), db.doseEvents.clear(), db.settings.clear()])
    expect(await db.compounds.count()).toBe(0)

    await importData(bundle, 'replace')

    expect(await db.compounds.toArray()).toEqual([sampleCompound])
    expect(await db.protocols.toArray()).toEqual([sampleProtocol])
    expect(await db.doseEvents.toArray()).toEqual([sampleDoseEvent])
    const settings = await db.settings.get('settings')
    expect(settings?.deadVolumeMl).toBe(0.02)
  })

  it('merge mode upserts without clearing existing rows', async () => {
    await db.compounds.put(sampleCompound)
    const other: Compound = { ...sampleCompound, id: 'c2', name: 'TB-500' }
    const bundle = await exportAllData()
    bundle.compounds = [other]

    await importData(bundle, 'merge')

    const all = await db.compounds.toArray()
    expect(all.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })
})

describe('parseImportFile / previewImport', () => {
  it('parses a valid export and reports counts', () => {
    const bundle = {
      formatVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      compounds: [sampleCompound],
      products: [],
      vials: [],
      protocols: [sampleProtocol],
      doseEvents: [sampleDoseEvent],
      supplements: [],
      supplementDoseEvents: [],
      settings: DEFAULT_SETTINGS,
    }
    const parsed = parseImportFile(JSON.stringify(bundle))
    const preview = previewImport(parsed)
    expect(preview.counts.compounds).toBe(1)
    expect(preview.counts.protocols).toBe(1)
    expect(preview.compatible).toBe(true)
  })

  it('rejects a file that is not a Dose export', () => {
    expect(() => parseImportFile(JSON.stringify({ hello: 'world' }))).toThrow()
  })

  it('flags a newer format version as incompatible', () => {
    const bundle = {
      formatVersion: 999,
      exportedAt: '',
      compounds: [],
      products: [],
      vials: [],
      protocols: [],
      doseEvents: [],
    }
    const parsed = parseImportFile(JSON.stringify(bundle))
    expect(previewImport(parsed).compatible).toBe(false)
  })
})

describe('doseLogToCsv', () => {
  it('produces a header plus one row per event', () => {
    const protocolsById = new Map([[sampleProtocol.id, sampleProtocol]])
    const unitsPerEvent = new Map([[sampleDoseEvent.id, 10]])
    const csv = doseLogToCsv([sampleDoseEvent], protocolsById, unitsPerEvent)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('date,protocol,dose,unit,units_drawn,taken,site,notes')
    expect(lines[1]).toBe('2026-01-01,Test protocol,250,mcg,10,taken,,')
  })

  it('escapes commas and quotes in notes', () => {
    const event: DoseEvent = { ...sampleDoseEvent, notes: 'felt "great", no issues' }
    const csv = doseLogToCsv([event], new Map(), new Map())
    expect(csv).toContain('"felt ""great"", no issues"')
  })
})
