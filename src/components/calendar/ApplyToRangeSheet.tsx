import { useMemo, useState } from 'react'
import { diffDays } from '../../lib/dates'
import type { DoseUnit } from '../../lib/types'

const WEEKDAYS: { value: 0 | 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

interface ApplyToRangeSheetProps {
  initialDose: number
  unit: DoseUnit
  startDate: string
  onClose: () => void
  onApply: (params: { startDate: string; endDate: string; dose: number; weekdays?: number[] }) => void
}

export function ApplyToRangeSheet({ initialDose, unit, startDate, onClose, onApply }: ApplyToRangeSheetProps) {
  const [start, setStart] = useState(startDate)
  const [end, setEnd] = useState(startDate)
  const [dose, setDose] = useState(initialDose)
  const [allWeekdays, setAllWeekdays] = useState(true)
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]))

  const dayCount = useMemo(() => Math.max(0, diffDays(end, start) + 1), [start, end])

  function toggleDay(d: number) {
    const next = new Set(days)
    next.has(d) ? next.delete(d) : next.add(d)
    setDays(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <div className="safe-bottom w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Apply to range</h2>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] text-slate-400">
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Start</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">End</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dose ({unit})</label>
            <input
              type="number"
              inputMode="decimal"
              value={dose}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDose(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-right dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allWeekdays}
                onChange={(e) => setAllWeekdays(e.target.checked)}
                className="h-5 w-5"
              />
              Every day in range
            </label>
            {!allWeekdays && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`min-h-[36px] rounded-full border px-3 text-xs font-medium ${
                      days.has(d.value)
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Update {allWeekdays ? dayCount : '…'} dose{dayCount === 1 ? '' : 's'} from {start} – {end}?
          </p>

          <button
            type="button"
            onClick={() =>
              onApply({ startDate: start, endDate: end, dose, weekdays: allWeekdays ? undefined : [...days] })
            }
            className="min-h-[44px] w-full rounded-lg bg-indigo-600 text-sm font-medium text-white active:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
