import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { addDays, todayStr } from '../lib/dates'
import { computeDoseDisplay } from '../lib/doseDisplay'
import { forecast, type DoseConsumption, type ForecastResult } from '../lib/forecast'
import { generateSchedule } from '../lib/schedule'
import { getActiveVial, getUnopenedVials } from '../lib/vials'
import type { Compound, Product, Protocol, Vial } from '../lib/types'

const OPEN_ENDED_HORIZON_DAYS = 120

export interface ProductForecast {
  product: Product
  compound?: Compound
  protocols: Protocol[]
  vials: Vial[]
  activeVial?: Vial
  result?: ForecastResult
}

/** Live-computed forecast for every product that has vials and/or an active protocol. */
export function useInventoryForecast(): ProductForecast[] | undefined {
  return useLiveQuery(async () => {
    const [products, compounds, protocols, vials] = await Promise.all([
      db.products.toArray(),
      db.compounds.toArray(),
      db.protocols.toArray(),
      db.vials.toArray(),
    ])
    const compoundsById = new Map(compounds.map((c) => [c.id, c]))
    const today = todayStr()

    const results: ProductForecast[] = []
    for (const product of products) {
      const productVials = vials.filter((v) => v.productId === product.id && v.status !== 'discarded')
      const productProtocols = protocols.filter((p) => p.productId === product.id && p.status !== 'completed')
      if (productVials.length === 0 && productProtocols.length === 0) continue

      const compound = compoundsById.get(product.compoundId)
      const activeVial = getActiveVial(vials, product.id)
      const unopened = getUnopenedVials(vials, product.id)
      // Future unopened vials are assumed to be reconstituted the same way as
      // the active vial, or the most recent reconstituted history, or the
      // planned volume from the protocol builder if nothing's been reconstituted yet.
      const bacMl =
        activeVial?.bacWaterMl ?? productVials.find((v) => v.bacWaterMl)?.bacWaterMl ?? product.defaultBacWaterMl ?? 0

      let result: ForecastResult | undefined
      if (bacMl > 0) {
        const doses: DoseConsumption[] = []
        for (const protocol of productProtocols) {
          const end = protocol.endDate ?? addDays(today, OPEN_ENDED_HORIZON_DAYS)
          const occurrences = generateSchedule(protocol, today, end)
          for (const occ of occurrences) {
            const display = computeDoseDisplay({
              dose: occ.plannedDose,
              doseUnit: occ.plannedUnit,
              product,
              compound: compound ?? {},
              doseBasis: protocol.doseBasis,
              basisComponent: protocol.basisComponent,
              bacMl,
            })
            doses.push({ date: occ.date, volumeMl: display.volumeMl })
          }
        }
        doses.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

        const protocolEndDate =
          productProtocols.length > 0 && productProtocols.every((p) => p.endDate)
            ? productProtocols.reduce((max, p) => (p.endDate! > max ? p.endDate! : max), productProtocols[0].endDate!)
            : undefined

        result = forecast({
          doses,
          vialCapacityMl: bacMl,
          deadVolumeMl: 0,
          inventory: {
            activeVialRemainingMl: activeVial?.remainingMl,
            activeVialBeyondUseDate: activeVial?.beyondUseDate,
            unopenedVialCount: unopened.length,
          },
          protocolEndDate,
        })
      }

      results.push({ product, compound, protocols: productProtocols, vials: productVials, activeVial, result })
    }
    return results
  }, [])
}
