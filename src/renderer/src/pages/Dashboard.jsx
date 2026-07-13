import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FilePlus, Users, DollarSign, FileText, ChevronRight, AlertTriangle,
  CalendarDays, Repeat, BarChart3, Download, Search, Check, Wallet,
} from 'lucide-react'
import { format } from 'date-fns'
import { useLang, fmtDate } from '../i18n'
import { itemsOf, billDate, parseDate, paymentOf, isOverdue } from '../utils/bills'
import PaymentModal from '../components/PaymentModal'

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [bills, setBills] = useState([])
  const [customers, setCustomers] = useState([])
  const [overdueDays, setOverdueDays] = useState(30)
  const [paymentBill, setPaymentBill] = useState(null)

  const load = useCallback(async () => {
    const [b, c, s] = await Promise.all([
      window.api.bills.getAll(),
      window.api.customers.getAll(),
      window.api.settings.get(),
    ])
    setBills(b)
    setCustomers(c)
    setOverdueDays(Number(s.overdueDays) || 30)
  }, [])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayName = format(now, 'EEEE')

  const balanceOf = (b) => Math.max(0, (Number(b.total) || 0) - paymentOf(b).amountPaid)
  const monthKey = format(now, 'yyyy-MM')
  const monthBills = bills.filter(b => billDate(b).startsWith(monthKey))
  const monthBilled = monthBills.reduce((s, b) => s + (Number(b.total) || 0), 0)
  const monthCollected = monthBills.reduce((s, b) => s + paymentOf(b).amountPaid, 0)
  const collectedPct = monthBilled > 0 ? Math.min(100, Math.round((monthCollected / monthBilled) * 100)) : 0
  const outstanding = bills.reduce((s, b) => s + balanceOf(b), 0)
  const overdueBills = bills.filter(b => isOverdue(b, overdueDays)).sort((a, b) => billDate(a).localeCompare(billDate(b)))
  const overdueTotal = overdueBills.reduce((s, b) => s + balanceOf(b), 0)
  const recentBills = bills.slice(0, 5)

  const activeCustomers = customers.filter(c => c.active !== false)
  const dueToday = activeCustomers.filter(c => c.serviceDay === todayName)
  const billedThisMonth = new Set(monthBills.map(b => b.customerId))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Greeting header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t(greeting)}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{fmtDate(now, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Search size={14} /> {t('Search')}
            <span className="text-[10px] border border-gray-200 rounded px-1 py-0.5">⌘K</span>
          </button>
          <button
            onClick={() => navigate('/new-bill')}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
          >
            <FilePlus size={16} /> {t('New Bill')}
          </button>
        </div>
      </div>

      {/* Stat tiles — each one is a shortcut */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Tile
          onClick={() => navigate('/history')}
          icon={<DollarSign size={18} className="text-green-600" />}
          iconBg="bg-green-50"
          label={t('Billed this month')}
          value={`$${monthBilled.toFixed(2)}`}
          sub={
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-600 rounded-full" style={{ width: `${collectedPct}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{t('{amount} collected · {pct}%', { amount: `$${monthCollected.toFixed(2)}`, pct: collectedPct })}</p>
            </div>
          }
        />
        <Tile
          onClick={() => navigate('/payments')}
          icon={<Wallet size={18} className="text-amber-600" />}
          iconBg="bg-amber-50"
          label={t('Outstanding')}
          value={`$${outstanding.toFixed(2)}`}
          sub={<p className="text-[11px] text-gray-400 mt-1">{t('across all unpaid bills')}</p>}
        />
        <Tile
          onClick={() => navigate('/payments', { state: { filter: 'overdue' } })}
          icon={<AlertTriangle size={18} className="text-red-600" />}
          iconBg="bg-red-50"
          label={t('Overdue')}
          value={`$${overdueTotal.toFixed(2)}`}
          valueClass={overdueBills.length ? 'text-red-600' : 'text-gray-800'}
          sub={<p className="text-[11px] text-gray-400 mt-1">{overdueBills.length === 1 ? t('{n} bill needs chasing', { n: overdueBills.length }) : t('{n} bills need chasing', { n: overdueBills.length })}</p>}
        />
        <Tile
          onClick={() => navigate('/customers')}
          icon={<Users size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          label={t('Customers')}
          value={activeCustomers.length}
          sub={<p className="text-[11px] text-gray-400 mt-1">{customers.length - activeCustomers.length > 0 ? t('+{n} discontinued', { n: customers.length - activeCustomers.length }) : t('all active')}</p>}
        />
      </div>

      {/* Today's route + Needs attention */}
      <div className="grid grid-cols-2 gap-4 mb-6 items-stretch">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
              <CalendarDays size={15} className="text-green-600" /> {t("Today's route")} · {t(todayName)}
            </h2>
            <span className="text-xs text-gray-400">{dueToday.length} {dueToday.length === 1 ? t('stop') : t('stops')}</span>
          </div>
          {dueToday.length === 0 ? (
            <div className="flex-1 py-10 text-center text-gray-400 text-sm">
              {t('No customers scheduled for {day}s.', { day: t(todayName) })}
              <p className="text-xs mt-1">{t('Assign service days in')} <button onClick={() => navigate('/customers')} className="underline">{t('Customers')}</button>.</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto max-h-64">
              {dueToday.map((c, i) => (
                <li key={c.id} className={`flex items-center justify-between px-4 py-2.5 ${i < dueToday.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    {c.address && <p className="text-xs text-gray-400 truncate">{c.address}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {billedThisMonth.has(c.id) && (
                      <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check size={10} /> {t('billed')}
                      </span>
                    )}
                    <button
                      onClick={() => navigate('/new-bill', { state: { customerId: c.id } })}
                      className="text-xs font-medium bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1 transition-colors"
                    >
                      <FilePlus size={12} /> {t('Bill')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`bg-white rounded-xl shadow-sm border ${overdueBills.length ? 'border-red-100' : 'border-gray-100'} flex flex-col`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${overdueBills.length ? 'border-red-50' : 'border-gray-100'}`}>
            <h2 className={`font-semibold text-sm flex items-center gap-2 ${overdueBills.length ? 'text-red-700' : 'text-gray-700'}`}>
              <AlertTriangle size={15} /> {t('Needs attention')}
            </h2>
            {overdueBills.length > 0 && (
              <button onClick={() => navigate('/payments', { state: { filter: 'overdue' } })} className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                {t('All overdue')} <ChevronRight size={13} />
              </button>
            )}
          </div>
          {overdueBills.length === 0 ? (
            <div className="flex-1 py-10 text-center text-gray-400 text-sm">
              <Check size={28} className="mx-auto mb-2 text-green-500" />
              {t("Nothing overdue — you're all caught up.")}
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto max-h-64">
              {overdueBills.slice(0, 6).map((bill, i) => (
                <li key={bill.id} className={i < Math.min(overdueBills.length, 6) - 1 ? 'border-b border-gray-50' : ''}>
                  <button
                    onClick={() => setPaymentBill(bill)}
                    title="Record a payment"
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-red-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {bill.customerName}
                        {bill.invoiceNumber && <span className="text-xs text-gray-400 font-normal"> · #{bill.invoiceNumber}</span>}
                      </p>
                      <p className="text-xs text-gray-400">{fmtDate(parseDate(billDate(bill)), 'MMM d, yyyy')}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600 shrink-0 ml-3">${balanceOf(bill).toFixed(2)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <QuickAction icon={Repeat} label={t('Run Monthly Billing')} desc={t('Bill all repeat customers')} onClick={() => navigate('/monthly-billing')} />
        <QuickAction icon={BarChart3} label={t('View Reports')} desc={t('Income by month & customer')} onClick={() => navigate('/reports')} />
        <QuickAction icon={Download} label={t('Back up data')} desc={t('Save everything to one file')} onClick={() => window.api.data.export()} />
      </div>

      {/* Recent bills */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm">{t('Recent Bills')}</h2>
          <button onClick={() => navigate('/history')} className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
            {t('View all')} <ChevronRight size={13} />
          </button>
        </div>
        {recentBills.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm font-medium">{t('No bills yet')}</p>
            <p className="text-xs mt-1">{t('Create your first bill to get started')}</p>
          </div>
        ) : (
          <ul>
            {recentBills.map((bill, i) => (
              <li key={bill.id} className={`flex items-center justify-between px-4 py-3 ${i < recentBills.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {bill.customerName}
                    {bill.invoiceNumber && <span className="text-xs text-gray-400 font-normal"> · #{bill.invoiceNumber}</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{itemsOf(bill).map(it => t(it.name)).join(' · ')}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-semibold text-gray-800">${Number(bill.total).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{fmtDate(parseDate(billDate(bill)), 'MMM d, yyyy')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {paymentBill && <PaymentModal bill={paymentBill} onClose={() => setPaymentBill(null)} onSaved={load} />}
    </div>
  )
}

function Tile({ icon, iconBg, label, value, valueClass, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-green-200 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${iconBg}`}>{icon}</div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueClass || 'text-gray-800'}`}>{value}</p>
      {sub}
    </button>
  )
}

function QuickAction({ icon: Icon, label, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left flex items-center gap-3 hover:border-green-300 transition-colors"
    >
      <span className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-green-600" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        <span className="block text-xs text-gray-400 truncate">{desc}</span>
      </span>
    </button>
  )
}
