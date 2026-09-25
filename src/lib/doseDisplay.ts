// Bridges a scheduled dose (mcg/mg/IU/units) to what actually shows on the
// Today/Calendar cards and drives inventory consumption: mL to draw and
// syringe units, respecting blend component-basis dosing (scope doc §6).
import { componentBasisVolumeMl, concentrationMcgPerMl, mlFromUnits, toMcg, unitsFromMl, volumeMlForDose } from './calc'
import type { Compound, DoseBasis, DoseUnit, Product } from './types'

export interface DoseDisplayInput {
  dose: number
  doseUnit: DoseUnit
  product: Pick<Product, 'vialAmountMg' | 'components'>
  compound: Pick<Compound, 'iuPerMg'>
  doseBasis: DoseBasis
  basisComponent?: string
  bacMl: number
}

export interface DoseDisplay {
  volumeMl: number
  units: number
}

export function computeDoseDisplay(input: DoseDisplayInput): DoseDisplay {
  const { dose, doseUnit, product, compound, doseBasis, basisComponent, bacMl } = input

  if (doseUnit === 'units') {
    const volumeMl = mlFromUnits(dose)
    return { volumeMl, units: dose }
  }

  const doseMcg = toMcg(dose, doseUnit, compound.iuPerMg)

  if (doseBasis === 'component' && basisComponent && product.components) {
    const component = product.components.find((c) => c.name === basisComponent)
    if (component) {
      const volumeMl = componentBasisVolumeMl(doseMcg, component.mg, bacMl)
      return { volumeMl, units: unitsFromMl(volumeMl) }
    }
  }

  const concentration = concentrationMcgPerMl(product.vialAmountMg, bacMl)
  const volumeMl = volumeMlForDose(doseMcg, concentration)
  return { volumeMl, units: unitsFromMl(volumeMl) }
}
