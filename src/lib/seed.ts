// Seed compound library (scope doc §7). Names and categories only, plus known
// vial-size hints — no default doses or protocols are ever seeded. Every entry
// is user-editable and users can add their own custom compounds.
import type { Compound, CompoundCategory } from './types'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

let idCounter = 0
function single(
  name: string,
  category: CompoundCategory,
  commonVialSizesMg: number[],
  opts: { aliases?: string[]; iuPerMg?: number; notes?: string } = {},
): Compound {
  idCounter++
  return {
    id: `seed-${slugify(name)}-${idCounter}`,
    name,
    category,
    kind: 'single',
    commonVialSizesMg,
    isUserDefined: false,
    ...opts,
  }
}

function blend(
  name: string,
  components: { name: string; mgPerVial: number }[],
  opts: { notes?: string } = {},
): Compound {
  idCounter++
  const total = components.reduce((sum, c) => sum + c.mgPerVial, 0)
  return {
    id: `seed-${slugify(name)}-${idCounter}`,
    name,
    category: 'Blend',
    kind: 'blend',
    components,
    commonVialSizesMg: total > 0 ? [total] : [],
    isUserDefined: false,
    ...opts,
  }
}

export const SEED_COMPOUNDS: Compound[] = [
  // ---- Healing / recovery ----
  single('BPC-157', 'Healing / recovery', [5, 10], { notes: '+2 other common sizes, various' }),
  single('TB-500 (Thymosin Beta-4)', 'Healing / recovery', [5, 10], { aliases: ['Thymosin Beta-4'] }),
  single('KPV', 'Healing / recovery', [10]),
  single('GHK-Cu', 'Healing / recovery', [50, 100]),
  single('LL-37', 'Healing / recovery', [5]),
  single('ARA-290', 'Healing / recovery', [], { notes: 'various strengths' }),
  single('Thymosin Alpha-1', 'Healing / recovery', [], { notes: 'various strengths' }),

  // ---- Metabolic / GLP-1 & related ----
  single('Semaglutide', 'Metabolic / GLP-1 & related', [], { notes: '5 common strengths, various' }),
  single('Tirzepatide', 'Metabolic / GLP-1 & related', [], { notes: '11 common strengths, various' }),
  single('Retatrutide', 'Metabolic / GLP-1 & related', [5, 10, 20, 30], { notes: '+ other strengths' }),
  single('Cagrilintide', 'Metabolic / GLP-1 & related', [], { notes: 'various strengths' }),
  single('Mazdutide', 'Metabolic / GLP-1 & related', [], { notes: 'various strengths' }),
  single('Survodutide', 'Metabolic / GLP-1 & related', [10]),
  single('Eloralintide', 'Metabolic / GLP-1 & related', [10]),
  single('AOD-9604', 'Metabolic / GLP-1 & related', [], { notes: 'various strengths' }),
  single('5-Amino-1MQ', 'Metabolic / GLP-1 & related', [], { notes: 'various strengths' }),
  single('MOTS-C', 'Metabolic / GLP-1 & related', [5, 10, 20, 40]),
  single('SLU-PP-332', 'Metabolic / GLP-1 & related', [5]),
  single('AICAR', 'Metabolic / GLP-1 & related', [50]),
  single('Adipotide', 'Metabolic / GLP-1 & related', [], { notes: 'various strengths' }),
  single('L-Carnitine', 'Metabolic / GLP-1 & related', [200]),

  // ---- Growth hormone axis ----
  single('CJC-1295 (no DAC)', 'Growth hormone axis', [5]),
  single('CJC-1295 DAC', 'Growth hormone axis', [2, 5]),
  single('Ipamorelin', 'Growth hormone axis', [5], { notes: '+ other common sizes' }),
  single('Tesamorelin', 'Growth hormone axis', [5, 10, 20]),
  single('Sermorelin', 'Growth hormone axis', [], { notes: 'various strengths' }),
  single('GHRP-2', 'Growth hormone axis', [], { notes: 'various strengths' }),
  single('GHRP-6', 'Growth hormone axis', [], { notes: 'various strengths' }),
  single('HGH 191AA', 'Growth hormone axis', [10], {
    notes: 'IU-dosed — 10 IU vial; user must confirm IU/mg potency before dosing by mg',
  }),
  single('IGF-1 LR3', 'Growth hormone axis', [1]),
  single('MGF', 'Growth hormone axis', [5]),
  single('PEG-MGF', 'Growth hormone axis', [2]),

  // ---- Longevity / mitochondrial ----
  single('Epitalon (Epithalon)', 'Longevity / mitochondrial', [10], { aliases: ['Epithalon'] }),
  single('NAD+', 'Longevity / mitochondrial', [500, 1000]),
  single('SS-31', 'Longevity / mitochondrial', [], { notes: 'various strengths' }),
  single('Humanin', 'Longevity / mitochondrial', [10]),
  single('FOXO4-DRI', 'Longevity / mitochondrial', [10]),
  single('Glutathione', 'Longevity / mitochondrial', [600]),

  // ---- Cognitive / sleep / mood ----
  single('Selank', 'Cognitive / sleep / mood', [], { notes: 'various strengths' }),
  single('Semax', 'Cognitive / sleep / mood', [], { notes: 'various strengths' }),
  single('Adamax', 'Cognitive / sleep / mood', [10]),
  single('DSIP', 'Cognitive / sleep / mood', [], { notes: 'various strengths' }),
  single('Pinealon', 'Cognitive / sleep / mood', [20]),
  single('Cerebrolysin', 'Cognitive / sleep / mood', [60]),
  single('PE-22-28', 'Cognitive / sleep / mood', [10]),
  single('Oxytocin', 'Cognitive / sleep / mood', [], { notes: 'various strengths' }),

  // ---- Hormonal / sexual health ----
  single('PT-141', 'Hormonal / sexual health', [10]),
  single('Melanotan II', 'Hormonal / sexual health', [10]),
  single('Kisspeptin', 'Hormonal / sexual health', [10]),
  single('Gonadorelin', 'Hormonal / sexual health', [2]),
  single('HCG', 'Hormonal / sexual health', [], {
    notes: 'IU-dosed, various strengths — user must confirm IU/mg potency',
  }),
  single('HMG', 'Hormonal / sexual health', [75], {
    notes: 'IU-dosed — 75 IU vial; user must confirm IU/mg potency',
  }),

  // ---- Bioregulators (Khavinson peptides) ----
  single('Bronchogen', 'Bioregulators', [20]),
  single('Cardiogen', 'Bioregulators', [20]),
  single('Cartalax', 'Bioregulators', [], { notes: 'various strengths' }),
  single('Chonluten', 'Bioregulators', [20]),
  single('Cortagen', 'Bioregulators', [20]),
  single('Livagen', 'Bioregulators', [20]),
  single('Ovagen', 'Bioregulators', [20]),
  single('Prostamax', 'Bioregulators', [20]),
  single('Testagen', 'Bioregulators', [20]),
  single('Vesugen', 'Bioregulators', [20]),
  single('Vilon', 'Bioregulators', [20]),

  // ---- Bone ----
  single('Abaloparatide', 'Bone', [3]),
  single('Teriparatide', 'Bone', [0.75]),

  // ---- Cosmetic / other ----
  single('SNAP-8', 'Cosmetic / other', [10]),
  single('PNC-27', 'Cosmetic / other', [30]),

  // ---- Pre-defined blends ----
  blend('KLOW 80 mg', [
    { name: 'GHK-Cu', mgPerVial: 50 },
    { name: 'BPC-157', mgPerVial: 10 },
    { name: 'TB-500', mgPerVial: 10 },
    { name: 'KPV', mgPerVial: 10 },
  ]),
  blend('GLOW 70 mg', [], { notes: 'user to confirm components' }),
  blend('Tri-Heal 45 mg', [
    { name: 'TB-500', mgPerVial: 25 },
    { name: 'BPC-157', mgPerVial: 10 },
    { name: 'KPV', mgPerVial: 10 },
  ]),
  blend('BPC-157 + TB-500 10 mg', [
    { name: 'BPC-157', mgPerVial: 5 },
    { name: 'TB-500', mgPerVial: 5 },
  ]),
  blend('BPC-157 + TB-500 20 mg', [
    { name: 'BPC-157', mgPerVial: 10 },
    { name: 'TB-500', mgPerVial: 10 },
  ]),
  blend('CJC-1295 no DAC + Ipamorelin 10 mg', [
    { name: 'CJC-1295 (no DAC)', mgPerVial: 5 },
    { name: 'Ipamorelin', mgPerVial: 5 },
  ]),
  blend('Tesamorelin + Ipamorelin 10 mg', [
    { name: 'Tesamorelin', mgPerVial: 5 },
    { name: 'Ipamorelin', mgPerVial: 5 },
  ]),
  blend('CJC-1295 + GHRP-2 10 mg', [], { notes: 'user to confirm split' }),
  blend('Cagrilintide + Semaglutide 10 mg', [], { notes: 'user to confirm split' }),
  blend('AOD-9604 + CJC-1295 + Ipamorelin 12 mg', [], { notes: 'user to confirm split' }),
  blend('Neuroxelin 48 mg', [], { notes: 'user to confirm components' }),
]

export async function seedIfEmpty(db: { compounds: { count: () => Promise<number>; bulkPut: (items: Compound[]) => Promise<unknown> } }) {
  const count = await db.compounds.count()
  if (count === 0) {
    // bulkPut (not bulkAdd) so two concurrent bootstrap calls — e.g. React
    // StrictMode double-invoking the effect in dev — upsert idempotently
    // instead of racing into a duplicate-key ConstraintError.
    await db.compounds.bulkPut(SEED_COMPOUNDS)
  }
}
