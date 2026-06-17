import { useState, useEffect } from 'react'
import { Search, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import { billDate, parseDate, paymentOf, paymentStatus, paymentMethodLabel } from '../utils/bills'
import PaymentModal from '../components/PaymentModal'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]

export default function Payments() {
  const [bills, setBills] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [paymentBill, setPaymentBill] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setBills(await window.api.bills.getAll())
  }

  const q = search.trim().toLowerCase()
  let list = [...bills].sort((a, b) => billDate(b).localeCompare(billDate(a))) // most recent first
  if (filter !== 'all') list = list.filter(b => paymentStatus(b) === filter)
  if (q) list = list.filter(b => (b.customerName || '').toLowerCase().includes(q))

  const outstanding = bills.reduce((s, b) => s + Math.max(0, (Number(b.total) || 0) - paymentOf(b).amountPaid), 0)
  const collected = bills.reduce((s, b) => s + paymentOf(b).amountPaid, 0)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Payments</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Outstanding balance</p>
          <p className="text-2xl font-bold text-amber-800">${outstanding.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Total collected</p>
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
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer…"
            className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <CreditCard size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">No bills found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(bill => {
            const pay = paymentOf(bill)
            const status = paymentStatus(bill)
            const total = Number(bill.total) || 0
            const balance = Math.max(0, total - pay.amountPaid)
            return (
              <div key={bill.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 truncate">{bill.customerName}</p>
                    <StatusBadge status={status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(parseDate(billDate(bill)), 'MMM d, yyyy')} · Total ${total.toFixed(2)}
                    {pay.amountPaid > 0 && ` · Paid $${pay.amountPaid.toFixed(2)}`}
                    {pay.method && ` · ${paymentMethodLabel(pay.method)}${pay.method === 'check' && pay.checkNumber ? ` #${pay.checkNumber}` : ''}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {balance > 0
                    ? <p className="text-sm font-bold text-amber-700">${balance.toFixed(2)} <span className="font-normal text-gray-400 text-xs">due</span></p>
                    : <p className="text-sm font-medium text-green-600">Paid in full</p>}
                  <button onClick={() => setPaymentBill(bill)} className="mt-1 text-xs font-medium text-green-600 hover:text-green-700">
                    {pay.amountPaid > 0 ? 'Edit payment' : 'Record payment'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {paymentBill && <PaymentModal bill={paymentBill} onClose={() => setPaymentBill(null)} onSaved={load} />}
    </div>
  )
}

const STATUS_STYLES = { paid: 'bg-green-100 text-green-700', partial: 'bg-amber-100 text-amber-700', unpaid: 'bg-gray-100 text-gray-500' }
const STATUS_LABELS = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

function StatusBadge({ status }) {
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
}
