import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Compound, Product, Vial } from '../lib/types'

export interface Catalog {
  productsById: Map<string, Product>
  compoundsById: Map<string, Compound>
  compounds: Compound[]
}

/** Live query over the whole compound/product catalog — small enough to load in full. */
export function useCatalog(): Catalog {
  const data = useLiveQuery(async () => {
    const [products, compounds] = await Promise.all([db.products.toArray(), db.compounds.toArray()])
    return { products, compounds }
  }, [])

  const productsById = new Map((data?.products ?? []).map((p) => [p.id, p]))
  const compoundsById = new Map((data?.compounds ?? []).map((c) => [c.id, c]))
  return { productsById, compoundsById, compounds: data?.compounds ?? [] }
}

export function useVialsByProduct(productId: string | undefined): Vial[] {
  const vials = useLiveQuery(
    () => (productId ? db.vials.where('productId').equals(productId).toArray() : Promise.resolve<Vial[]>([])),
    [productId],
  )
  return vials ?? []
}

export function useAllVials(): Vial[] {
  const vials = useLiveQuery(() => db.vials.toArray(), [])
  return vials ?? []
}
