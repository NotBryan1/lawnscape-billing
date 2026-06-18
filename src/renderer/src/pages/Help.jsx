import { useState } from 'react'
import { LayoutDashboard, Users, FilePlus, Repeat, History, CreditCard, Settings as SettingsIcon, ChevronDown, Leaf, Moon } from 'lucide-react'

const SECTIONS = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    subtitle: 'Your at-a-glance overview',
    items: [
      'See your number of customers, the amount billed this month, and your most recent bills.',
      'Click "New Bill" any time to jump straight into creating a bill.',
    ],
  },
  {
    icon: Users,
    title: 'Customers',
    subtitle: 'Save and manage who you bill',
    items: [
      'Add, edit, or delete customers — name, address, phone, and email.',
      'Search by name, address, or phone, and sort by name, city, or ZIP code.',
      'Click a customer to see all their past bills and record payments.',
      'Discontinue a customer to stop billing them while keeping their full history — they move to a "Discontinued" section and can be reactivated anytime.',
    ],
  },
  {
    icon: FilePlus,
    title: 'New Bill',
    subtitle: 'Create an invoice step by step',
    items: [
      'Step 1 — pick the customer. A badge shows whether they already have a bill this month.',
      'Step 2 — add one or more work days (the dates the work was done).',
      'Step 3 — choose services and prices for each day. Lawn Mowing and Mulch are built in, or add your own.',
      'Services, prices, and notes pre-fill from the customer’s last bill, so repeat work is quick.',
      'Each work day needs at least one service with an amount before you can save.',
      'Preview the invoice first, then "Save only" (just record it) or "Save & PDF" (also export it).',
      'You can edit any past bill later — it updates in place instead of creating a duplicate.',
    ],
  },
  {
    icon: Repeat,
    title: 'Monthly Billing',
    subtitle: 'Bill all your repeat customers at once',
    items: [
      'Bills every repeat customer using the services and prices from their last bill.',
      'Set one service period (a date range) that applies to the whole batch.',
      'Check who to include, then create all the bills in a single click.',
      'Download the whole batch as one combined PDF to print or send.',
    ],
  },
  {
    icon: History,
    title: 'Bill History',
    subtitle: 'Find and manage past bills',
    items: [
      'Every bill, newest first, grouped by month.',
      'Filter by month and year, or type a customer’s name to search instantly.',
      'Preview, edit, re-download, or delete any bill.',
      'Use "Download all as PDF" to export a whole filtered month at once.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments',
    subtitle: 'Track who has paid',
    items: [
      'Record how each bill was paid: cash, check (with a check number), Zelle, or other.',
      'Enter full or partial amounts — a payment can never exceed the bill total.',
      'See your total outstanding balance and total collected at the top.',
      'Filter by status (paid / partial / unpaid), month, year, or customer name.',
    ],
  },
  {
    icon: SettingsIcon,
    title: 'Settings & backups',
    subtitle: 'Your business details and data',
    items: [
      'Set your business name, logo, phone, and email — these appear on every invoice.',
      'Back up all your data to a single file, and restore it later if needed.',
      'Your data is stored privately on this computer and is never uploaded anywhere.',
    ],
  },
  {
    icon: Moon,
    title: 'Light & dark mode',
    subtitle: 'Switch the look',
    items: [
      'Use the toggle at the bottom of the sidebar to switch between light and dark themes.',
      'Your choice is remembered the next time you open the app.',
    ],
  },
]

export default function Help() {
  const [open, setOpen] = useState(0)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <Leaf className="text-green-600 shrink-0" size={22} />
        <h1 className="text-2xl font-bold text-gray-800">How to use Lawnscape</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">A quick tour of everything the app can do — click a section to expand it.</p>

      <div className="space-y-2">
        {SECTIONS.map((s, i) => {
          const Icon = s.icon
          const isOpen = open === i
          return (
            <div key={s.title} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-green-600" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-800">{s.title}</span>
                  <span className="block text-xs text-gray-400">{s.subtitle}</span>
                </span>
                <ChevronDown size={17} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <ul className="pl-16 pr-5 pb-4 pt-0.5 space-y-2 list-disc marker:text-green-400">
                  {s.items.map((it, j) => (
                    <li key={j} className="text-sm text-gray-600 leading-relaxed">{it}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        Tip: back up your data regularly from Settings so you never lose your customers and bills.
      </p>
    </div>
  )
}
