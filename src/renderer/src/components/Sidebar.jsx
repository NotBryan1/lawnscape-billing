import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, FilePlus, Repeat, History, CreditCard, Settings, HelpCircle, Leaf, Sun, Moon } from 'lucide-react'
import { useSettings } from '../SettingsContext'
import { useTheme } from '../ThemeContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers',  icon: Users,           label: 'Customers' },
  { to: '/new-bill',  icon: FilePlus,         label: 'New Bill' },
  { to: '/monthly-billing', icon: Repeat,     label: 'Monthly Billing' },
  { to: '/history',   icon: History,          label: 'Bill History' },
  { to: '/payments',  icon: CreditCard,       label: 'Payments' },
  { to: '/settings',  icon: Settings,         label: 'Settings' },
  { to: '/help',      icon: HelpCircle,       label: 'Help' },
]

export default function Sidebar() {
  const { settings } = useSettings()
  const { theme, toggleTheme } = useTheme()
  const name = settings.businessName?.trim() || 'Lawnscape'

  return (
    <aside className="w-56 bg-green-800 dark:bg-gray-950 text-white flex flex-col shrink-0 transition-colors">
      <div className="p-5 border-b border-green-700 dark:border-white/5 flex items-center gap-2.5">
        <Leaf className="text-green-300 dark:text-emerald-400 shrink-0" size={20} />
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight break-words">{name}</p>
          <p className="text-green-300 dark:text-gray-500 text-xs">Billing Manager</p>
        </div>
      </div>

      <nav className="flex-1 py-3 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-green-700 dark:bg-emerald-500/15 text-white dark:text-emerald-400 font-semibold'
                  : 'text-green-200 dark:text-gray-400 hover:bg-green-700/50 dark:hover:bg-white/5 hover:text-white dark:hover:text-gray-100'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-green-700 dark:border-white/5">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-green-200 dark:text-gray-400 hover:bg-green-700/50 dark:hover:bg-white/5 hover:text-white dark:hover:text-gray-100 transition-colors"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <p className="text-xs text-green-500 dark:text-gray-600 px-3 pt-2">v1.0.0</p>
      </div>
    </aside>
  )
}
