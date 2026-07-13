import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Download, CheckCircle, Repeat, ChevronRight, ChevronDown, Search, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { itemsOf, billDate, parseDate, weekdayIndex, WEEKDAYS } from '../utils/bills'
import { generateBillsPDF } from '../utils/pdf'
import { useLang } from '../i18n'

const uuid = () => crypto.randomUUID()
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// The services to recur from a customer's last bill (deduped by name, latest price).
function recurringItems(bill) {
  const byName = {}
  itemsOf(bill).forEach(i => { byName[i.name] = Number(i.price) })
  return Object.entries(byName).map(([name, price]) => ({ name, price }))
}

// Every date in [from, to] on the customer's service day. No set day → single visit on the end date.
function visitDates(serviceDay, from, to) {
  const target = weekdayIndex(serviceDay)
  if (target < 0) return [to]
  const out = []
  const d = parseDate(from)
  const end = parseDate(to)
  while (d <= end) {
    if (d.getDay() === target) out.push(format(d, 'yyyy-MM-dd'))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export default function MonthlyBilling() {
  const navigate = useNavigate()
  const { t } = useLang()
  const now = new Date()
  const [customers, setCustomers] = useState([])
  const [bills, setBills] = useState([])
  const [settings, setSettings] = useState({})
  const [month, setMonth] = useState(now.getMonth())          // 0-11
  const [year, setYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [overrides, setOverrides] = useState({})              // customerId -> [dates]
  const [expandedId, setExpandedId] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    Promise.all([window.api.customers.getAll(), window.api.bills.getAll(), window.api.settings.get()])
      .then(([c, b, s]) => {
        setCustomers(c)
        setBills(b)
        setSettings(s)
        const eligibleIds = c.filter(cust => cust.active !== false && b.some(bill => bill.customerId === cust.id)).map(cust => cust.id)
        setSelected(new Set(eligibleIds))
      })
  }, [])

  // Changing the month resets any custom visit dates (the auto dates change).
  useEffect(() => { setOverrides({}); setExpandedId(null) }, [month, year])

  const fromDate = format(new Date(year, month, 1), 'yyyy-MM-dd')
  const toDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd')
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() + 1 - i)

  const visitsFor = (id, auto) => overrides[id] ?? auto
  const ym = `${year}-${String(month + 1).padStart(2, '0')}` // selected month, e.g. "2026-06"

  // Each active customer with a past bill, plus their recurring services, visit
  // dates, and whether they already have a bill for the selected month.
  const rows = customers
    .filter(c => c.active !== false)
    .map(customer => {
      const theirs = bills.filter(b => b.customerId === customer.id)
      if (!theirs.length) return null
      const lastBill = [...theirs].sort((a, b) => billDate(b).localeCompare(billDate(a)))[0]
      const items = recurringItems(lastBill)
      const perVisit = items.reduce((s, i) => s + i.price, 0)
      const auto = visitDates(customer.serviceDay, fromDate, toDate)
      const visits = visitsFor(customer.id, auto)
      const billed = theirs.some(b => billDate(b).slice(0, 7) === ym)
      return { customer, items, perVisit, visits, total: perVisit * visits.length, serviceDay: customer.serviceDay || '', billed }
    })
    .filter(Boolean)
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name))

  const q = search.trim().toLowerCase()
  const matches = r => (!dayFilter || r.serviceDay === dayFilter) && (!q || r.customer.name.toLowerCase().includes(q))
  const displayToBill = rows.filter(r => !r.billed && matches(r))
  const displayBilled = rows.filter(r => r.billed && matches(r))

  const noHistoryCount = customers.filter(c => c.active !== false).length - rows.length
  // Only un-billed customers can be selected/generated (no double-billing).
  const selectedRows = rows.filter(r => !r.billed && selected.has(r.customer.id) && r.visits.length > 0)
  const grandTotal = selectedRows.reduce((s, r) => s + r.total, 0)
  const displayBillable = displayToBill.filter(r => r.visits.length > 0)
  const allSelected = displayBillable.length > 0 && displayBillable.every(r => selected.has(r.customer.id))

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) displayBillable.forEach(r => next.delete(r.customer.id))
      else displayBillable.forEach(r => next.add(r.customer.id))
      return next
    })
  }

  // --- per-customer visit date editing ---
  function setVisit(r, idx, value) {
    setOverrides(prev => {
      const cur = prev[r.customer.id] ?? r.visits
      const next = [...cur]; next[idx] = value
      return { ...prev, [r.customer.id]: next }
    })
  }
  function addVisit(r) {
    setOverrides(prev => {
      const cur = prev[r.customer.id] ?? r.visits
      return { ...prev, [r.customer.id]: [...cur, toDate] }
    })
  }
  function removeVisit(r, idx) {
    setOverrides(prev => {
      const cur = prev[r.customer.id] ?? r.visits
      return { ...prev, [r.customer.id]: cur.filter((_, i) => i !== idx) }
    })
  }

  function buildBill(r) {
    const dates = [...r.visits].sort((a, b) => a.localeCompare(b))
    const workDays = dates.map(date => ({ id: uuid(), date, items: r.items }))
    const flat = workDays.flatMap(d => d.items)
    return {
      id: uuid(),
      customerId: r.customer.id,
      customerName: r.customer.name,
      customerAddress: r.customer.address || '',
      customerCity: r.customer.city || '',
      customerState: r.customer.state || '',
      customerZip: r.customer.zip || '',
      customerPhone: r.customer.phone || '',
      customerEmail: r.customer.email || '',
      date: toDate,
      periodStart: fromDate,
      periodEnd: toDate,
      workDays,
      items: flat,
      total: flat.reduce((s, i) => s + i.price, 0),
      notes: '',
      payment: { method: '', checkNumber: '', amountPaid: 0 },
      paid: false,
      createdAt: new Date().toISOString(),
    }
  }

  async function generate() {
    if (!selectedRows.length || generating) return
    setGenerating(true)
    try {
      const made = []
      for (const r of selectedRows) {
        // Use the saved copy — the invoice number is assigned on save.
        const saved = await window.api.bills.save(buildBill(r))
        made.push(saved)
      }
      setBills(await window.api.bills.getAll()) // refresh so they show as already billed
      setCreated(made)
    } finally {
      setGenerating(false)
    }
  }

  async function downloadAll() {
    if (!created?.length) return
    const buf = await generateBillsPDF(created, settings)
    await window.api.pdf.save(buf, `bills-${year}-${String(month + 1).padStart(2, '0')}.pdf`)
  }

  // --- Success view ---
  if (created) {
    const total = created.reduce((s, b) => s + b.total, 0)
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
          <h1 className="text-xl font-bold text-gray-800">{t(created.length === 1 ? 'Created {n} bill' : 'Created {n} bills', { n: created.length })}</h1>
          <p className="text-sm text-gray-500 mt-1">{t(MONTHS[month])} {year} · ${total.toFixed(2)} {t('total')}</p>
          <div className="flex gap-2 justify-center mt-6">
            <button onClick={downloadAll} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 text-sm font-medium">
              <Download size={16} /> {t('Download all as PDF')}
            </button>
            <button onClick={() => navigate('/history')} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium">
              {t('View in Bill History')} <ChevronRight size={15} />
            </button>
          </div>
          <button onClick={() => { setCreated(null); setOverrides({}) }} className="text-xs text-gray-400 hover:text-gray-600 mt-5">{t('Done')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{t('Monthly Billing')}</h1>
      <p className="text-sm text-gray-500 mb-5">{t('Bills each repeat customer for every visit on their service day in the month, using the services & prices from their last bill.')}</p>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <Repeat size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">{t('No repeat customers yet')}</p>
          <p className="text-xs mt-1">{t('Create a first bill for a customer in')} <button onClick={() => navigate('/new-bill')} className="underline">{t('New Bill')}</button>{t(", then they'll appear here.")}</p>
        </div>
      ) : (
        <>
          {/* Billing month */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Billing month')}</label>
            <p className="text-xs text-gray-400 mb-3">{t('Each customer is billed for every occurrence of their service day this month — each visit is dated on the invoice.')}</p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{t(m)}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Search + day filter */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('Search customers…')}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div className="relative">
              <select value={dayFilter} onChange={e => setDayFilter(e.target.value)} className="border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="">{t('All days')}</option>
                {WEEKDAYS.map(d => <option key={d} value={d}>{t(d)}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Customer list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <button onClick={toggleAll} className="text-sm font-medium text-green-600 hover:text-green-700">
                {allSelected ? t('Clear all') : t('Select all')}
              </button>
              <span className="text-xs text-gray-400">{t('{n} selected', { n: selectedRows.length })}</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[45vh] overflow-y-auto">
              {displayToBill.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {displayBilled.length ? t('Everyone matching is already billed for this month.') : t('No customers to bill.')}
                </p>
              ) : displayToBill.map(r => {
                const id = r.customer.id
                const canBill = r.visits.length > 0
                const isOn = canBill && selected.has(id)
                const expanded = expandedId === id
                const dayText = r.serviceDay ? t('{day}s', { day: t(r.serviceDay) }) : t('No set day')
                const visitText = canBill ? t(r.visits.length === 1 ? '{n} visit' : '{n} visits', { n: r.visits.length }) : t('no visits this month')
                return (
                  <div key={id} className={`transition-colors ${isOn ? 'bg-green-50' : ''} ${canBill ? '' : 'opacity-60'}`}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <button onClick={() => canBill && toggle(id)} disabled={!canBill} className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-not-allowed">
                        <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isOn ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                          {isOn && <Check size={13} className="text-white" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">{r.customer.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            <span className={canBill ? 'text-blue-600' : 'text-amber-600'}>{dayText} · {visitText}</span>
                            {r.items.length ? ` · ${r.items.map(i => t(i.name)).join(', ')}` : ''}
                          </p>
                        </div>
                      </button>
                      <span className="text-sm font-semibold text-gray-700 shrink-0 w-20 text-right">{canBill ? `$${r.total.toFixed(2)}` : '—'}</span>
                      {canBill && (
                        <button onClick={() => setExpandedId(expanded ? null : id)} title={t('Edit visit dates')} className="p-1.5 text-gray-400 hover:text-blue-600 shrink-0">
                          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {expanded && canBill && (
                      <div className="px-4 pb-3.5 pl-12">
                        <p className="text-xs text-gray-400 mb-2">{t('Visit dates — adjust if a service was done on a different day.')}</p>
                        <div className="space-y-1.5">
                          {r.visits.map((date, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="date"
                                value={date}
                                onChange={e => setVisit(r, idx, e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                              />
                              {r.visits.length > 1 && (
                                <button onClick={() => removeVisit(r, idx)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button onClick={() => addVisit(r)} className="mt-2 text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                          <Plus size={12} /> {t('Add a day')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Already billed this month — shown separately so they can't be billed twice */}
          {displayBilled.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                <Check size={14} className="text-green-600" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Already billed for {month} {year}', { month: t(MONTHS[month]), year })}</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[30vh] overflow-y-auto">
                {displayBilled.map(r => (
                  <div key={r.customer.id} className="px-4 py-3 flex items-center justify-between gap-3 opacity-70">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.customer.name}</p>
                      <p className="text-xs text-gray-400">{r.serviceDay ? t('{day}s', { day: t(r.serviceDay) }) : t('No set day')}</p>
                    </div>
                    <span className="text-[11px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                      <Check size={11} /> {t('Billed')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {noHistoryCount > 0 && (
            <p className="text-xs text-gray-400 mb-4">
              {t(noHistoryCount === 1
                ? "{n} customer has no past bill yet and aren't shown — bill them once from New Bill first."
                : "{n} customers have no past bill yet and aren't shown — bill them once from New Bill first.", { n: noHistoryCount })}
            </p>
          )}

          {/* Generate */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-semibold uppercase tracking-wider">{t('Total to bill')}</p>
              <p className="text-3xl font-bold text-green-800">${grandTotal.toFixed(2)}</p>
            </div>
            <button
              onClick={generate}
              disabled={!selectedRows.length || generating}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
            >
              <Repeat size={16} />
              {generating ? t('Creating…') : t(selectedRows.length === 1 ? 'Create {n} bill' : 'Create {n} bills', { n: selectedRows.length })}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
