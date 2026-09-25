import { useState } from 'react'
import { NumberField } from '../common/NumberField'
import { todayStr } from '../../lib/dates'

interface ReconstituteSheetProps {
  defaultBacMl: number
  onClose: () => void
  onConfirm: (bacMl: number, date: string) => void
}

export function ReconstituteSheet({ defaultBacMl, onClose, onConfirm }: ReconstituteSheetProps) {
  const [bacMl, setBacMl] = useState(defaultBacMl)
  const [date, setDate] = useState(todayStr())

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <div className="safe-bottom w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900">
        <h2 className="text-base font-semibold">Reconstitute vial</h2>
        <div className="mt-3 space-y-3">
          <NumberField label="BAC water" value={bacMl} onChange={setBacMl} step={0.1} min={0.1} unit="mL" />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-[44px] flex-1 rounded-lg border border-slate-300 text-sm dark:border-slate-700">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(bacMl, date)}
              className="min-h-[44px] flex-1 rounded-lg bg-indigo-600 text-sm font-medium text-white active:bg-indigo-700"
            >
              Reconstitute
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
