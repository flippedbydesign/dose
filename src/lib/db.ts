import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  Compound,
  DoseEvent,
  Product,
  Protocol,
  Supplement,
  SupplementDoseEvent,
  Vial,
} from './types'

export class DoseDatabase extends Dexie {
  compounds!: EntityTable<Compound, 'id'>
  products!: EntityTable<Product, 'id'>
  vials!: EntityTable<Vial, 'id'>
  protocols!: EntityTable<Protocol, 'id'>
  doseEvents!: EntityTable<DoseEvent, 'id'>
  supplements!: EntityTable<Supplement, 'id'>
  supplementDoseEvents!: EntityTable<SupplementDoseEvent, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor(name = 'dose-db') {
    super(name)
    this.version(1).stores({
      compounds: 'id, name, category, isUserDefined',
      products: 'id, compoundId',
      vials: 'id, productId, status, reconstitutedOn',
      protocols: 'id, productId, status, startDate',
      doseEvents: 'id, protocolId, date, [protocolId+date]',
      supplements: 'id, status',
      supplementDoseEvents: 'id, supplementId, date, [supplementId+date]',
      settings: 'id',
    })
  }
}

export const db = new DoseDatabase()

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  defaultSyringeType: 'U100-1.0',
  deadVolumeMl: 0,
  beyondUseDays: 28,
  featureFlags: { supplements: false },
  disclaimerAcknowledged: false,
  theme: 'system',
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('settings')
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}
