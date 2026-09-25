import { addDays, todayStr, type DateStr } from './dates'
import { generateFrequencyOccurrences } from './schedule'
import type { Supplement } from './types'

const HORIZON_DAYS = 365

/** Walks forward from today, consuming doseAmount per scheduled occurrence, until stock runs out. */
export function supplementRunOutDate(supplement: Pick<Supplement, 'frequency' | 'startDate' | 'doseAmount' | 'stockCount'>): DateStr | undefined {
  if (supplement.stockCount <= 0) return todayStr()
  const today = todayStr()
  const horizonEnd = addDays(today, HORIZON_DAYS)
  const occurrences = generateFrequencyOccurrences(supplement.frequency, supplement.startDate, today, horizonEnd)

  let remaining = supplement.stockCount
  for (const occ of occurrences) {
    remaining -= supplement.doseAmount
    if (remaining <= 1e-9) return occ.date
  }
  return undefined
}
