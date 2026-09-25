import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CompoundPicker } from '../components/protocols/CompoundPicker'
import { PhasesEditor } from '../components/protocols/PhasesEditor'
import { NumberField } from '../components/common/NumberField'
import { TopBar } from '../components/layout/TopBar'
import { useCatalog } from '../hooks/useCatalog'
import { useSettings } from '../hooks/useSettings'
import { concentrationMcgPerMl, roundMcgDisplay, roundMlDisplay } from '../lib/calc'
import { db } from '../lib/db'
import { todayStr } from '../lib/dates'
import { phasesToWeekRows, computeProtocolReview } from '../lib/reviewStats'
import type { Compound, CompoundCategory, DoseBasis, Phase, Product, ProductComponent, Protocol } from '../lib/types'

const PALETTE = ['#4f46e5', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#db2777', '#0d9488']

const CUSTOM_CATEGORIES: CompoundCategory[] = [
  'Healing / recovery',
  'Metabolic / GLP-1 & related',
  'Growth hormone axis',
  'Longevity / mitochondrial',
  'Cognitive / sleep / mood',
  'Hormonal / sexual health',
  'Bioregulators',
  'Bone',
  'Cosmetic / other',
  'Custom',
]

function randomColor(usedColors: string[]): string {
  return PALETTE.find((c) => !usedColors.includes(c)) ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

export function ProtocolBuilderScreen() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { compounds } = useCatalog()
  const settings = useSettings()

  const [selectedCompound, setSelectedCompound] = useState<Compound | undefined>()
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState<CompoundCategory>('Custom')
  const [customKind, setCustomKind] = useState<'single' | 'blend'>('single')
  const [customComponents, setCustomComponents] = useState<{ name: string; mgPerVial: number }[]>([])

  const [vialAmountMg, setVialAmountMg] = useState(0)
  const [components, setComponents] = useState<ProductComponent[]>([])
  const [productLabel, setProductLabel] = useState('')

  const [bacMl, setBacMl] = useState(2)
  const [doseBasis, setDoseBasis] = useState<DoseBasis>('total')
  const [basisComponent, setBasisComponent] = useState('')

  const [phases, setPhases] = useState<Phase[]>([])
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [timesOfDay, setTimesOfDay] = useState<string[]>(['08:00'])
  const [color, setColor] = useState(() => randomColor([]))
  const [notes, setNotes] = useState('')

  // Load existing protocol when editing
  useEffect(() => {
    if (!id) return
    ;(async () => {
      const protocol = await db.protocols.get(id)
      if (!protocol) return
      const product = await db.products.get(protocol.productId)
      const compound = product ? await db.compounds.get(product.compoundId) : undefined
      setSelectedCompound(compound)
      if (product) {
        setVialAmountMg(product.vialAmountMg)
        setComponents(product.components ?? [])
        setProductLabel(product.label ?? '')
      }
      setPhases(protocol.phases)
      setName(protocol.name)
      setStartDate(protocol.startDate)
      setTimesOfDay(protocol.timeOfDay ?? ['08:00'])
      setColor(protocol.color)
      setNotes(protocol.notes ?? '')
      setDoseBasis(protocol.doseBasis)
      setBasisComponent(protocol.basisComponent ?? '')
      const activeVial = await db.vials.where('productId').equals(protocol.productId).and((v) => v.status === 'reconstituted').first()
      if (activeVial?.bacWaterMl) setBacMl(activeVial.bacWaterMl)
    })()
  }, [id])

  function selectCompound(c: Compound) {
    setSelectedCompound(c)
    setShowCustomForm(false)
    if (c.kind === 'blend' && c.components) {
      setComponents(c.components.map((comp) => ({ name: comp.name, mg: comp.mgPerVial })))
      setVialAmountMg(c.components.reduce((s, comp) => s + comp.mgPerVial, 0))
      setBasisComponent(c.components[0]?.name ?? '')
    } else {
      setComponents([])
      setVialAmountMg(c.commonVialSizesMg?.[0] ?? 0)
    }
  }

  async function saveCustomCompound() {
    const compound: Compound = {
      id: crypto.randomUUID(),
      name: customName,
      category: customCategory,
      kind: customKind,
      components: customKind === 'blend' ? customComponents : undefined,
      isUserDefined: true,
    }
    await db.compounds.add(compound)
    selectCompound(compound)
  }

  function updateComponentMg(index: number, mg: number) {
    const next = [...components]
    next[index] = { ...next[index], mg }
    setComponents(next)
    setVialAmountMg(next.reduce((s, c) => s + c.mg, 0))
  }

  const isBlend = selectedCompound?.kind === 'blend'

  const review = useMemo(() => {
    if (vialAmountMg <= 0 || bacMl <= 0) return undefined
    return computeProtocolReview(
      { startDate, doseBasis, basisComponent: basisComponent || undefined, phases },
      { vialAmountMg, components },
      { iuPerMg: selectedCompound?.iuPerMg },
      bacMl,
      settings.deadVolumeMl,
    )
  }, [vialAmountMg, components, bacMl, startDate, doseBasis, basisComponent, phases, selectedCompound, settings.deadVolumeMl])

  const canSave = !!selectedCompound && vialAmountMg > 0 && bacMl > 0 && phases.length > 0 && name.trim().length > 0

  async function handleSave() {
    if (!selectedCompound || !canSave) return

    let productId: string
    if (isEdit) {
      const protocol = await db.protocols.get(id!)
      productId = protocol!.productId
      await db.products.update(productId, {
        vialAmountMg,
        components: isBlend ? components : undefined,
        label: productLabel || undefined,
        defaultBacWaterMl: bacMl,
      })
    } else {
      const product: Product = {
        id: crypto.randomUUID(),
        compoundId: selectedCompound.id,
        vialAmountMg,
        components: isBlend ? components : undefined,
        label: productLabel || undefined,
        defaultBacWaterMl: bacMl,
      }
      await db.products.add(product)
      productId = product.id
    }

    const protocol: Protocol = {
      id: isEdit ? id! : crypto.randomUUID(),
      name,
      productId,
      startDate,
      endDate: review?.endDate,
      status: 'active',
      doseBasis,
      basisComponent: isBlend ? basisComponent || undefined : undefined,
      phases,
      timeOfDay: timesOfDay,
      color,
      notes: notes || undefined,
    }
    await db.protocols.put(protocol)
    navigate(`/protocols/${protocol.id}`)
  }

  return (
    <div>
      <TopBar title={isEdit ? 'Edit protocol' : 'New protocol'} />
      <div className="space-y-6 px-4 py-4 pb-10">
        <section>
          <h2 className="mb-2 text-sm font-semibold">1. Compound</h2>
          {!showCustomForm ? (
            <>
              <CompoundPicker compounds={compounds} selectedId={selectedCompound?.id} onSelect={selectCompound} />
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400"
              >
                + Create custom compound
              </button>
            </>
          ) : (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Compound name"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as CompoundCategory)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {CUSTOM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomKind('single')}
                  className={`min-h-[36px] flex-1 rounded-lg border text-sm ${customKind === 'single' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setCustomKind('blend')}
                  className={`min-h-[36px] flex-1 rounded-lg border text-sm ${customKind === 'blend' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  Blend
                </button>
              </div>
              {customKind === 'blend' && (
                <div className="space-y-1.5">
                  {customComponents.map((c, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        value={c.name}
                        onChange={(e) => {
                          const next = [...customComponents]
                          next[i] = { ...next[i], name: e.target.value }
                          setCustomComponents(next)
                        }}
                        placeholder="Component"
                        className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                      <input
                        type="number"
                        value={c.mgPerVial}
                        onChange={(e) => {
                          const next = [...customComponents]
                          next[i] = { ...next[i], mgPerVial: Number(e.target.value) }
                          setCustomComponents(next)
                        }}
                        placeholder="mg"
                        className="h-9 w-16 rounded-md border border-slate-300 px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomComponents([...customComponents, { name: '', mgPerVial: 0 }])}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400"
                  >
                    + Add component
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCustomForm(false)} className="min-h-[40px] flex-1 rounded-lg border border-slate-300 text-sm dark:border-slate-700">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!customName.trim()}
                  onClick={saveCustomCompound}
                  className="min-h-[40px] flex-1 rounded-lg bg-indigo-600 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save & select
                </button>
              </div>
            </div>
          )}
        </section>

        {selectedCompound && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">2. Vial strength</h2>
            {!isBlend ? (
              <>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {(selectedCompound.commonVialSizesMg ?? []).map((mg) => (
                    <button
                      key={mg}
                      type="button"
                      onClick={() => setVialAmountMg(mg)}
                      className={`min-h-[36px] rounded-full border px-3 text-sm font-medium ${
                        vialAmountMg === mg ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {mg} mg
                    </button>
                  ))}
                </div>
                <NumberField label="Vial amount (mg)" value={vialAmountMg} onChange={setVialAmountMg} step={1} min={0} unit="mg" />
              </>
            ) : (
              <div className="space-y-1.5">
                {components.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-24 flex-none truncate">{c.name}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={c.mg}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateComponentMg(i, Number(e.target.value))}
                      className="h-9 w-20 rounded-md border border-slate-300 px-2 text-right dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span className="text-slate-400">mg</span>
                  </div>
                ))}
                <p className="text-xs text-slate-500">Total vial: {vialAmountMg} mg</p>
              </div>
            )}
            <input
              value={productLabel}
              onChange={(e) => setProductLabel(e.target.value)}
              placeholder="Label (e.g. supplier, optional)"
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </section>
        )}

        {selectedCompound && vialAmountMg > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">3. Reconstitution</h2>
            <NumberField label="BAC water" value={bacMl} onChange={setBacMl} step={0.1} min={0.1} unit="mL" />
            {bacMl > 0 && (
              <div className="mt-2 space-y-1 rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <p>
                  Concentration: {roundMcgDisplay(concentrationMcgPerMl(vialAmountMg, bacMl) / 1000)} mg/mL · 1 unit ={' '}
                  {roundMcgDisplay(concentrationMcgPerMl(vialAmountMg, bacMl) / 100)} mcg
                </p>
                {isBlend &&
                  components.map((c) => (
                    <p key={c.name}>
                      {c.name}: 1 unit = {roundMcgDisplay(concentrationMcgPerMl(c.mg, bacMl) / 100)} mcg
                    </p>
                  ))}
              </div>
            )}
            {isBlend && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dose entered as</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDoseBasis('total')}
                    className={`min-h-[36px] flex-1 rounded-lg border text-sm ${doseBasis === 'total' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                  >
                    Total blend
                  </button>
                  <button
                    type="button"
                    onClick={() => setDoseBasis('component')}
                    className={`min-h-[36px] flex-1 rounded-lg border text-sm ${doseBasis === 'component' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                  >
                    One component
                  </button>
                </div>
                {doseBasis === 'component' && (
                  <select
                    value={basisComponent}
                    onChange={(e) => setBasisComponent(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {components.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </section>
        )}

        {selectedCompound && vialAmountMg > 0 && bacMl > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">4. Phases</h2>
            <PhasesEditor
              phases={phases}
              onChange={setPhases}
              vialMg={isBlend && doseBasis === 'component' ? 0 : vialAmountMg}
              bacMl={bacMl}
              doseBasis={doseBasis}
              basisComponentMg={isBlend ? components.find((c) => c.name === basisComponent)?.mg : undefined}
              iuPerMg={selectedCompound.iuPerMg}
            />
          </section>
        )}

        {phases.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">5. Schedule details</h2>
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Protocol name (e.g. KLOW – recovery)"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Times of day</label>
                <div className="space-y-1.5">
                  {timesOfDay.map((t, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => {
                          const next = [...timesOfDay]
                          next[i] = e.target.value
                          setTimesOfDay(next)
                        }}
                        className="h-10 flex-1 rounded-lg border border-slate-300 px-2 dark:border-slate-700 dark:bg-slate-900"
                      />
                      {timesOfDay.length > 1 && (
                        <button type="button" onClick={() => setTimesOfDay(timesOfDay.filter((_, idx) => idx !== i))} className="px-2 text-slate-400">
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setTimesOfDay([...timesOfDay, '08:00'])} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    + Add time
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => setColor(c)}
                      className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-offset-slate-950' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </section>
        )}

        {review && phases.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Review</h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2">Weeks</th>
                    <th className="px-3 py-2">Dose</th>
                    <th className="px-3 py-2">Freq.</th>
                  </tr>
                </thead>
                <tbody>
                  {phasesToWeekRows(phases).map((row) => (
                    <tr key={row.phase.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{row.weekLabel}</td>
                      <td className="px-3 py-2">
                        {row.phase.dose} {row.phase.doseUnit}
                      </td>
                      <td className="px-3 py-2 capitalize">{row.phase.frequency.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                <div className="text-base font-semibold">{review.totalDoses}</div>
                total doses
              </div>
              <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                <div className="text-base font-semibold">{review.totalVialsNeeded}</div>
                vials needed
              </div>
              <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                <div className="text-base font-semibold">{review.endDate ?? '—'}</div>
                end date
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Total volume: {roundMlDisplay(review.totalVolumeMl)} mL
            </p>
          </section>
        )}

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="min-h-[48px] w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white disabled:opacity-40"
        >
          {isEdit ? 'Save changes' : 'Create protocol'}
        </button>
      </div>
    </div>
  )
}
