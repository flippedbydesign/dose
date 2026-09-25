import { roundMlDisplay, roundUnitsDisplay } from '../../lib/calc'
import { computeDoseDisplay } from '../../lib/doseDisplay'
import type { MergedDoseEvent } from '../../lib/merge'
import type { Compound, Product, Protocol, Vial } from '../../lib/types'
import { AlertTriangleIcon } from '../common/icons'

interface DoseCardProps {
  protocol: Protocol
  dose: MergedDoseEvent
  product?: Product
  compound?: Compound
  activeVial?: Vial
  onToggleTaken: () => void
  onOpenEdit: () => void
}

export function DoseCard({ protocol, dose, product, compound, activeVial, onToggleTaken, onOpenEdit }: DoseCardProps) {
  const display =
    product && compound
      ? computeDoseDisplay({
          dose: dose.actualDose ?? dose.plannedDose,
          doseUnit: dose.plannedUnit,
          product,
          compound,
          doseBasis: protocol.doseBasis,
          basisComponent: protocol.basisComponent,
          bacMl: activeVial?.bacWaterMl ?? product.defaultBacWaterMl ?? 1,
        })
      : undefined

  const lowStock = activeVial?.remainingMl !== undefined && display && activeVial.remainingMl < display.volumeMl * 3
  const pastBeyondUse = activeVial?.beyondUseDate && activeVial.beyondUseDate < dose.date

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        dose.skipped
          ? 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/50'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <button
        type="button"
        aria-label={dose.taken ? 'Mark not taken' : 'Mark taken'}
        onClick={onToggleTaken}
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 ${
          dose.taken
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 text-transparent dark:border-slate-600'
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button type="button" onClick={onOpenEdit} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: protocol.color }} />
          <span className="truncate text-sm font-medium">{protocol.name}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {dose.actualDose ?? dose.plannedDose} {dose.plannedUnit}
          </span>
          {display && (
            <span>
              {roundUnitsDisplay(display.units)} units / {roundMlDisplay(display.volumeMl)} mL
            </span>
          )}
        </div>
        {activeVial && (
          <div className="mt-0.5 truncate text-xs text-slate-400">
            from vial · {activeVial.lot ?? activeVial.id.slice(0, 8)}
          </div>
        )}
        {(lowStock || pastBeyondUse) && !dose.taken && !dose.skipped && (
          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon className="h-3.5 w-3.5" />
            {pastBeyondUse ? 'vial past beyond-use date' : 'vial running low'}
          </div>
        )}
      </button>

      {dose.skipped && <span className="flex-none text-xs font-medium text-slate-400">Skipped</span>}
    </div>
  )
}
