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
import CommandPalette from './components/CommandPalette'
import { SettingsProvider } from './SettingsContext'
import { ThemeProvider } from './ThemeContext'
import { LanguageProvider } from './i18n'

// Root component: wraps the app in its three context providers (language,
// theme, business settings) and lays out the sidebar + routed page area.
// HashRouter (not BrowserRouter) because the renderer is loaded from a
// file:// URL in packaged builds, which has no server to resolve real paths.
export default function App() {
  return (
    <LanguageProvider>
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
          <CommandPalette />
        </div>
      </HashRouter>
    </SettingsProvider>
    </ThemeProvider>
    </LanguageProvider>
  )
}
