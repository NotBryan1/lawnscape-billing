import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import NewBill from './pages/NewBill'
import BillHistory from './pages/BillHistory'
import Settings from './pages/Settings'
import { SettingsProvider } from './SettingsContext'

export default function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/new-bill" element={<NewBill />} />
              <Route path="/history" element={<BillHistory />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </SettingsProvider>
  )
}
