import { Link } from 'react-router-dom'
import { GearIcon } from '../common/icons'

export function TopBar({ title }: { title: string }) {
  return (
    <header className="safe-top sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <h1 className="text-lg font-semibold">{title}</h1>
      <Link
        to="/settings"
        aria-label="Settings"
        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <GearIcon className="h-6 w-6" />
      </Link>
    </header>
  )
}
