import { SYRINGE_CAPACITY_UNITS } from '../../lib/types'
import type { SyringeType } from '../../lib/types'

export function SyringeGraphic({ units, syringeType }: { units: number; syringeType: SyringeType }) {
  const capacity = SYRINGE_CAPACITY_UNITS[syringeType]
  const fillPct = Math.max(0, Math.min(1, units / capacity))
  const barWidth = 260
  const fillWidth = barWidth * fillPct

  return (
    <svg viewBox="0 0 300 70" className="w-full text-indigo-500">
      <rect x="10" y="24" width={barWidth} height="22" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <rect x="10" y="24" width={Math.max(fillWidth, 2)} height="22" rx="4" fill="currentColor" fillOpacity="0.55" />
      {/* tick marks every 10 units */}
      {Array.from({ length: Math.floor(capacity / 10) + 1 }, (_, i) => i * 10).map((tick) => (
        <line
          key={tick}
          x1={10 + (barWidth * tick) / capacity}
          y1={24}
          x2={10 + (barWidth * tick) / capacity}
          y2={46}
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
      ))}
      <rect x={barWidth + 10} y="18" width="8" height="34" fill="currentColor" fillOpacity="0.5" />
      <text x="10" y="64" className="fill-slate-500 text-[10px]" fontSize="10">
        0
      </text>
      <text x={barWidth} y="64" textAnchor="end" className="fill-slate-500 text-[10px]" fontSize="10">
        {capacity} units
      </text>
    </svg>
  )
}
