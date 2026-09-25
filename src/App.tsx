import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DisclaimerGate } from './components/layout/DisclaimerGate'
import { UndoToastProvider } from './hooks/useUndoToast'
import { db, getSettings } from './lib/db'
import { seedIfEmpty } from './lib/seed'
import { CalendarScreen } from './screens/CalendarScreen'
import { InventoryScreen } from './screens/InventoryScreen'
import { ProtocolBuilderScreen } from './screens/ProtocolBuilderScreen'
import { ProtocolDetailScreen } from './screens/ProtocolDetailScreen'
import { ProtocolsListScreen } from './screens/ProtocolsListScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SupplementsScreen } from './screens/SupplementsScreen'
import { TodayScreen } from './screens/TodayScreen'
import { ToolsScreen } from './screens/ToolsScreen'

function App() {
  useEffect(() => {
    seedIfEmpty(db)
    getSettings()
  }, [])

  return (
    <UndoToastProvider>
      <DisclaimerGate>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<TodayScreen />} />
              <Route path="/calendar" element={<CalendarScreen />} />
              <Route path="/protocols" element={<ProtocolsListScreen />} />
              <Route path="/protocols/new" element={<ProtocolBuilderScreen />} />
              <Route path="/protocols/:id" element={<ProtocolDetailScreen />} />
              <Route path="/protocols/:id/edit" element={<ProtocolBuilderScreen />} />
              <Route path="/inventory" element={<InventoryScreen />} />
              <Route path="/tools" element={<ToolsScreen />} />
              <Route path="/supplements" element={<SupplementsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Route>
          </Routes>
        </HashRouter>
      </DisclaimerGate>
    </UndoToastProvider>
  )
}

export default App
