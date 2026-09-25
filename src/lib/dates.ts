// All dates in this app are local-calendar-day strings ("YYYY-MM-DD"), never UTC
// timestamps or Date objects that cross midnight boundaries. This file is the only
// place that should construct a Date from a date string, and it always does so at
// local noon to avoid DST / timezone off-by-one-day bugs.
import {
  addDays as fnsAddDays,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  isEqual,
  parse,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from 'date-fns'

export type DateStr = string // YYYY-MM-DD

const DATE_FMT = 'yyyy-MM-dd'

export function todayStr(): DateStr {
  return format(new Date(), DATE_FMT)
}

export function toDate(dateStr: DateStr): Date {
  // parse as local noon to dodge DST edge cases when doing arithmetic
  return parse(dateStr, DATE_FMT, new Date(2000, 0, 1))
}

export function fromDate(date: Date): DateStr {
  return format(date, DATE_FMT)
}

export function addDays(dateStr: DateStr, amount: number): DateStr {
  return fromDate(fnsAddDays(toDate(dateStr), amount))
}

export function diffDays(a: DateStr, b: DateStr): number {
  return differenceInCalendarDays(toDate(a), toDate(b))
}

export function isBeforeDate(a: DateStr, b: DateStr): boolean {
  return isBefore(toDate(a), toDate(b))
}

export function isAfterDate(a: DateStr, b: DateStr): boolean {
  return isAfter(toDate(a), toDate(b))
}

export function isSameOrBefore(a: DateStr, b: DateStr): boolean {
  return isBefore(toDate(a), toDate(b)) || isEqual(toDate(a), toDate(b))
}

export function isSameOrAfter(a: DateStr, b: DateStr): boolean {
  return isAfter(toDate(a), toDate(b)) || isEqual(toDate(a), toDate(b))
}

export function dayOfWeek(dateStr: DateStr): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return getDay(toDate(dateStr)) as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export function weekIndexSinceStart(startDate: DateStr, dateStr: DateStr): number {
  // 1-based week number relative to protocol start (week 1 = start week)
  const days = diffDays(dateStr, startDate)
  return Math.floor(days / 7) + 1
}

export function formatDisplay(dateStr: DateStr, fmt = 'MMM d, yyyy'): string {
  return format(toDate(dateStr), fmt)
}

export function monthGrid(year: number, month: number /* 0-based */): DateStr[] {
  const first = startOfMonth(new Date(year, month, 1))
  const last = endOfMonth(first)
  const gridStart = startOfWeek(first, { weekStartsOn: 0 })
  const gridEnd = fnsAddDays(startOfWeek(last, { weekStartsOn: 0 }), 6)
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map(fromDate)
}

export function isSameMonth(dateStr: DateStr, year: number, month: number): boolean {
  const d = toDate(dateStr)
  return d.getFullYear() === year && d.getMonth() === month
}
