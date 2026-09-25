import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { TopBar } from '../components/layout/TopBar'
import {
  deleteProtocol,
  duplicateProtocol,
  endProtocolEarly,
  pauseProtocol,
  resumeProtocol,
} from '../lib/actions'
import { roundMcgDisplay, roundUnitsDisplay } from '../lib/calc'
import { db } from '../lib/db'
import { formatDisplay, todayStr } from '../lib/dates'
import { computeDoseDisplay } from '../lib/doseDisplay'
import { phasesToWeekRows } from '../lib/reviewStats'
import { getActiveVial } from '../lib/vials'

export function ProtocolDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirmAction, setConfirmAction] = useState<'delete' | 'end' | null>(null)

  const protocol = useLiveQuery(() => (id ? db.protocols.get(id) : undefined), [id])
  const product = useLiveQuery(() => (protocol ? db.products.get(protocol.productId) : undefined), [protocol?.productId])
  const compound = useLiveQuery(() => (product ? db.compounds.get(product.compoundId) : undefined), [product?.compoundId])
  const vials = useLiveQuery(() => (protocol ? db.vials.where('productId').equals(protocol.productId).toArray() : []), [protocol?.productId])

  if (!protocol || !id) return null

  const activeVial = vials ? getActiveVial(vials, protocol.productId) : undefined
  const bacMl = activeVial?.bacWaterMl ?? product?.defaultBacWaterMl ?? 1

  return (
    <div>
      <TopBar title={protocol.name} />
      <div className="space-y-5 px-4 py-4 pb-10">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: protocol.color }} />
          <span className="text-sm font-medium">{protocol.name}</span>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{protocol.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
            <p className="text-xs text-slate-500">Started</p>
            {formatDisplay(protocol.startDate)}
          </div>
          <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
            <p className="text-xs text-slate-500">{protocol.status === 'completed' ? 'Ended' : 'Projected end'}</p>
            {protocol.endDate ? formatDisplay(protocol.endDate) : 'open-ended'}
          </div>
        </div>

        {compound && product && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {compound.name} · {product.vialAmountMg} mg vial
            {activeVial && <> · reconstituted with {activeVial.bacWaterMl} mL</>}
          </div>
        )}

        <div>
          <h2 className="mb-2 text-sm font-semibold">Phases</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Weeks</th>
                  <th className="px-3 py-2">Dose</th>
                  <th className="px-3 py-2">Units</th>
                  <th className="px-3 py-2">Freq.</th>
                </tr>
              </thead>
              <tbody>
                {phasesToWeekRows(protocol.phases).map((row) => {
                  const display =
                    product && compound
                      ? computeDoseDisplay({
                          dose: row.phase.dose,
                          doseUnit: row.phase.doseUnit,
                          product,
                          compound,
                          doseBasis: protocol.doseBasis,
                          basisComponent: protocol.basisComponent,
                          bacMl,
                        })
                      : undefined
                  return (
                    <tr key={row.phase.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{row.weekLabel}</td>
                      <td className="px-3 py-2">
                        {row.phase.dose} {row.phase.doseUnit}
                      </td>
                      <td className="px-3 py-2">{display ? roundUnitsDisplay(display.units) : '—'}</td>
                      <td className="px-3 py-2 capitalize">{row.phase.frequency.type}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {product?.components && product.components.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold">Component breakdown (per unit)</h2>
            <div className="space-y-1 rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">
              {product.components.map((c) => (
                <p key={c.name}>
                  {c.name}: {roundMcgDisplay((c.mg * 1000) / bacMl / 100)} mcg/unit
                </p>
              ))}
            </div>
          </div>
        )}

        {protocol.notes && <p className="text-sm text-slate-600 dark:text-slate-400">{protocol.notes}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate(`/protocols/${id}/edit`)}
            className="min-h-[44px] rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
          >
            Edit
          </button>
          {protocol.status === 'active' && (
            <button type="button" onClick={() => pauseProtocol(id)} className="min-h-[44px] rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700">
              Pause
            </button>
          )}
          {protocol.status === 'paused' && (
            <button type="button" onClick={() => resumeProtocol(id)} className="min-h-[44px] rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700">
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              const newId = await duplicateProtocol(id, todayStr())
              navigate(`/protocols/${newId}`)
            }}
            className="min-h-[44px] rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
          >
            Duplicate
          </button>
          {protocol.status !== 'completed' && (
            <button type="button" onClick={() => setConfirmAction('end')} className="min-h-[44px] rounded-lg border border-amber-300 text-sm font-medium text-amber-700 dark:border-amber-800 dark:text-amber-400">
              End early
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmAction('delete')}
            className="col-span-2 min-h-[44px] rounded-lg border border-red-300 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-400"
          >
            Delete protocol
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Delete this protocol?"
        description="This removes the protocol and its entire dose log. This can't be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await deleteProtocol(id)
          navigate('/protocols')
        }}
      />
      <ConfirmDialog
        open={confirmAction === 'end'}
        title="End this protocol early?"
        description="Marks it completed as of today. Past history is kept."
        confirmLabel="End protocol"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await endProtocolEarly(id)
          setConfirmAction(null)
        }}
      />
    </div>
  )
}
