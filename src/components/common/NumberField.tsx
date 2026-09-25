import { useRef } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  placeholder?: string
  id?: string
}

/** Numeric input with a decimal keypad, select-all-on-focus, and +/- steppers (scope doc §8). */
export function NumberField({ label, value, onChange, step = 1, min, max, unit, placeholder, id }: NumberFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  function clamp(n: number): number {
    let v = n
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    return v
  }

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(Number((value - step).toFixed(6))))}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-slate-300 text-lg font-medium text-slate-700 active:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:active:bg-slate-800"
        >
          −
        </button>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={fieldId}
            type="number"
            inputMode="decimal"
            value={Number.isFinite(value) ? value : ''}
            placeholder={placeholder}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onChange(e.target.value === '' ? 0 : clamp(Number(e.target.value)))}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-12 text-right text-base tabular-nums dark:border-slate-700 dark:bg-slate-900"
          />
          {unit && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(Number((value + step).toFixed(6))))}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-slate-300 text-lg font-medium text-slate-700 active:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:active:bg-slate-800"
        >
          +
        </button>
      </div>
    </div>
  )
}
