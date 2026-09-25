import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ApplyToRangeSheet } from '../components/calendar/ApplyToRangeSheet'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { DoseCard } from '../components/today/DoseCard'
import { DoseEditSheet } from '../components/today/DoseEditSheet'
import { EmptyState } from '../components/common/EmptyState'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/common/icons'
import { TopBar } from '../components/layout/TopBar'
import { useCatalog, useAllVials } from '../hooks/useCatalog'
import { useScheduledDoses } from '../hooks/useScheduledDoses'
import {
  adjustVialRemainingMl,
  applyDoseToRange,
  editDoseEvent,
  findPreviousDose,
  setDoseSkipped,
  setDoseTaken,
} from '../lib/actions'
import { db } from '../lib/db'
import { formatDisplay, monthGrid, todayStr } from '../lib/dates'
import { computeDoseDisplay } from '../lib/doseDisplay'
import type { MergedDoseEvent } from '../lib/merge'
import type { Protocol } from '../lib/types'
import { getActiveVial } from '../lib/vials'

export function CalendarScreen() {
  const today = todayStr()
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }))
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeFilters, setActiveFilters] = useState<Set<string> | null>(null) // null = all
  const [editing, setEditing] = useState<{ protocol: Protocol; dose: MergedDoseEvent } | null>(null)
  const [applyRangeFor, setApplyRangeFor] = useState<{ protocol: Protocol; dose: MergedDoseEvent } | null>(null)

  const gridDates = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const rangeStart = gridDates[0]
  const rangeEnd = gridDates[gridDates.length - 1]

  const grouped = useScheduledDoses(rangeStart, rangeEnd)
  const allProtocols = useLiveQuery(() => db.protocols.toArray(), []) ?? []
  const { productsById, compoundsById } = useCatalog()
  const vials = useAllVials()

  const visibleGrouped = useMemo(
    () => (grouped ?? []).filter((pd) => !activeFilters || activeFilters.has(pd.protocol.id)),
    [grouped, activeFilters],
  )

  const days = useMemo(
    () =>
      gridDates.map((date) => ({
        date,
        items: visibleGrouped.flatMap((pd) => pd.doses.filter((d) => d.date === date).map((dose) => ({ protocol: pd.protocol, dose }))),
      })),
    [gridDates, visibleGrouped],
  )

  const selectedDayItems = days.find((d) => d.date === selectedDate)?.items ?? []

  function toggleFilter(id: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev ?? allProtocols.map((p) => p.id))
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function applyVialDelta(protocol: Protocol, dose: MergedDoseEvent, taken: boolean) {
    const product = productsById.get(protocol.productId)
    const compound = product ? compoundsById.get(product.compoundId) : undefined
    const activeVial = product ? getActiveVial(vials, product.id) : undefined
    if (!product || !compound || !activeVial) return
    const display = computeDoseDisplay({
      dose: dose.actualDose ?? dose.plannedDose,
      doseUnit: dose.plannedUnit,
      product,
      compound,
      doseBasis: protocol.doseBasis,
      basisComponent: protocol.basisComponent,
      bacMl: activeVial.bacWaterMl ?? product.defaultBacWaterMl ?? 1,
    })
    await adjustVialRemainingMl(activeVial.id, taken ? -display.volumeMl : display.volumeMl)
  }

  async function toggleTaken(protocol: Protocol, dose: MergedDoseEvent) {
    const next = !dose.taken
    await setDoseTaken(protocol.id, dose.date, dose.slot, { plannedDose: dose.plannedDose, plannedUnit: dose.plannedUnit }, next)
    await applyVialDelta(protocol, dose, next)
  }

  if (grouped === undefined) return null

  return (
    <div>
      <TopBar title="Calendar" />
      <div className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}
            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold">{formatDisplay(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-01`, 'MMMM yyyy')}</h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}
            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        {allProtocols.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {allProtocols.map((p) => {
              const isActive = !activeFilters || activeFilters.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleFilter(p.id)}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                    isActive ? 'border-slate-300 dark:border-slate-700' : 'border-slate-200 text-slate-400 dark:border-slate-800'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </button>
              )
            })}
          </div>
        )}

        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          days={days}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">{formatDisplay(selectedDate, 'EEEE, MMMM d')}</h3>
          {selectedDayItems.length === 0 ? (
            <EmptyState title="Nothing scheduled" />
          ) : (
            <div className="space-y-2">
              {selectedDayItems.map(({ protocol, dose }) => (
                <DoseCard
                  key={`${protocol.id}-${dose.date}-${dose.slot}`}
                  protocol={protocol}
                  dose={dose}
                  product={productsById.get(protocol.productId)}
                  compound={
                    productsById.get(protocol.productId) ? compoundsById.get(productsById.get(protocol.productId)!.compoundId) : undefined
                  }
                  activeVial={getActiveVial(vials, protocol.productId)}
                  onToggleTaken={() => toggleTaken(protocol, dose)}
                  onOpenEdit={() => setEditing({ protocol, dose })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <DoseEditSheet
          protocol={editing.protocol}
          dose={editing.dose}
          onClose={() => setEditing(null)}
          onSave={(edit) =>
            editDoseEvent(editing.protocol.id, editing.dose.date, editing.dose.slot, { plannedDose: editing.dose.plannedDose, plannedUnit: editing.dose.plannedUnit }, edit)
          }
          onSkipToggle={(skipped) =>
            setDoseSkipped(editing.protocol.id, editing.dose.date, editing.dose.slot, { plannedDose: editing.dose.plannedDose, plannedUnit: editing.dose.plannedUnit }, skipped)
          }
          onCopyPrevious={async () => {
            const prev = await findPreviousDose(editing.protocol.id, editing.dose.date)
            if (prev) {
              await editDoseEvent(editing.protocol.id, editing.dose.date, editing.dose.slot, { plannedDose: editing.dose.plannedDose, plannedUnit: editing.dose.plannedUnit }, { actualDose: prev.actualDose ?? prev.plannedDose })
            }
          }}
          onApplyToRange={() => {
            setApplyRangeFor(editing)
            setEditing(null)
          }}
        />
      )}

      {applyRangeFor && (
        <ApplyToRangeSheet
          initialDose={applyRangeFor.dose.plannedDose}
          unit={applyRangeFor.dose.plannedUnit}
          startDate={applyRangeFor.dose.date}
          onClose={() => setApplyRangeFor(null)}
          onApply={async ({ startDate, endDate, dose, weekdays }) => {
            await applyDoseToRange({
              protocolId: applyRangeFor.protocol.id,
              startDate,
              endDate,
              slot: applyRangeFor.dose.slot,
              dose,
              unit: applyRangeFor.dose.plannedUnit,
              weekdays: weekdays as (0 | 1 | 2 | 3 | 4 | 5 | 6)[] | undefined,
            })
            setApplyRangeFor(null)
          }}
        />
      )}
    </div>
  )
}
