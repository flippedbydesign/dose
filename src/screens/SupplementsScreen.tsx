import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { EmptyState } from '../components/common/EmptyState'
import { PillIcon } from '../components/common/icons'
import { TopBar } from '../components/layout/TopBar'
import { db } from '../lib/db'
import { formatDisplay, todayStr } from '../lib/dates'
import { mergeSupplementDoseEvents } from '../lib/merge'
import { generateFrequencyOccurrences } from '../lib/schedule'
import { setSupplementTaken, deleteSupplement } from '../lib/supplementActions'
import { supplementRunOutDate } from '../lib/supplementForecast'
import type { Frequency, Supplement, SupplementForm, SupplementUnit } from '../lib/types'

const FORMS: SupplementForm[] = ['capsule', 'tablet', 'powder', 'liquid', 'softgel']
const UNITS: SupplementUnit[] = ['caps', 'g', 'mg', 'mL', 'scoops']
const PALETTE = ['#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#db2777']

export function SupplementsScreen() {
  const today = todayStr()
  const supplements = useLiveQuery(() => db.supplements.toArray(), [])
  const [showAdd, setShowAdd] = useState(false)

  if (supplements === undefined) return null

  return (
    <div>
      <TopBar title="Supplements" />
      <div className="space-y-4 px-4 py-4 pb-10">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="min-h-[44px] w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white active:bg-indigo-700"
        >
          + Add supplement
        </button>

        {supplements.length === 0 ? (
          <EmptyState title="No supplements yet — add one" icon={<PillIcon className="h-10 w-10" />} />
        ) : (
          supplements
            .filter((s) => s.status === 'active')
            .map((s) => <SupplementCard key={s.id} supplement={s} today={today} />)
        )}
      </div>

      {showAdd && <AddSupplementSheet onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function SupplementCard({ supplement, today }: { supplement: Supplement; today: string }) {
  const persisted = useLiveQuery(
    () => db.supplementDoseEvents.where('[supplementId+date]').equals([supplement.id, today]).toArray(),
    [supplement.id, today],
  )
  const occurrences = generateFrequencyOccurrences(supplement.frequency, supplement.startDate, today, today)
  const merged = mergeSupplementDoseEvents(supplement.id, supplement.doseAmount, supplement.doseUnit, occurrences, persisted ?? [])
  const runOut = supplementRunOutDate(supplement)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: supplement.color }} />
          <span className="text-sm font-medium">{supplement.name}</span>
        </div>
        <button type="button" onClick={() => deleteSupplement(supplement.id)} className="text-xs text-red-500">
          Delete
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        {supplement.doseAmount} {supplement.doseUnit} · {supplement.form} · {supplement.stockCount} in stock
        {runOut && <> · runs out {formatDisplay(runOut, 'MMM d')}</>}
      </p>
      <div className="space-y-1.5">
        {merged.map((dose) => (
          <button
            key={dose.id}
            type="button"
            onClick={() =>
              setSupplementTaken(supplement.id, dose.date, dose.slot, { plannedAmount: dose.plannedAmount, plannedUnit: dose.plannedUnit }, !dose.taken)
            }
            className="flex min-h-[40px] w-full items-center gap-2 rounded-lg bg-slate-50 px-2.5 text-sm dark:bg-slate-800/60"
          >
            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${
                dose.taken ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {dose.taken && '✓'}
            </span>
            {dose.plannedAmount} {dose.plannedUnit}
          </button>
        ))}
      </div>
    </div>
  )
}

function AddSupplementSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [form, setForm] = useState<SupplementForm>('capsule')
  const [doseAmount, setDoseAmount] = useState(1)
  const [doseUnit, setDoseUnit] = useState<SupplementUnit>('caps')
  const [stockCount, setStockCount] = useState(60)
  const [frequency] = useState<Frequency>({ type: 'daily', timesPerDay: 1 })

  async function save() {
    const supplement: Supplement = {
      id: crypto.randomUUID(),
      name,
      form,
      doseAmount,
      doseUnit,
      stockCount,
      frequency,
      startDate: todayStr(),
      status: 'active',
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    }
    await db.supplements.add(supplement)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <div className="safe-bottom w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900">
        <h2 className="text-base font-semibold">Add supplement</h2>
        <div className="mt-3 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Vitamin D3)"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <select value={form} onChange={(e) => setForm(e.target.value as SupplementForm)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
            {FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={doseAmount}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDoseAmount(Number(e.target.value))}
              className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-right dark:border-slate-700 dark:bg-slate-900"
            />
            <select value={doseUnit} onChange={(e) => setDoseUnit(e.target.value as SupplementUnit)} className="h-11 rounded-lg border border-slate-300 px-2 dark:border-slate-700 dark:bg-slate-900">
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Stock on hand</label>
            <input
              type="number"
              inputMode="numeric"
              value={stockCount}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setStockCount(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-right dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-[44px] flex-1 rounded-lg border border-slate-300 text-sm dark:border-slate-700">
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={save}
              className="min-h-[44px] flex-1 rounded-lg bg-indigo-600 text-sm font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
