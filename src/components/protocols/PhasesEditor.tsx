import { componentBasisVolumeMl, concentrationMcgPerMl, roundUnitsDisplay, toMcg, unitsFromMl, volumeMlForDose } from '../../lib/calc'
import type { DoseBasis, DoseUnit, Frequency, Phase } from '../../lib/types'
import { TrashIcon } from '../common/icons'

const FREQUENCY_OPTIONS: { value: Frequency['type']; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Specific weekdays' },
  { value: 'everyNDays', label: 'Every N days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'cycle', label: 'On/off cycle' },
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface PhasesEditorProps {
  phases: Phase[]
  onChange: (phases: Phase[]) => void
  vialMg: number
  bacMl: number
  doseBasis: DoseBasis
  basisComponentMg?: number
  iuPerMg?: number
}

function newPhase(startWeek: number): Phase {
  return {
    id: crypto.randomUUID(),
    startWeek,
    endWeek: startWeek,
    dose: 0,
    doseUnit: 'mcg',
    frequency: { type: 'daily', timesPerDay: 1 },
  }
}

export function PhasesEditor({ phases, onChange, vialMg, bacMl, doseBasis, basisComponentMg, iuPerMg }: PhasesEditorProps) {
  function update(index: number, patch: Partial<Phase>) {
    const next = [...phases]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  function updateFrequency(index: number, patch: Partial<Frequency>) {
    const next = [...phases]
    next[index] = { ...next[index], frequency: { ...next[index].frequency, ...patch } as Frequency }
    onChange(next)
  }

  function addPhase() {
    const lastEnd = phases.length > 0 ? Math.max(...phases.map((p) => p.endWeek)) : 0
    onChange([...phases, newPhase(lastEnd + 1)])
  }

  function removePhase(index: number) {
    onChange(phases.filter((_, i) => i !== index))
  }

  function unitsForPhase(phase: Phase): number {
    if (phase.doseUnit === 'units') return phase.dose
    const doseMcg = toMcg(phase.dose, phase.doseUnit, iuPerMg)
    if (!Number.isFinite(doseMcg)) return 0
    if (doseBasis === 'component' && basisComponentMg) {
      return unitsFromMl(componentBasisVolumeMl(doseMcg, basisComponentMg, bacMl))
    }
    const concentration = concentrationMcgPerMl(vialMg, bacMl)
    return unitsFromMl(volumeMlForDose(doseMcg, concentration))
  }

  return (
    <div className="space-y-3">
      {phases.map((phase, i) => (
        <div key={phase.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <input
              value={phase.label ?? ''}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder={`Phase ${i + 1}`}
              className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-medium focus:border-slate-300 focus:outline-none"
            />
            <button type="button" onClick={() => removePhase(i)} className="flex h-9 w-9 flex-none items-center justify-center text-slate-400">
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Weeks</span>
            <input
              type="number"
              inputMode="numeric"
              value={phase.startWeek}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => update(i, { startWeek: Number(e.target.value) })}
              className="h-9 w-14 rounded-md border border-slate-300 px-1 text-center dark:border-slate-700 dark:bg-slate-900"
            />
            <span>–</span>
            <input
              type="number"
              inputMode="numeric"
              value={phase.endWeek}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => update(i, { endWeek: Number(e.target.value) })}
              className="h-9 w-14 rounded-md border border-slate-300 px-1 text-center dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="w-16 flex-none text-slate-500">Dose</span>
            <input
              type="number"
              inputMode="decimal"
              value={phase.dose}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => update(i, { dose: Number(e.target.value) })}
              className="h-9 w-20 rounded-md border border-slate-300 px-2 text-right dark:border-slate-700 dark:bg-slate-900"
            />
            <select
              value={phase.doseUnit}
              onChange={(e) => update(i, { doseUnit: e.target.value as DoseUnit })}
              className="h-9 rounded-md border border-slate-300 px-1 dark:border-slate-700 dark:bg-slate-900"
            >
              {(['mcg', 'mg', 'IU', 'units'] as DoseUnit[]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="w-16 flex-none text-slate-500">Freq.</span>
            <select
              value={phase.frequency.type}
              onChange={(e) => {
                const type = e.target.value as Frequency['type']
                const freq: Frequency =
                  type === 'daily'
                    ? { type, timesPerDay: 1 }
                    : type === 'weekdays'
                      ? { type, days: [1] }
                      : type === 'everyNDays'
                        ? { type, n: 2 }
                        : type === 'weekly'
                          ? { type, day: 1 }
                          : { type, onDays: 5, offDays: 2 }
                update(i, { frequency: freq })
              }}
              className="h-9 flex-1 rounded-md border border-slate-300 px-1 dark:border-slate-700 dark:bg-slate-900"
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {phase.frequency.type === 'daily' && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="w-16 flex-none text-slate-500">×/day</span>
              <input
                type="number"
                min={1}
                value={phase.frequency.timesPerDay}
                onChange={(e) => updateFrequency(i, { timesPerDay: Number(e.target.value) })}
                className="h-9 w-16 rounded-md border border-slate-300 px-2 text-center dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          )}

          {phase.frequency.type === 'weekdays' && (
            <div className="mt-2 flex flex-wrap gap-1">
              {WEEKDAY_LABELS.map((label, d) => {
                const freq = phase.frequency as Extract<Frequency, { type: 'weekdays' }>
                const active = freq.days.includes(d as 0 | 1 | 2 | 3 | 4 | 5 | 6)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const days = active ? freq.days.filter((x) => x !== d) : [...freq.days, d as 0 | 1 | 2 | 3 | 4 | 5 | 6]
                      updateFrequency(i, { days })
                    }}
                    className={`min-h-[32px] rounded-full border px-2.5 text-xs font-medium ${
                      active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {phase.frequency.type === 'everyNDays' && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="w-16 flex-none text-slate-500">Every</span>
              <input
                type="number"
                min={1}
                value={(phase.frequency as Extract<Frequency, { type: 'everyNDays' }>).n}
                onChange={(e) => updateFrequency(i, { n: Number(e.target.value) })}
                className="h-9 w-16 rounded-md border border-slate-300 px-2 text-center dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="text-slate-500">days</span>
            </div>
          )}

          {phase.frequency.type === 'weekly' && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="w-16 flex-none text-slate-500">On</span>
              <select
                value={(phase.frequency as Extract<Frequency, { type: 'weekly' }>).day}
                onChange={(e) => updateFrequency(i, { day: Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6 })}
                className="h-9 rounded-md border border-slate-300 px-1 dark:border-slate-700 dark:bg-slate-900"
              >
                {WEEKDAY_LABELS.map((l, d) => (
                  <option key={d} value={d}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}

          {phase.frequency.type === 'cycle' && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                value={(phase.frequency as Extract<Frequency, { type: 'cycle' }>).onDays}
                onChange={(e) => updateFrequency(i, { onDays: Number(e.target.value) })}
                className="h-9 w-14 rounded-md border border-slate-300 px-2 text-center dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="text-slate-500">on /</span>
              <input
                type="number"
                min={0}
                value={(phase.frequency as Extract<Frequency, { type: 'cycle' }>).offDays}
                onChange={(e) => updateFrequency(i, { offDays: Number(e.target.value) })}
                className="h-9 w-14 rounded-md border border-slate-300 px-2 text-center dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="text-slate-500">off</span>
            </div>
          )}

          {vialMg > 0 && bacMl > 0 && phase.dose > 0 && (
            <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              ≈ {roundUnitsDisplay(unitsForPhase(phase))} units per dose
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addPhase}
        className="min-h-[44px] w-full rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-600 active:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:active:bg-slate-800"
      >
        + Add phase
      </button>
    </div>
  )
}
