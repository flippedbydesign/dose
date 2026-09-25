import { useRef, useState } from 'react'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { NumberField } from '../components/common/NumberField'
import { TopBar } from '../components/layout/TopBar'
import { updateSettings, useSettings } from '../hooks/useSettings'
import {
  downloadJson,
  exportAllData,
  importData,
  parseImportFile,
  previewImport,
  type DoseExportBundle,
  type ImportPreview,
} from '../lib/exportImport'
import type { SyringeType } from '../lib/types'

const SYRINGES: { value: SyringeType; label: string }[] = [
  { value: 'U100-1.0', label: 'U-100 1 mL (100 units)' },
  { value: 'U100-0.5', label: 'U-100 0.5 mL (50 units)' },
  { value: 'U100-0.3', label: 'U-100 0.3 mL (30 units)' },
]

export function SettingsScreen() {
  const settings = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{ bundle: DoseExportBundle; preview: ImportPreview } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [resetDisclaimerConfirm, setResetDisclaimerConfirm] = useState(false)

  async function handleExport() {
    const bundle = await exportAllData()
    downloadJson(bundle)
  }

  async function handleFileSelected(file: File) {
    setImportError(null)
    try {
      const text = await file.text()
      const bundle = parseImportFile(text)
      setPendingImport({ bundle, preview: previewImport(bundle) })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read this file.')
    }
  }

  return (
    <div>
      <TopBar title="Settings" />
      <div className="space-y-6 px-4 py-4 pb-10">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Defaults</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Default syringe type</label>
              <select
                value={settings.defaultSyringeType}
                onChange={(e) => updateSettings({ defaultSyringeType: e.target.value as SyringeType })}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              >
                {SYRINGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              label="Dead volume per dose"
              value={settings.deadVolumeMl}
              onChange={(v) => updateSettings({ deadVolumeMl: v })}
              step={0.01}
              min={0}
              unit="mL"
            />
            <NumberField
              label="Beyond-use days for reconstituted vials"
              value={settings.beyondUseDays}
              onChange={(v) => updateSettings({ beyondUseDays: v })}
              step={1}
              min={1}
              unit="days"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Feature flags</h2>
          <label className="flex min-h-[44px] items-center justify-between rounded-lg border border-slate-200 px-3 dark:border-slate-800">
            <span className="text-sm">Supplements tab</span>
            <input
              type="checkbox"
              checked={settings.featureFlags.supplements}
              onChange={(e) => updateSettings({ featureFlags: { ...settings.featureFlags, supplements: e.target.checked } })}
              className="h-6 w-6"
            />
          </label>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Data</h2>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleExport}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
            >
              Export all data (JSON)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
            >
              Import from file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
            />
            {importError && <p className="text-xs text-red-600 dark:text-red-400">{importError}</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">About</h2>
          <button
            type="button"
            onClick={() => setResetDisclaimerConfirm(true)}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
          >
            Show disclaimer again
          </button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Dose is a personal tracker and calculator. It does not recommend doses — every dose, phase, and schedule is
            whatever you enter. All data is stored locally on this device only.
          </p>
        </section>
      </div>

      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
          <div className="safe-bottom w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900">
            <h2 className="text-base font-semibold">Import preview</h2>
            {!pendingImport.preview.compatible && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                This file was exported from a newer version of Dose and may not import correctly.
              </p>
            )}
            <ul className="mt-3 space-y-1 text-sm">
              <li>{pendingImport.preview.counts.compounds} compounds</li>
              <li>{pendingImport.preview.counts.protocols} protocols</li>
              <li>{pendingImport.preview.counts.vials} vials</li>
              <li>{pendingImport.preview.counts.doseEvents} dose log entries</li>
              <li>{pendingImport.preview.counts.supplements} supplements</li>
            </ul>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={async () => {
                  await importData(pendingImport.bundle, 'merge')
                  setPendingImport(null)
                }}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
              >
                Merge into existing data
              </button>
              <button
                type="button"
                onClick={async () => {
                  await importData(pendingImport.bundle, 'replace')
                  setPendingImport(null)
                }}
                className="min-h-[44px] w-full rounded-lg bg-red-600 text-sm font-medium text-white active:bg-red-700"
              >
                Replace all data
              </button>
              <button type="button" onClick={() => setPendingImport(null)} className="min-h-[44px] w-full rounded-lg text-sm text-slate-500">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={resetDisclaimerConfirm}
        title="Show the first-launch disclaimer again?"
        onCancel={() => setResetDisclaimerConfirm(false)}
        onConfirm={() => {
          updateSettings({ disclaimerAcknowledged: false })
          setResetDisclaimerConfirm(false)
        }}
      />
    </div>
  )
}
