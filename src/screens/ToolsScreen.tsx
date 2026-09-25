import { useMemo, useState } from 'react'
import { NumberField } from '../components/common/NumberField'
import { AlertTriangleIcon } from '../components/common/icons'
import { SyringeGraphic } from '../components/tools/SyringeGraphic'
import { TopBar } from '../components/layout/TopBar'
import { useSettings } from '../hooks/useSettings'
import {
  computeRecon,
  reverseBacMlForTargetUnits,
  roundMcgDisplay,
  roundMlDisplay,
  roundUnitsDisplay,
} from '../lib/calc'
import type { SyringeType } from '../lib/types'

const SYRINGES: { value: SyringeType; label: string }[] = [
  { value: 'U100-1.0', label: 'U-100 1 mL (100u)' },
  { value: 'U100-0.5', label: 'U-100 0.5 mL (50u)' },
  { value: 'U100-0.3', label: 'U-100 0.3 mL (30u)' },
]

const DOSE_UNIT_TO_MG_FACTOR: Record<'mcg' | 'mg', number> = { mcg: 0.001, mg: 1 }

export function ToolsScreen() {
  const settings = useSettings()
  const [vialMg, setVialMg] = useState(10)
  const [bacMl, setBacMl] = useState(2)
  const [doseValue, setDoseValue] = useState(250)
  const [doseUnit, setDoseUnit] = useState<'mcg' | 'mg'>('mcg')
  const [syringeType, setSyringeType] = useState<SyringeType>(settings.defaultSyringeType)
  const [reverseMode, setReverseMode] = useState(false)
  const [targetUnits, setTargetUnits] = useState(10)

  const doseMcg = doseValue * (DOSE_UNIT_TO_MG_FACTOR[doseUnit] * 1000)

  const result = useMemo(
    () => computeRecon({ vialMg, bacMl, doseMcg, deadVolumeMl: settings.deadVolumeMl, syringeType }),
    [vialMg, bacMl, doseMcg, settings.deadVolumeMl, syringeType],
  )

  const reverseBac = useMemo(() => reverseBacMlForTargetUnits(vialMg, targetUnits, doseMcg), [vialMg, targetUnits, doseMcg])

  return (
    <div>
      <TopBar title="Tools" />
      <div className="space-y-6 px-4 py-4 pb-10">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Reconstitution calculator</h2>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setReverseMode(false)}
              className={`min-h-[36px] flex-1 rounded-lg border text-sm font-medium ${!reverseMode ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
            >
              Forward
            </button>
            <button
              type="button"
              onClick={() => setReverseMode(true)}
              className={`min-h-[36px] flex-1 rounded-lg border text-sm font-medium ${reverseMode ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
            >
              Reverse (solve water)
            </button>
          </div>

          <div className="space-y-3">
            <NumberField label="Vial amount" value={vialMg} onChange={setVialMg} step={1} min={0} unit="mg" />
            {!reverseMode && <NumberField label="BAC water" value={bacMl} onChange={setBacMl} step={0.1} min={0.1} unit="mL" />}

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <NumberField label="Desired dose" value={doseValue} onChange={setDoseValue} step={doseUnit === 'mg' ? 0.5 : 25} min={0} />
              </div>
              <select
                value={doseUnit}
                onChange={(e) => setDoseUnit(e.target.value as 'mcg' | 'mg')}
                className="h-11 rounded-lg border border-slate-300 px-2 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="mcg">mcg</option>
                <option value="mg">mg</option>
              </select>
            </div>

            {reverseMode && <NumberField label="Target syringe units" value={targetUnits} onChange={setTargetUnits} step={0.5} min={0} unit="units" />}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Syringe type</label>
              <select
                value={syringeType}
                onChange={(e) => setSyringeType(e.target.value as SyringeType)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              >
                {SYRINGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!reverseMode ? (
            <div className="mt-4 space-y-3">
              <SyringeGraphic units={result.units} syringeType={syringeType} />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Concentration" value={`${roundMcgDisplay(result.concentrationMgPerMl)} mg/mL`} />
                <Stat label="mcg per unit" value={`${roundMcgDisplay(result.mcgPerUnit)} mcg`} />
                <Stat label="Volume to draw" value={`${roundMlDisplay(result.volumeMl)} mL`} />
                <Stat label="Syringe units" value={`${roundUnitsDisplay(result.units)} units`} />
                <Stat label="Doses per vial" value={String(result.dosesPerVial)} />
              </div>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    {w.type === 'low-draw' && `Draw of ${roundUnitsDisplay(w.units)} units is under 5 — hard to measure accurately. Consider more water or a smaller syringe.`}
                    {w.type === 'over-capacity' && `${roundUnitsDisplay(w.units)} units exceeds this syringe's ${w.capacity}-unit capacity.`}
                    {w.type === 'high-water-volume' && `${w.bacMl} mL water exceeds the typical ${w.hintMl} mL vial capacity hint.`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <Stat label="BAC water needed" value={`${roundMlDisplay(reverseBac)} mL`} big />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reconstituting with this volume makes a {doseValue} {doseUnit} dose land exactly on {targetUnits} units.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-100 p-2.5 dark:bg-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={big ? 'text-xl font-semibold' : 'text-sm font-semibold'}>{value}</p>
    </div>
  )
}
