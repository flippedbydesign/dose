import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ListIcon } from '../components/common/icons'
import { TopBar } from '../components/layout/TopBar'
import { db } from '../lib/db'
import { formatDisplay } from '../lib/dates'
import type { ProtocolStatus } from '../lib/types'

const STATUS_STYLES: Record<ProtocolStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  completed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export function ProtocolsListScreen() {
  const navigate = useNavigate()
  const protocols = useLiveQuery(() => db.protocols.orderBy('startDate').reverse().toArray(), [])

  if (protocols === undefined) return null

  return (
    <div>
      <TopBar title="Protocols" />
      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() => navigate('/protocols/new')}
          className="mb-4 min-h-[44px] w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white active:bg-indigo-700"
        >
          + New protocol
        </button>

        {protocols.length === 0 ? (
          <EmptyState
            title="No protocols yet — create one"
            icon={<ListIcon className="h-10 w-10" />}
            action={{ label: 'Create protocol', onClick: () => navigate('/protocols/new') }}
          />
        ) : (
          <div className="space-y-2">
            {protocols.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/protocols/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="h-3 w-3 flex-none rounded-full" style={{ backgroundColor: p.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Started {formatDisplay(p.startDate)}
                    {p.endDate ? ` · ends ${formatDisplay(p.endDate)}` : ''}
                  </p>
                </div>
                <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>{p.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
