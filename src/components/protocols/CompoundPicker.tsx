import { useMemo, useState } from 'react'
import type { Compound } from '../../lib/types'

interface CompoundPickerProps {
  compounds: Compound[]
  selectedId: string | undefined
  onSelect: (compound: Compound) => void
}

export function CompoundPicker({ compounds, selectedId, onSelect }: CompoundPickerProps) {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? compounds.filter((c) => c.name.toLowerCase().includes(q) || c.aliases?.some((a) => a.toLowerCase().includes(q)))
      : compounds
    const map = new Map<string, Compound[]>()
    for (const c of filtered) {
      if (!map.has(c.category)) map.set(c.category, [])
      map.get(c.category)!.push(c)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [compounds, query])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search compounds…"
        className="mb-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
        {grouped.map(([category, list]) => (
          <div key={category}>
            <div className="sticky top-0 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {category}
            </div>
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={`flex min-h-[44px] w-full items-center justify-between px-3 text-left text-sm ${
                  selectedId === c.id ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : ''
                }`}
              >
                <span>{c.name}</span>
                {c.kind === 'blend' && <span className="text-xs text-slate-400">blend</span>}
              </button>
            ))}
          </div>
        ))}
        {grouped.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">No matches</p>}
      </div>
    </div>
  )
}
