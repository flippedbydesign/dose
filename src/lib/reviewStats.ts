// Stats for the Protocol Builder's review screen (scope doc §5.4): total doses,
// total vials needed for the whole run, and projected end date.
import type { DateStr } from './dates'
import { computeDoseDisplay } from './doseDisplay'
import { deriveProtocolEndDate, generateSchedule } from './schedule'
import type { Compound, Phase, Product, Protocol } from './types'

export interface ProtocolReviewStats {
  endDate?: DateStr
  totalDoses: number
  totalVolumeMl: number
  totalVialsNeeded: number
}

export function computeProtocolReview(
  protocol: Pick<Protocol, 'startDate' | 'phases' | 'doseBasis' | 'basisComponent'>,
  product: Pick<Product, 'vialAmountMg' | 'components'>,
  compound: Pick<Compound, 'iuPerMg'>,
  bacMl: number,
  deadVolumeMl = 0,
): ProtocolReviewStats {
  const endDate = deriveProtocolEndDate(protocol)
  if (!endDate || protocol.phases.length === 0) {
    return { endDate, totalDoses: 0, totalVolumeMl: 0, totalVialsNeeded: 0 }
  }

  const occurrences = generateSchedule(
    { id: 'review', startDate: protocol.startDate, phases: protocol.phases, status: 'active' },
    protocol.startDate,
    endDate,
  )

  let totalVolumeMl = 0
  for (const occ of occurrences) {
    const display = computeDoseDisplay({
      dose: occ.plannedDose,
      doseUnit: occ.plannedUnit,
      product,
      compound,
      doseBasis: protocol.doseBasis,
      basisComponent: protocol.basisComponent,
      bacMl,
    })
    totalVolumeMl += display.volumeMl + deadVolumeMl
  }

  const totalVialsNeeded = bacMl > 0 ? Math.ceil(totalVolumeMl / bacMl - 1e-9) : 0

  return { endDate, totalDoses: occurrences.length, totalVolumeMl, totalVialsNeeded }
}

export interface WeekRow {
  phase: Phase
  weekLabel: string
}

export function phasesToWeekRows(phases: Phase[]): WeekRow[] {
  return phases
    .slice()
    .sort((a, b) => a.startWeek - b.startWeek)
    .map((phase) => ({
      phase,
      weekLabel: phase.startWeek === phase.endWeek ? `Wk ${phase.startWeek}` : `Wk ${phase.startWeek}–${phase.endWeek}`,
    }))
}
