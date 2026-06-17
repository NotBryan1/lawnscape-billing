import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, FilePlus, History, Settings, Leaf } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers',  icon: Users,           label: 'Customers' },
  { to: '/new-bill',  icon: FilePlus,         label: 'New Bill' },
  { to: '/history',   icon: History,          label: 'Bill History' },
  { to: '/settings',  icon: Settings,         label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-green-800 text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-green-700 flex items-center gap-2.5">
        <Leaf className="text-green-300" size={20} />
        <div>
          <p className="font-bold text-sm leading-tight">Lawnscape</p>
          <p className="text-green-300 text-xs">Billing Manager</p>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-green-700 text-white font-semibold'
                  : 'text-green-200 hover:bg-green-700/50 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-green-700 text-xs text-green-500">
        v1.0.0
      </div>
    </aside>
  )
}
