import { useState } from 'react'
import type { DoseEdit } from '../../lib/actions'
import type { MergedDoseEvent } from '../../lib/merge'
import type { InjectionSite, Protocol } from '../../lib/types'
import { NumberField } from '../common/NumberField'

const SITES: { value: InjectionSite; label: string }[] = [
  { value: 'abdomen-L', label: 'Abdomen L' },
  { value: 'abdomen-R', label: 'Abdomen R' },
  { value: 'thigh-L', label: 'Thigh L' },
  { value: 'thigh-R', label: 'Thigh R' },
  { value: 'glute-L', label: 'Glute L' },
  { value: 'glute-R', label: 'Glute R' },
  { value: 'arm-L', label: 'Arm L' },
  { value: 'arm-R', label: 'Arm R' },
  { value: 'other', label: 'Other' },
]

interface DoseEditSheetProps {
  protocol: Protocol
  dose: MergedDoseEvent
  onClose: () => void
  onSave: (edit: DoseEdit) => void
  onSkipToggle: (skipped: boolean) => void
  onCopyPrevious: () => void
  onApplyToRange?: () => void
}

export function DoseEditSheet({ protocol, dose, onClose, onSave, onSkipToggle, onCopyPrevious, onApplyToRange }: DoseEditSheetProps) {
  const [actualDose, setActualDose] = useState(dose.actualDose ?? dose.plannedDose)
  const [site, setSite] = useState<InjectionSite | ''>(dose.site ?? '')
  const [notes, setNotes] = useState(dose.notes ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <div className="safe-bottom max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: protocol.color }} />
              <h2 className="text-base font-semibold">{protocol.name}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{dose.date}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] text-slate-400">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <NumberField
            label={`Actual dose (${dose.plannedUnit})`}
            value={actualDose}
            onChange={setActualDose}
            step={dose.plannedUnit === 'mg' ? 0.5 : 50}
            min={0}
          />

          <button
            type="button"
            onClick={onCopyPrevious}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:active:bg-slate-800"
          >
            Copy from previous dose
          </button>

          {onApplyToRange && (
            <button
              type="button"
              onClick={onApplyToRange}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:active:bg-slate-800"
            >
              Apply to…
            </button>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Injection site</label>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value as InjectionSite)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Not tracked</option>
              {SITES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={() => onSkipToggle(!dose.skipped)}
            className="min-h-[44px] w-full rounded-lg border border-amber-300 text-sm font-medium text-amber-700 active:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:active:bg-amber-950"
          >
            {dose.skipped ? 'Unmark as skipped' : 'Mark as skipped'}
          </button>

          <button
            type="button"
            onClick={() => {
              onSave({ actualDose, site: site || undefined, notes: notes || undefined })
              onClose()
            }}
            className="min-h-[44px] w-full rounded-lg bg-indigo-600 text-sm font-medium text-white active:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
