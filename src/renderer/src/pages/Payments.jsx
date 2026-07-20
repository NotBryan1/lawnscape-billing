import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, CreditCard, ChevronDown } from 'lucide-react'
import { useLang, fmtDate } from '../i18n'
import { billDate, parseDate, paymentOf, paymentStatus, paymentMethodLabel, isOverdue } from '../utils/bills'
import PaymentModal from '../components/PaymentModal'

// Every bill viewed through a payment lens: status filters (unpaid/partial/
// overdue/paid), search, month/year, and a shortcut to record a payment.

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const PAGE = 25

export default function Payments() {
  const { t } = useLang()
  const location = useLocation()
  const [bills, setBills] = useState([])
  // Deep links (Dashboard's Overdue tile, command palette) can preset the filter.
  const [filter, setFilter] = useState(location.state?.filter || 'all')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const [settings, setSettings] = useState({})
  const [paymentBill, setPaymentBill] = useState(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (location.state?.filter) setFilter(location.state.filter)
  }, [location.state])

  async function load() {
    const [b, s] = await Promise.all([window.api.bills.getAll(), window.api.settings.get()])
    setBills(b)
    setSettings(s)
  }

  const overdueDays = Number(settings.overdueDays) || 30
  const years = [...new Set(bills.map(b => billDate(b).slice(0, 4)).filter(Boolean))].sort().reverse()

  const q = search.trim().toLowerCase()
  let list = [...bills].sort((a, b) => billDate(b).localeCompare(billDate(a))) // most recent first
  if (filter === 'overdue') list = list.filter(b => isOverdue(b, overdueDays))
  else if (filter !== 'all') list = list.filter(b => paymentStatus(b) === filter)
  if (year) list = list.filter(b => billDate(b).startsWith(year + '-'))
  if (month) list = list.filter(b => billDate(b).slice(5, 7) === month)
  if (q) list = list.filter(b => (b.customerName || '').toLowerCase().includes(q))

  // Picking a month/year shows the whole period; everything else pages 25 at a time.
  const dateFiltered = !!(month || year)
  const shown = dateFiltered ? list : list.slice(0, visible)
  const canShowMore = !dateFiltered && list.length > visible

  // Group the shown bills under "Month Year" headers.
  const groups = []
  shown.forEach(b => {
    const key = fmtDate(parseDate(billDate(b)), 'MMMM yyyy')
    let g = groups.find(g => g.key === key)
    if (!g) { g = { key, bills: [] }; groups.push(g) }
    g.bills.push(b)
  })

  const outstanding = bills.reduce((s, b) => s + Math.max(0, (Number(b.total) || 0) - paymentOf(b).amountPaid), 0)
  const collected = bills.reduce((s, b) => s + paymentOf(b).amountPaid, 0)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('Payments')}</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">{t('Outstanding balance')}</p>
          <p className="text-2xl font-bold text-amber-800">${outstanding.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">{t('Total collected')}</p>
          <p className="text-2xl font-bold text-green-800">${collected.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.value ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Dropdown value={month} onChange={setMonth}>
            <option value="">{t('All months')}</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{t(m)}</option>)}
          </Dropdown>
          <Dropdown value={year} onChange={setYear}>
            <option value="">{t('All years')}</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Dropdown>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search customer…')}
              className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>
      </div>

      {/* List grouped by month, each month on a grey panel so the bills pop */}
      {shown.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <CreditCard size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">{t('No bills found')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.key}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{group.key}</h2>
              <div className="bg-gray-200 rounded-xl p-2.5 space-y-2">
                {group.bills.map(bill => {
                  const pay = paymentOf(bill)
                  const status = paymentStatus(bill)
                  const total = Number(bill.total) || 0
                  const balance = Math.max(0, total - pay.amountPaid)
                  return (
                    <div key={bill.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 truncate">{bill.customerName}</p>
                          {bill.draft && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('Draft')}</span>}
                          <StatusBadge status={status} overdue={isOverdue(bill, overdueDays)} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {bill.invoiceNumber ? `#${bill.invoiceNumber} · ` : ''}{fmtDate(parseDate(billDate(bill)), 'MMM d, yyyy')} · {t('Total')} ${total.toFixed(2)}
                          {pay.amountPaid > 0 && ` · ${t('Paid')} $${pay.amountPaid.toFixed(2)}`}
                          {pay.method && ` · ${t(paymentMethodLabel(pay.method))}${pay.method === 'check' && pay.checkNumber ? ` #${pay.checkNumber}` : ''}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {balance > 0
                          ? <p className="text-sm font-bold text-amber-700">${balance.toFixed(2)} <span className="font-normal text-gray-400 text-xs">{t('due')}</span></p>
                          : <p className="text-sm font-medium text-green-600">{t('Paid in full')}</p>}
                        <button onClick={() => setPaymentBill(bill)} className="mt-1 text-xs font-medium text-green-600 hover:text-green-700">
                          {pay.amountPaid > 0 ? t('Edit payment') : t('Record payment')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {canShowMore && (
            <div className="text-center pt-1">
              <button
                onClick={() => setVisible(v => v + PAGE)}
                className="text-sm font-medium text-green-600 hover:text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-5 py-2 transition-colors inline-flex items-center gap-1.5"
              >
                <ChevronDown size={15} /> {t('Show more ({n} more)', { n: list.length - visible })}
              </button>
            </div>
          )}
        </div>
      )}

      {paymentBill && <PaymentModal bill={paymentBill} onClose={() => setPaymentBill(null)} onSaved={load} />}
    </div>
  )
}

const STATUS_STYLES = { paid: 'bg-green-100 text-green-700', partial: 'bg-amber-100 text-amber-700', unpaid: 'bg-gray-100 text-gray-500' }
const STATUS_LABELS = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

/** Payment-status pill; overdue takes visual priority over the underlying status. */
function StatusBadge({ status, overdue }) {
  const { t } = useLang()
  if (overdue) {
    return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('Overdue')}</span>
  }
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>{t(STATUS_LABELS[status])}</span>
}

/** Styled native <select> with a chevron icon, used for the month/year filter dropdowns. */
function Dropdown({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
      >
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
    </div>
  )
}
