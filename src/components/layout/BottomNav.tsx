import { NavLink } from 'react-router-dom'
import { BoxIcon, CalendarIcon, CheckSquareIcon, ListIcon, PillIcon, SyringeIcon } from '../common/icons'

interface Tab {
  to: string
  label: string
  icon: (props: { className?: string }) => React.ReactElement
}

export function BottomNav({ showSupplements }: { showSupplements: boolean }) {
  const tabs: Tab[] = [
    { to: '/', label: 'Today', icon: CheckSquareIcon },
    { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
    { to: '/protocols', label: 'Protocols', icon: ListIcon },
    { to: '/inventory', label: 'Inventory', icon: BoxIcon },
    { to: '/tools', label: 'Tools', icon: SyringeIcon },
  ]
  if (showSupplements) {
    tabs.push({ to: '/supplements', label: 'Supps', icon: PillIcon })
  }

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <ul className="mx-auto flex max-w-2xl justify-around">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
