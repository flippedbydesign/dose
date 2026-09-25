import { isSameMonth } from '../../lib/dates'
import type { MergedDoseEvent } from '../../lib/merge'
import type { Protocol } from '../../lib/types'

interface DayCell {
  date: string
  items: { protocol: Protocol; dose: MergedDoseEvent }[]
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface MonthGridProps {
  year: number
  month: number
  days: DayCell[]
  today: string
  selectedDate: string
  onSelectDate: (date: string) => void
}

export function MonthGrid({ year, month, days, today, selectedDate, onSelectDate }: MonthGridProps) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-semibold text-slate-400">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day.date, year, month)
          const isToday = day.date === today
          const isSelected = day.date === selectedDate
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={`flex min-h-[52px] flex-col items-center gap-1 rounded-lg py-1.5 ${
                isSelected
                  ? 'bg-indigo-600 text-white'
                  : isToday
                    ? 'bg-indigo-50 dark:bg-indigo-950/50'
                    : ''
              } ${!inMonth ? 'opacity-35' : ''}`}
            >
              <span className={`text-sm ${isSelected ? 'font-semibold' : ''}`}>{Number(day.date.slice(8, 10))}</span>
              <span className="flex flex-wrap justify-center gap-0.5 px-0.5">
                {day.items.slice(0, 6).map((item, i) => (
                  <Dot key={i} color={protocolColor(item, isSelected)} state={dotState(item.dose)} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function protocolColor(item: { protocol: Protocol }, isSelected: boolean): string {
  return isSelected ? 'white' : item.protocol.color
}

function dotState(dose: MergedDoseEvent): 'taken' | 'pending' | 'skipped' {
  if (dose.skipped) return 'skipped'
  if (dose.taken) return 'taken'
  return 'pending'
}

function Dot({ color, state }: { color: string; state: 'taken' | 'pending' | 'skipped' }) {
  if (state === 'skipped') {
    return (
      <span className="text-[8px] font-bold leading-none" style={{ color }}>
        ✕
      </span>
    )
  }
  return (
    <span
      className="block h-1.5 w-1.5 rounded-full"
      style={state === 'taken' ? { backgroundColor: color } : { border: `1.5px solid ${color}`, backgroundColor: 'transparent' }}
    />
  )
}
