import { describe, expect, it } from 'vitest'
import { addDays, todayStr } from './dates'
import { supplementRunOutDate } from './supplementForecast'

describe('supplementRunOutDate', () => {
  it('returns today when stock is already zero', () => {
    const date = supplementRunOutDate({
      frequency: { type: 'daily', timesPerDay: 1 },
      startDate: todayStr(),
      doseAmount: 1,
      stockCount: 0,
    })
    expect(date).toBe(todayStr())
  })

  it('computes the day stock hits zero for a daily dose', () => {
    const today = todayStr()
    const date = supplementRunOutDate({
      frequency: { type: 'daily', timesPerDay: 1 },
      startDate: today,
      doseAmount: 1,
      stockCount: 10,
    })
    expect(date).toBe(addDays(today, 9)) // 10th dose, days 0..9
  })

  it('returns undefined when stock outlasts the horizon', () => {
    const today = todayStr()
    const date = supplementRunOutDate({
      frequency: { type: 'weekly', day: 1 },
      startDate: today,
      doseAmount: 1,
      stockCount: 10000,
    })
    expect(date).toBeUndefined()
  })
})
