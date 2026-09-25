import { Outlet } from 'react-router-dom'
import { useSettings } from '../../hooks/useSettings'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const settings = useSettings()

  return (
    <div className="mx-auto min-h-full max-w-2xl pb-20">
      <Outlet />
      <BottomNav showSupplements={settings.featureFlags.supplements} />
    </div>
  )
}
