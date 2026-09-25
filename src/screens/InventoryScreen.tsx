import { useState } from 'react'
import { EmptyState } from '../components/common/EmptyState'
import { AlertTriangleIcon, BoxIcon } from '../components/common/icons'
import { ReconstituteSheet } from '../components/inventory/ReconstituteSheet'
import { RunwayBar } from '../components/inventory/RunwayBar'
import { TopBar } from '../components/layout/TopBar'
import { useInventoryForecast, type ProductForecast } from '../hooks/useInventoryForecast'
import { addVialsBulk, correctRemainingMl, reconstituteVial } from '../lib/actions'
import { roundMlDisplay } from '../lib/calc'
import { formatDisplay } from '../lib/dates'
import { useSettings } from '../hooks/useSettings'

export function InventoryScreen() {
  const forecasts = useInventoryForecast()
  const settings = useSettings()
  const [reconstituting, setReconstituting] = useState<{ vialId: string; defaultBacMl: number } | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [addCount, setAddCount] = useState(1)
  const [addLot, setAddLot] = useState('')

  if (forecasts === undefined) return null

  return (
    <div>
      <TopBar title="Inventory" />
      <div className="space-y-4 px-4 py-4 pb-10">
        {forecasts.length === 0 ? (
          <EmptyState title="No vials yet — create a protocol to get started" icon={<BoxIcon className="h-10 w-10" />} />
        ) : (
          forecasts.map((pf) => <ProductCard key={pf.product.id} pf={pf} onReconstitute={setReconstituting} onAddVials={() => { setAddingFor(pf.product.id); setAddCount(1); setAddLot('') }} />)
        )}
      </div>

      {reconstituting && (
        <ReconstituteSheet
          defaultBacMl={reconstituting.defaultBacMl}
          onClose={() => setReconstituting(null)}
          onConfirm={async (bacMl, date) => {
            await reconstituteVial(reconstituting.vialId, bacMl, settings.beyondUseDays, date)
            setReconstituting(null)
          }}
        />
      )}

      {addingFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
          <div className="safe-bottom w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900">
            <h2 className="text-base font-semibold">Add vials</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">How many</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={addCount}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setAddCount(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-right dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <input
                value={addLot}
                onChange={(e) => setAddLot(e.target.value)}
                placeholder="Lot # (optional)"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddingFor(null)} className="min-h-[44px] flex-1 rounded-lg border border-slate-300 text-sm dark:border-slate-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await addVialsBulk(addingFor, addCount, addLot || undefined)
                    setAddingFor(null)
                  }}
                  className="min-h-[44px] flex-1 rounded-lg bg-indigo-600 text-sm font-medium text-white active:bg-indigo-700"
                >
                  Add {addCount} vial{addCount === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({
  pf,
  onReconstitute,
  onAddVials,
}: {
  pf: ProductForecast
  onReconstitute: (v: { vialId: string; defaultBacMl: number }) => void
  onAddVials: () => void
}) {
  const { product, compound, activeVial, vials, result } = pf
  const unopened = vials.filter((v) => v.status === 'unopened')
  const empty = vials.filter((v) => v.status === 'empty')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{compound?.name ?? 'Unknown compound'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{product.vialAmountMg} mg vial{product.label ? ` · ${product.label}` : ''}</p>
        </div>
        <button type="button" onClick={onAddVials} className="min-h-[36px] rounded-lg border border-slate-300 px-3 text-xs font-medium dark:border-slate-700">
          + Add vials
        </button>
      </div>

      {result && <RunwayBar runOutDate={result.allStockRunOutDate} protocolEndDate={pf.protocols[0]?.endDate} />}

      {result && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Stat label="Vials still needed" value={String(result.vialsStillNeeded)} />
          <Stat label="BAC water needed" value={`${roundMlDisplay(result.bacWaterStillNeededMl)} mL`} />
          <Stat label="Syringes" value={String(result.syringeCount)} />
          <Stat label="Alcohol swabs" value={String(result.alcoholSwabCount)} />
        </div>
      )}

      {result?.beyondUseWaste && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            Active vial hits its beyond-use date {formatDisplay(result.beyondUseWaste.beyondUseDate)} with ~
            {roundMlDisplay(result.beyondUseWaste.wastedMl)} mL still left — it'll be discarded with product remaining.
          </span>
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {activeVial && (
          <VialRow
            label="Active vial"
            detail={`${roundMlDisplay(activeVial.remainingMl ?? 0)} mL left${activeVial.beyondUseDate ? ` · use by ${formatDisplay(activeVial.beyondUseDate)}` : ''}`}
            action={
              <input
                type="number"
                inputMode="decimal"
                defaultValue={activeVial.remainingMl}
                onBlur={(e) => correctRemainingMl(activeVial.id, Number(e.target.value))}
                className="h-8 w-16 rounded-md border border-slate-300 px-1 text-right text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            }
          />
        )}
        {unopened.map((v) => (
          <VialRow
            key={v.id}
            label="Unopened vial"
            detail={v.lot ?? ''}
            action={
              <button
                type="button"
                onClick={() => onReconstitute({ vialId: v.id, defaultBacMl: activeVial?.bacWaterMl ?? product.defaultBacWaterMl ?? 2 })}
                className="min-h-[32px] rounded-lg border border-indigo-300 px-2.5 text-xs font-medium text-indigo-600 dark:border-indigo-800 dark:text-indigo-400"
              >
                Reconstitute
              </button>
            }
          />
        ))}
        {empty.length > 0 && <p className="text-xs text-slate-400">{empty.length} empty vial{empty.length === 1 ? '' : 's'}</p>}
      </div>
    </div>
  )
}

function VialRow({ label, detail, action }: { label: string; detail: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
      <div>
        <span className="font-medium">{label}</span>
        {detail && <span className="ml-1.5 text-slate-500 dark:text-slate-400">{detail}</span>}
      </div>
      {action}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}
