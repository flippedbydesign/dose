import type { Vial } from './types'

export function getActiveVial(vials: Vial[], productId: string): Vial | undefined {
  return vials.find((v) => v.productId === productId && v.status === 'reconstituted')
}

export function getUnopenedVials(vials: Vial[], productId: string): Vial[] {
  return vials.filter((v) => v.productId === productId && v.status === 'unopened')
}
