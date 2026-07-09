import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, FilePlus, Repeat, CreditCard, Download, Moon, Sun, User,
  LayoutDashboard, Users, History, BarChart3, Settings, HelpCircle, CornerDownLeft,
} from 'lucide-react'
import { useTheme } from '../ThemeContext'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Customers', icon: Users, to: '/customers' },
  { label: 'New Bill', icon: FilePlus, to: '/new-bill' },
  { label: 'Monthly Billing', icon: Repeat, to: '/monthly-billing' },
  { label: 'Bill History', icon: History, to: '/history' },
  { label: 'Payments', icon: CreditCard, to: '/payments' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
  { label: 'Settings', icon: Settings, to: '/settings' },
  { label: 'Help', icon: HelpCircle, to: '/help' },
]

// Global quick-launcher: ⌘K (or Ctrl+K) anywhere, or the sidebar Search button.
// Type a customer's name to bill/view them, or run any app action.
export default function CommandPalette() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [customers, setCustomers] = useState([])
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    window.api.customers.getAll().then(setCustomers).catch(() => {})
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const run = (fn) => { setOpen(false); fn() }

  const actionRows = [
    { label: 'Create a new bill', icon: FilePlus, kw: 'invoice add', go: () => navigate('/new-bill') },
    { label: 'Run monthly billing', icon: Repeat, kw: 'recurring batch bill everyone', go: () => navigate('/monthly-billing') },
    { label: 'Record a payment', icon: CreditCard, kw: 'paid money collect', go: () => navigate('/payments') },
    { label: 'Back up my data', icon: Download, kw: 'backup export save', go: () => window.api.data.export() },
    {
      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      icon: theme === 'dark' ? Sun : Moon,
      kw: 'theme appearance dark light',
      go: toggleTheme,
    },
  ].filter(a => !q || `${a.label} ${a.kw}`.toLowerCase().includes(q))

  const navRows = NAV
    .filter(n => !q || `go to ${n.label}`.toLowerCase().includes(q))
    .map(n => ({ label: `Go to ${n.label}`, icon: n.icon, go: () => navigate(n.to) }))

  const custRows = q
    ? customers
        .filter(c => c.active !== false && c.name.toLowerCase().includes(q))
        .slice(0, 5)
        .flatMap(c => [
          { label: `New bill for ${c.name}`, icon: FilePlus, go: () => navigate('/new-bill', { state: { customerId: c.id } }) },
          { label: `View ${c.name}`, icon: User, go: () => navigate('/customers', { state: { detailId: c.id } }) },
        ])
    : []

  const sections = []
  if (custRows.length) sections.push({ name: 'Customers', rows: custRows })
  if (actionRows.length) sections.push({ name: 'Actions', rows: actionRows })
  if (navRows.length) sections.push({ name: 'Go to', rows: navRows })
  const flat = sections.flatMap(s => s.rows)
  const activeIdx = Math.min(active, Math.max(0, flat.length - 1))

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % Math.max(1, flat.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + flat.length) % Math.max(1, flat.length)) }
    else if (e.key === 'Enter') { e.preventDefault(); const row = flat[activeIdx]; if (row) run(row.go) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  let idx = -1
  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-start justify-center pt-[14vh] p-4" onClick={() => setOpen(false)}>
      <div
        className="palette-in bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
          <Search size={17} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search customers, or type a command…"
            className="flex-1 bg-transparent text-sm text-gray-800 focus:outline-none"
          />
          <span className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-400">esc</span>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-1.5">
          {flat.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No matches for "{query}"</p>
          )}
          {sections.map(section => (
            <div key={section.name}>
              <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{section.name}</p>
              {section.rows.map(row => {
                idx++
                const i = idx
                const isActive = i === activeIdx
                const Icon = row.icon
                return (
                  <button
                    key={`${section.name}-${row.label}`}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(row.go)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${isActive ? 'bg-green-50 text-gray-800' : 'text-gray-600'}`}
                  >
                    <Icon size={16} className={isActive ? 'text-green-600' : 'text-gray-400'} />
                    <span className="flex-1 truncate">{row.label}</span>
                    {isActive && <CornerDownLeft size={13} className="text-gray-400" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
