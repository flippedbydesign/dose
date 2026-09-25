import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, getSettings } from '../lib/db'
import type { AppSettings } from '../lib/types'

export function useSettings(): AppSettings {
  // Read-only: liveQuery contexts must not write, so this never falls back to
  // getSettings() (which upserts a default row on first run — see db.ts's
  // bootstrap call in App.tsx instead).
  const settings = useLiveQuery(() => db.settings.get('settings'), [], DEFAULT_SETTINGS)
  return settings ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch })
}
