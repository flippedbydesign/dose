import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DoseCard } from '../components/today/DoseCard'
import { DoseEditSheet } from '../components/today/DoseEditSheet'
import { EmptyState } from '../components/common/EmptyState'
import { CheckSquareIcon } from '../components/common/icons'
import { TopBar } from '../components/layout/TopBar'
import {
  adjustVialRemainingMl,
  bulkCheckOff,
  editDoseEvent,
  findPreviousDose,
  restoreSnapshot,
  setDoseSkipped,
  setDoseTaken,
  snapshotFor,
} from '../lib/actions'
import { addDays, formatDisplay, todayStr } from '../lib/dates'
import { computeDoseDisplay } from '../lib/doseDisplay'
import type { MergedDoseEvent } from '../lib/merge'
import { getActiveVial } from '../lib/vials'
import { useCatalog, useAllVials } from '../hooks/useCatalog'
import { useScheduledDoses } from '../hooks/useScheduledDoses'
import { useUndoToast } from '../hooks/useUndoToast'
import type { Protocol } from '../lib/types'

interface FlatDose {
  protocol: Protocol
  dose: MergedDoseEvent
}

export function TodayScreen() {
  const navigate = useNavigate()
  const today = todayStr()
  const yesterday = addDays(today, -1)
  const grouped = useScheduledDoses(yesterday, today)
  const { productsById, compoundsById } = useCatalog()
  const vials = useAllVials()
  const { show: showUndoToast } = useUndoToast()
  const [editing, setEditing] = useState<FlatDose | null>(null)
  const [missedOpen, setMissedOpen] = useState(false)

  const { todayDoses, missedYesterday } = useMemo(() => {
    const t: FlatDose[] = []
    const m: FlatDose[] = []
    for (const pd of grouped ?? []) {
      for (const dose of pd.doses) {
        if (dose.date === today) t.push({ protocol: pd.protocol, dose })
        else if (dose.date === yesterday && !dose.taken && !dose.skipped) m.push({ protocol: pd.protocol, dose })
      }
    }
    return { todayDoses: t, missedYesterday: m }
  }, [grouped, today, yesterday])

  const groupsByTime = useMemo(() => {
    const map = new Map<string, FlatDose[]>()
    for (const item of todayDoses) {
      const label = item.protocol.timeOfDay?.[item.dose.slot] ?? 'Anytime'
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(item)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [todayDoses])

  async function applyVialDelta(item: FlatDose, taken: boolean) {
    const product = productsById.get(item.protocol.productId)
    const compound = product ? compoundsById.get(product.compoundId) : undefined
    const activeVial = product ? getActiveVial(vials, product.id) : undefined
    if (!product || !compound || !activeVial) return
    const display = computeDoseDisplay({
      dose: item.dose.actualDose ?? item.dose.plannedDose,
      doseUnit: item.dose.plannedUnit,
      product,
      compound,
      doseBasis: item.protocol.doseBasis,
      basisComponent: item.protocol.basisComponent,
      bacMl: activeVial.bacWaterMl ?? product.defaultBacWaterMl ?? 1,
    })
    await adjustVialRemainingMl(activeVial.id, taken ? -display.volumeMl : display.volumeMl)
  }

  async function toggleTaken(item: FlatDose) {
    const nextTaken = !item.dose.taken
    await setDoseTaken(
      item.protocol.id,
      item.dose.date,
      item.dose.slot,
      { plannedDose: item.dose.plannedDose, plannedUnit: item.dose.plannedUnit },
      nextTaken,
    )
    await applyVialDelta(item, nextTaken)
  }

  async function markAllTaken(items: FlatDose[]) {
    const pending = items.filter((i) => !i.dose.taken && !i.dose.skipped)
    if (pending.length === 0) return
    const byProtocol = new Map<string, FlatDose[]>()
    for (const item of pending) {
      if (!byProtocol.has(item.protocol.id)) byProtocol.set(item.protocol.id, [])
      byProtocol.get(item.protocol.id)!.push(item)
    }
    const snapshot = await snapshotFor(pending.map((i) => ({ protocolId: i.protocol.id, date: i.dose.date, slot: i.dose.slot })))
    for (const [protocolId, group] of byProtocol) {
      await bulkCheckOff(
        protocolId,
        group.map((i) => ({ date: i.dose.date, slot: i.dose.slot, plannedDose: i.dose.plannedDose, plannedUnit: i.dose.plannedUnit })),
      )
    }
    for (const item of pending) await applyVialDelta(item, true)
    showUndoToast(`Marked ${pending.length} dose${pending.length === 1 ? '' : 's'} taken`, async () => {
      await restoreSnapshot(snapshot)
      for (const item of pending) await applyVialDelta(item, false)
    })
  }

  if (grouped === undefined) return null

  const hasAnyProtocols = grouped.length > 0

  return (
    <div>
      <TopBar title="Today" />
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{formatDisplay(today, 'EEEE, MMMM d')}</p>

        {missedYesterday.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
            <button
              type="button"
              onClick={() => setMissedOpen((v) => !v)}
              className="flex min-h-[44px] w-full items-center justify-between px-3 text-sm font-medium text-amber-800 dark:text-amber-300"
            >
              Missed yesterday ({missedYesterday.length})
              <span>{missedOpen ? '▲' : '▼'}</span>
            </button>
            {missedOpen && (
              <div className="space-y-2 px-3 pb-3">
                {missedYesterday.map((item) => (
                  <DoseCard
                    key={`${item.protocol.id}-${item.dose.date}-${item.dose.slot}`}
                    protocol={item.protocol}
                    dose={item.dose}
                    product={productsById.get(item.protocol.productId)}
                    compound={
                      productsById.get(item.protocol.productId)
                        ? compoundsById.get(productsById.get(item.protocol.productId)!.compoundId)
                        : undefined
                    }
                    activeVial={getActiveVial(vials, item.protocol.productId)}
                    onToggleTaken={() => toggleTaken(item)}
                    onOpenEdit={() => setEditing(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!hasAnyProtocols && (
          <EmptyState
            title="No protocols yet — create one"
            icon={<CheckSquareIcon className="h-10 w-10" />}
            action={{ label: 'Create protocol', onClick: () => navigate('/protocols/new') }}
          />
        )}

        {hasAnyProtocols && todayDoses.length === 0 && (
          <EmptyState title="Nothing scheduled for today" icon={<CheckSquareIcon className="h-10 w-10" />} />
        )}

        {todayDoses.length > 0 && (
          <button
            type="button"
            onClick={() => markAllTaken(todayDoses)}
            className="min-h-[44px] w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-700"
          >
            Mark all taken
          </button>
        )}

        {groupsByTime.map(([time, items]) => (
          <div key={time}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{time}</h2>
            <div className="space-y-2">
              {items.map((item) => (
                <DoseCard
                  key={`${item.protocol.id}-${item.dose.date}-${item.dose.slot}`}
                  protocol={item.protocol}
                  dose={item.dose}
                  product={productsById.get(item.protocol.productId)}
                  compound={
                    productsById.get(item.protocol.productId)
                      ? compoundsById.get(productsById.get(item.protocol.productId)!.compoundId)
                      : undefined
                  }
                  activeVial={getActiveVial(vials, item.protocol.productId)}
                  onToggleTaken={() => toggleTaken(item)}
                  onOpenEdit={() => setEditing(item)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <DoseEditSheet
          protocol={editing.protocol}
          dose={editing.dose}
          onClose={() => setEditing(null)}
          onSave={(edit) =>
            editDoseEvent(
              editing.protocol.id,
              editing.dose.date,
              editing.dose.slot,
              { plannedDose: editing.dose.plannedDose, plannedUnit: editing.dose.plannedUnit },
              edit,
            )
          }
          onSkipToggle={(skipped) =>
            setDoseSkipped(
              editing.protocol.id,
              editing.dose.date,
              editing.dose.slot,
              { plannedDose: editing.dose.plannedDose, plannedUnit: editing.dose.plannedUnit },
              skipped,
            )
          }
          onCopyPrevious={async () => {
            const prev = await findPreviousDose(editing.protocol.id, editing.dose.date)
            if (prev) {
              await editDoseEvent(
                editing.protocol.id,
                editing.dose.date,
                editing.dose.slot,
                { plannedDose: editing.dose.plannedDose, plannedUnit: editing.dose.plannedUnit },
                { actualDose: prev.actualDose ?? prev.plannedDose },
              )
            }
          }}
        />
      )}
    </div>
  )
}
