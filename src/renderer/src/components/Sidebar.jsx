import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, FilePlus, Repeat, History, CreditCard, BarChart3,
  Settings, HelpCircle, Leaf, Sun, Moon, Search, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useSettings } from '../SettingsContext'
import { useTheme } from '../ThemeContext'
import { useLang } from '../i18n'
import { isOverdue } from '../utils/bills'

// Left-hand nav: collapsible, groups routes under section labels, and shows
// a red overdue-bills badge on Payments. GROUPS is the single source of
// truth for both nav order and labels — add a route to App.jsx's <Routes>
// and a matching entry here to make it navigable.
const GROUPS = [
  { label: null, items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] },
  {
    label: 'Billing',
    items: [
      { to: '/new-bill', icon: FilePlus, label: 'New Bill' },
      { to: '/monthly-billing', icon: Repeat, label: 'Monthly Billing' },
      { to: '/history', icon: History, label: 'Bill History' },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/payments', icon: CreditCard, label: 'Payments', badge: 'overdue' },
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/help', icon: HelpCircle, label: 'Help' },
    ],
  },
]

export default function Sidebar() {
  const { settings } = useSettings()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLang()
  const location = useLocation()
  const [version, setVersion] = useState('')
  const [overdueCount, setOverdueCount] = useState(0)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1')
  const name = settings.businessName?.trim() || 'Lawnscape'

  useEffect(() => {
    window.api.appInfo?.version().then(setVersion).catch(() => {})
  }, [])

  // Refresh the overdue badge whenever the user changes pages.
  useEffect(() => {
    Promise.all([window.api.bills.getAll(), window.api.settings.get()])
      .then(([bills, s]) => {
        const days = Number(s.overdueDays) || 30
        setOverdueCount(bills.filter(b => isOverdue(b, days)).length)
      })
      .catch(() => {})
  }, [location.pathname])

  function toggleCollapsed() {
    setCollapsed(c => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1')
      return !c
    })
  }

  return (
    <aside className={`${collapsed ? 'w-[72px]' : 'w-56'} bg-green-800 dark:bg-gray-950 text-white flex flex-col shrink-0 transition-all duration-200`}>
      {/* Header */}
      <div className={`p-4 border-b border-green-700 dark:border-white/5 flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
        <Leaf className="text-green-300 dark:text-emerald-400 shrink-0" size={20} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight break-words">{name}</p>
            <p className="text-green-300 dark:text-gray-500 text-xs">{t('Billing Manager')}</p>
          </div>
        )}
        {!collapsed && (
          <button onClick={toggleCollapsed} title={t('Collapse sidebar')} className="p-1 rounded text-green-300 dark:text-gray-500 hover:text-white dark:hover:text-gray-200 shrink-0 transition-colors">
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={toggleCollapsed} title={t('Expand sidebar')} className="mx-auto mt-2 p-1.5 rounded text-green-300 dark:text-gray-500 hover:text-white dark:hover:text-gray-200 transition-colors">
          <PanelLeftOpen size={15} />
        </button>
      )}

      {/* Search / command palette */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
        title={t('Search (⌘K)')}
        className={`${collapsed ? 'mx-2 justify-center px-0' : 'mx-3 px-3'} mt-3 flex items-center gap-2 py-2 rounded-lg text-sm bg-green-900/50 dark:bg-white/5 text-green-200 dark:text-gray-400 hover:text-white dark:hover:text-gray-100 transition-colors`}
      >
        <Search size={15} className="shrink-0" />
        {!collapsed && <span className="flex-1 text-left">{t('Search…')}</span>}
        {!collapsed && <span className="text-[10px] border border-green-600 dark:border-white/10 rounded px-1 py-0.5 text-green-300 dark:text-gray-500">⌘K</span>}
      </button>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <p className="px-6 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-green-400 dark:text-gray-600">{t(group.label)}</p>
            )}
            {group.label && collapsed && <div className="mx-4 my-2 border-t border-green-700 dark:border-white/5" />}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? t(label) : undefined}
                  className={({ isActive }) =>
                    `relative flex items-center ${collapsed ? 'justify-center mx-2 px-0' : 'gap-3 mx-3 px-3'} py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-green-700 dark:bg-emerald-500/15 text-white dark:text-emerald-400 font-semibold'
                        : 'text-green-200 dark:text-gray-400 hover:bg-green-700/50 dark:hover:bg-white/5 hover:text-white dark:hover:text-gray-100'
                    }`
                  }
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && <span className="flex-1">{t(label)}</span>}
                  {badge === 'overdue' && overdueCount > 0 && !collapsed && (
                    <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{overdueCount}</span>
                  )}
                  {badge === 'overdue' && overdueCount > 0 && collapsed && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-green-700 dark:border-white/5">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? t('Light mode') : t('Dark mode')}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm text-green-200 dark:text-gray-400 hover:bg-green-700/50 dark:hover:bg-white/5 hover:text-white dark:hover:text-gray-100 transition-colors`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          {!collapsed && (theme === 'dark' ? t('Light mode') : t('Dark mode'))}
        </button>
        {version && !collapsed && <p className="text-xs text-green-500 dark:text-gray-600 px-3 pt-2">v{version}</p>}
      </div>
    </aside>
  )
}
