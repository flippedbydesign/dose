import { db, DEFAULT_SETTINGS } from './db'
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

export const EXPORT_FORMAT_VERSION = 1

export interface DoseExportBundle {
  formatVersion: number
  exportedAt: string // ISO timestamp
  compounds: Compound[]
  products: Product[]
  vials: Vial[]
  protocols: Protocol[]
  doseEvents: DoseEvent[]
  supplements: Supplement[]
  supplementDoseEvents: SupplementDoseEvent[]
  settings: AppSettings
}

export async function exportAllData(): Promise<DoseExportBundle> {
  const [compounds, products, vials, protocols, doseEvents, supplements, supplementDoseEvents, settings] =
    await Promise.all([
      db.compounds.toArray(),
      db.products.toArray(),
      db.vials.toArray(),
      db.protocols.toArray(),
      db.doseEvents.toArray(),
      db.supplements.toArray(),
      db.supplementDoseEvents.toArray(),
      db.settings.get('settings'),
    ])

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    compounds,
    products,
    vials,
    protocols,
    doseEvents,
    supplements,
    supplementDoseEvents,
    settings: settings ?? DEFAULT_SETTINGS,
  }
}

export interface ImportPreview {
  counts: Record<
    'compounds' | 'products' | 'vials' | 'protocols' | 'doseEvents' | 'supplements' | 'supplementDoseEvents',
    number
  >
  exportedAt: string
  formatVersion: number
  compatible: boolean
}

export function parseImportFile(json: string): DoseExportBundle {
  const data = JSON.parse(json) as Partial<DoseExportBundle>
  if (
    !data ||
    typeof data.formatVersion !== 'number' ||
    !Array.isArray(data.compounds) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.vials) ||
    !Array.isArray(data.protocols) ||
    !Array.isArray(data.doseEvents)
  ) {
    throw new Error('This file does not look like a Dose export.')
  }
  return {
    formatVersion: data.formatVersion,
    exportedAt: data.exportedAt ?? '',
    compounds: data.compounds,
    products: data.products,
    vials: data.vials,
    protocols: data.protocols,
    doseEvents: data.doseEvents,
    supplements: data.supplements ?? [],
    supplementDoseEvents: data.supplementDoseEvents ?? [],
    settings: data.settings ?? DEFAULT_SETTINGS,
  }
}

export function previewImport(bundle: DoseExportBundle): ImportPreview {
  return {
    counts: {
      compounds: bundle.compounds.length,
      products: bundle.products.length,
      vials: bundle.vials.length,
      protocols: bundle.protocols.length,
      doseEvents: bundle.doseEvents.length,
      supplements: bundle.supplements.length,
      supplementDoseEvents: bundle.supplementDoseEvents.length,
    },
    exportedAt: bundle.exportedAt,
    formatVersion: bundle.formatVersion,
    compatible: bundle.formatVersion <= EXPORT_FORMAT_VERSION,
  }
}

export type ImportMode = 'replace' | 'merge'

/**
 * Import a bundle. 'replace' wipes every table first (a true restore).
 * 'merge' upserts by id, leaving any existing rows not present in the bundle untouched.
 */
export async function importData(bundle: DoseExportBundle, mode: ImportMode): Promise<void> {
  await db.transaction(
    'rw',
    [db.compounds, db.products, db.vials, db.protocols, db.doseEvents, db.supplements, db.supplementDoseEvents, db.settings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.compounds.clear(),
          db.products.clear(),
          db.vials.clear(),
          db.protocols.clear(),
          db.doseEvents.clear(),
          db.supplements.clear(),
          db.supplementDoseEvents.clear(),
        ])
      }
      await Promise.all([
        db.compounds.bulkPut(bundle.compounds),
        db.products.bulkPut(bundle.products),
        db.vials.bulkPut(bundle.vials),
        db.protocols.bulkPut(bundle.protocols),
        db.doseEvents.bulkPut(bundle.doseEvents),
        db.supplements.bulkPut(bundle.supplements),
        db.supplementDoseEvents.bulkPut(bundle.supplementDoseEvents),
      ])
      await db.settings.put(bundle.settings)
    },
  )
}

export function downloadJson(bundle: DoseExportBundle, filename = `dose-backup-${bundle.exportedAt.slice(0, 10)}.json`) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ---- CSV export of the dose log (scope doc §5.9) ----

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function doseLogToCsv(
  doseEvents: DoseEvent[],
  protocolsById: Map<string, Protocol>,
  unitsPerEvent: Map<string, number>,
): string {
  const header = ['date', 'protocol', 'dose', 'unit', 'units_drawn', 'taken', 'site', 'notes']
  const rows = doseEvents.map((e) => {
    const protocol = protocolsById.get(e.protocolId)
    const dose = e.actualDose ?? e.plannedDose
    return [
      e.date,
      protocol?.name ?? e.protocolId,
      String(dose),
      e.plannedUnit,
      String(unitsPerEvent.get(e.id) ?? ''),
      e.skipped ? 'skipped' : e.taken ? 'taken' : 'pending',
      e.site ?? '',
      e.notes ?? '',
    ]
      .map(csvEscape)
      .join(',')
  })
  return [header.join(','), ...rows].join('\n')
}
