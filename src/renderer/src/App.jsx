import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import NewBill from './pages/NewBill'
import MonthlyBilling from './pages/MonthlyBilling'
import BillHistory from './pages/BillHistory'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Help from './pages/Help'
import { SettingsProvider } from './SettingsContext'
import { ThemeProvider } from './ThemeContext'

export default function App() {
  return (
    <ThemeProvider>
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
              <Route path="/monthly-billing" element={<MonthlyBilling />} />
              <Route path="/history" element={<BillHistory />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </SettingsProvider>
    </ThemeProvider>
  )
}
