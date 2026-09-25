import { diffDays, formatDisplay, todayStr } from '../../lib/dates'

interface RunwayBarProps {
  runOutDate?: string
  protocolEndDate?: string
  horizonDays?: number
}

export function RunwayBar({ runOutDate, protocolEndDate, horizonDays = 90 }: RunwayBarProps) {
  const today = todayStr()
  const runOutOffset = runOutDate ? Math.max(0, diffDays(runOutDate, today)) : horizonDays
  const endOffset = protocolEndDate ? Math.max(0, diffDays(protocolEndDate, today)) : undefined
  const maxOffset = Math.max(runOutOffset, endOffset ?? 0, 1)
  const runOutPct = Math.min(100, (runOutOffset / maxOffset) * 100)
  const endPct = endOffset !== undefined ? Math.min(100, (endOffset / maxOffset) * 100) : undefined

  return (
    <div>
      <div className="relative h-2.5 w-full overflow-visible rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-2.5 rounded-full ${runOutDate ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${runOutPct}%` }}
        />
        {endPct !== undefined && (
          <div className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-slate-900 dark:bg-slate-100" style={{ left: `${endPct}%` }} />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Today</span>
        <span>{runOutDate ? `runs out ${formatDisplay(runOutDate, 'MMM d')}` : 'stock lasts'}</span>
      </div>
    </div>
  )
}
