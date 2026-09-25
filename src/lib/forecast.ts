// Inventory forecast engine (scope doc §5.7 / §6). Walks forward through a
// list of already-scheduled dose consumptions (mL to draw per dose), against
// on-hand vial stock, to project run-out dates and vials still needed.
//
// This module is intentionally decoupled from compound/product lookup and
// Dexie: callers convert each scheduled dose to a drawn volume (mL) using
// calc.ts + the relevant Product/Vial's concentration, then pass the plain
// {date, volumeMl} list in here.
import type { DateStr } from './dates'

export interface DoseConsumption {
  date: DateStr
  volumeMl: number
}

export interface VialForecastInventory {
  /** mL remaining in the currently active (already reconstituted) vial, if any. */
  activeVialRemainingMl?: number
  /** Beyond-use date of the active vial, if any — flagged if it expires with product left. */
  activeVialBeyondUseDate?: DateStr
  /** Unopened vials on hand; each yields vialCapacityMl once reconstituted. */
  unopenedVialCount: number
}

export interface ForecastParams {
  /** Every scheduled dose from "now" through the horizon being forecast, sorted ascending. */
  doses: DoseConsumption[]
  /** mL of BAC water each vial is reconstituted with — its usable capacity. */
  vialCapacityMl: number
  /** Per-dose syringe/hub loss (scope doc default 0). */
  deadVolumeMl?: number
  inventory: VialForecastInventory
  /** If provided and later than the last date in `doses`, the horizon doesn't reach protocol end. */
  protocolEndDate?: DateStr
}

export interface BeyondUseWaste {
  beyondUseDate: DateStr
  wastedMl: number
}

export interface ForecastResult {
  totalVolumeNeededMl: number
  vialsNeededExact: number
  /** Total vials required to cover every dose in `doses`, rounded UP (never the reference site's round-down). */
  vialsNeededTotal: number
  /** Additional vials needed beyond what's already on hand (active vial fraction + unopened). */
  vialsStillNeeded: number
  bacWaterStillNeededMl: number
  /** Date the vial currently in use (active, or the first one opened) is exhausted. */
  currentVialRunOutDate?: DateStr
  /** Date all on-hand stock (active + unopened) is exhausted. Undefined if it outlasts `doses`. */
  allStockRunOutDate?: DateStr
  /** True only when protocolEndDate is known and on-hand + forecast doses reach it without running out. */
  coversFullProtocol: boolean
  syringeCount: number
  alcoholSwabCount: number
  beyondUseWaste?: BeyondUseWaste
}

const EPS = 1e-9

export function forecast(params: ForecastParams): ForecastResult {
  const { doses, vialCapacityMl, deadVolumeMl = 0, inventory, protocolEndDate } = params
  const { activeVialRemainingMl = 0, activeVialBeyondUseDate, unopenedVialCount } = inventory

  const totalOnHandMl = activeVialRemainingMl + unopenedVialCount * vialCapacityMl

  let cumulativeConsumed = 0
  let allStockRunOutDate: DateStr | undefined
  let onHandRemaining = totalOnHandMl

  // "current vial" = the active vial if one exists, otherwise the first vial
  // opened from unopened stock. We track its own remaining volume separately.
  let segmentRemaining = activeVialRemainingMl > 0 ? activeVialRemainingMl : vialCapacityMl
  const hasActiveVial = activeVialRemainingMl > 0
  let currentVialRunOutDate: DateStr | undefined
  let segmentExhausted = false

  let remainingAtBeyondUse: number | undefined
  const trackBeyondUse = hasActiveVial && !!activeVialBeyondUseDate

  for (const dose of doses) {
    const consumption = dose.volumeMl + deadVolumeMl
    cumulativeConsumed += consumption

    if (!segmentExhausted) {
      segmentRemaining -= consumption
      if (segmentRemaining <= EPS) {
        currentVialRunOutDate = dose.date
        segmentExhausted = true
      }
    }

    if (trackBeyondUse && remainingAtBeyondUse === undefined && dose.date >= activeVialBeyondUseDate!) {
      // remaining mL in the active vial as of just after this dose
      remainingAtBeyondUse = Math.max(0, activeVialRemainingMl - cumulativeConsumed)
    }

    if (allStockRunOutDate === undefined) {
      onHandRemaining -= consumption
      if (onHandRemaining <= EPS) {
        allStockRunOutDate = dose.date
      }
    }
  }

  // If there's no active vial, "current vial" run-out only applies once unopened stock exists.
  if (!hasActiveVial && unopenedVialCount === 0) {
    currentVialRunOutDate = undefined
  }

  const totalVolumeNeededMl = cumulativeConsumed
  const vialsNeededExact = vialCapacityMl > 0 ? totalVolumeNeededMl / vialCapacityMl : 0
  const vialsNeededTotal = Math.max(0, Math.ceil(vialsNeededExact - EPS))
  const onHandVialsEquivalent = vialCapacityMl > 0 ? activeVialRemainingMl / vialCapacityMl + unopenedVialCount : 0
  const vialsStillNeeded = Math.max(0, Math.ceil(vialsNeededExact - onHandVialsEquivalent - EPS))
  const bacWaterStillNeededMl = vialsStillNeeded * vialCapacityMl

  const lastDoseDate = doses.length > 0 ? doses[doses.length - 1].date : undefined
  const coversFullProtocol =
    !!protocolEndDate &&
    allStockRunOutDate === undefined &&
    !!lastDoseDate &&
    lastDoseDate >= protocolEndDate

  let beyondUseWaste: BeyondUseWaste | undefined
  if (activeVialBeyondUseDate && hasActiveVial) {
    // Would the vial still have product left when it hits its beyond-use date?
    const wouldExpireBeforeUsedUp =
      currentVialRunOutDate === undefined || activeVialBeyondUseDate < currentVialRunOutDate
    if (wouldExpireBeforeUsedUp) {
      const wasted = remainingAtBeyondUse ?? activeVialRemainingMl
      if (wasted > EPS) {
        beyondUseWaste = { beyondUseDate: activeVialBeyondUseDate, wastedMl: wasted }
      }
    }
  }

  return {
    totalVolumeNeededMl,
    vialsNeededExact,
    vialsNeededTotal,
    vialsStillNeeded,
    bacWaterStillNeededMl,
    currentVialRunOutDate,
    allStockRunOutDate,
    coversFullProtocol,
    syringeCount: doses.length,
    alcoholSwabCount: doses.length * 2,
    beyondUseWaste,
  }
}
