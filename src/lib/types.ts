// Core domain types for Dose — Peptide Protocol Tracker

export type CompoundCategory =
  | 'Healing / recovery'
  | 'Metabolic / GLP-1 & related'
  | 'Growth hormone axis'
  | 'Longevity / mitochondrial'
  | 'Cognitive / sleep / mood'
  | 'Hormonal / sexual health'
  | 'Bioregulators'
  | 'Bone'
  | 'Cosmetic / other'
  | 'Blend'
  | 'Custom'

export interface CompoundComponent {
  name: string
  mgPerVial: number
}

// Library entry (seeded, user-editable, user can add their own)
export interface Compound {
  id: string
  name: string
  aliases?: string[]
  category: CompoundCategory
  kind: 'single' | 'blend'
  components?: CompoundComponent[] // blends only
  commonVialSizesMg?: number[] // hints for the picker, not enforced
  iuPerMg?: number // only for IU-dosed compounds (e.g. HGH, HCG) — user must confirm
  notes?: string
  isUserDefined: boolean
}

export interface ProductComponent {
  name: string
  mg: number
}

// A physical vial type the user buys (compound + strength)
export interface Product {
  id: string
  compoundId: string
  vialAmountMg: number // total mg in vial (for blends: sum of components)
  components?: ProductComponent[] // copied from compound, editable
  label?: string
  // Planned BAC water volume for this vial type, set in the protocol builder.
  // Used to compute displayed syringe units before any vial has actually been
  // reconstituted (a Vial's own bacWaterMl, once set, always takes priority).
  defaultBacWaterMl?: number
}

export type VialStatus = 'unopened' | 'reconstituted' | 'empty' | 'discarded'

// Physical stock
export interface Vial {
  id: string
  productId: string
  status: VialStatus
  bacWaterMl?: number
  reconstitutedOn?: string // YYYY-MM-DD
  beyondUseDate?: string // YYYY-MM-DD
  remainingMl?: number // derived from logged doses, can be manually corrected
  lot?: string
  notes?: string
  createdAt: string // YYYY-MM-DD, when added to inventory
}

export type DoseUnit = 'mcg' | 'mg' | 'IU' | 'units'

export type Frequency =
  | { type: 'daily'; timesPerDay: number }
  | { type: 'weekdays'; days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[] } // e.g. Mon/Wed/Fri
  | { type: 'everyNDays'; n: number }
  | { type: 'weekly'; day: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'cycle'; onDays: number; offDays: number } // e.g. 5 on / 2 off

export interface Phase {
  id: string
  label?: string // "Loading", "Maintenance"
  startWeek: number // 1-based, relative to protocol start
  endWeek: number // inclusive
  dose: number
  doseUnit: DoseUnit
  frequency: Frequency
}

export type ProtocolStatus = 'active' | 'paused' | 'completed'
export type DoseBasis = 'total' | 'component'

export interface Protocol {
  id: string
  name: string
  productId: string
  startDate: string
  endDate?: string // derived from phases unless open-ended
  status: ProtocolStatus
  doseBasis: DoseBasis
  basisComponent?: string
  phases: Phase[]
  timeOfDay?: string[] // ["08:00"] or ["08:00","20:00"] for 2x/day
  color: string
  notes?: string
  pausedAt?: string // YYYY-MM-DD, date paused (for resume shifting)
}

export type InjectionSite =
  | 'abdomen-L' | 'abdomen-R'
  | 'thigh-L' | 'thigh-R'
  | 'glute-L' | 'glute-R'
  | 'arm-L' | 'arm-R'
  | 'other'

// One scheduled or logged administration
export interface DoseEvent {
  id: string
  protocolId: string
  date: string // YYYY-MM-DD
  slot: number // 0..timesPerDay-1
  plannedDose: number
  plannedUnit: DoseUnit
  actualDose?: number // defaults to planned when checked
  taken: boolean
  takenAt?: string // ISO time
  skipped?: boolean
  vialId?: string
  site?: InjectionSite
  notes?: string
  isOverride: boolean
}

// ---- Supplements (feature-flagged, simpler item type) ----

export type SupplementForm = 'capsule' | 'tablet' | 'powder' | 'liquid' | 'softgel'
export type SupplementUnit = 'caps' | 'g' | 'mg' | 'mL' | 'scoops'

export interface Supplement {
  id: string
  name: string
  form: SupplementForm
  doseAmount: number
  doseUnit: SupplementUnit
  stockCount: number
  frequency: Frequency
  timeOfDay?: string[]
  startDate: string
  status: ProtocolStatus
  color: string
  notes?: string
}

export interface SupplementDoseEvent {
  id: string
  supplementId: string
  date: string
  slot: number
  plannedAmount: number
  plannedUnit: SupplementUnit
  actualAmount?: number
  taken: boolean
  takenAt?: string
  skipped?: boolean
  notes?: string
  isOverride: boolean
}

// ---- Settings ----

export interface AppSettings {
  id: 'settings' // singleton row
  defaultSyringeType: SyringeType
  deadVolumeMl: number
  beyondUseDays: number
  featureFlags: {
    supplements: boolean
  }
  disclaimerAcknowledged: boolean
  theme: 'system' | 'light' | 'dark'
}

export type SyringeType = 'U100-1.0' | 'U100-0.5' | 'U100-0.3'

export const SYRINGE_CAPACITY_UNITS: Record<SyringeType, number> = {
  'U100-1.0': 100,
  'U100-0.5': 50,
  'U100-0.3': 30,
}
