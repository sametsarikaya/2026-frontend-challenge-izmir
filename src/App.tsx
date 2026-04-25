import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/feedback/ToastProvider'
import { DashboardPage } from './pages/DashboardPage'
import { TimelinePage } from './pages/TimelinePage'
import { MapPage } from './pages/MapPage'
import { RoutePage } from './pages/RoutePage'

function App() {
  return (
    <ToastProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/route" element={<RoutePage />} />
        </Routes>
      </AppShell>
    </ToastProvider>
  )
}

export default App
