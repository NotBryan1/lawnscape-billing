import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Download, CheckCircle, Repeat, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { itemsOf, billDate } from '../utils/bills'
import { generateBillsPDF } from '../utils/pdf'

const uuid = () => crypto.randomUUID()
const today = () => format(new Date(), 'yyyy-MM-dd')

// The services to recur from a customer's last bill (deduped by name, latest price).
function recurringItems(bill) {
  const byName = {}
  itemsOf(bill).forEach(i => { byName[i.name] = Number(i.price) })
  return Object.entries(byName).map(([name, price]) => ({ name, price }))
}

export default function MonthlyBilling() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [bills, setBills] = useState([])
  const [settings, setSettings] = useState({})
  const [bulkDate, setBulkDate] = useState(today())   // default service date
  const [dates, setDates] = useState({})              // per-customer date overrides
  const [selected, setSelected] = useState(() => new Set())
  const [generating, setGenerating] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    Promise.all([window.api.customers.getAll(), window.api.bills.getAll(), window.api.settings.get()])
      .then(([c, b, s]) => {
        setCustomers(c)
        setBills(b)
        setSettings(s)
        // Pre-select every active customer who has a previous bill to recur from.
        const eligibleIds = c.filter(cust => cust.active !== false && b.some(bill => bill.customerId === cust.id)).map(cust => cust.id)
        setSelected(new Set(eligibleIds))
      })
  }, [])

  // Each eligible customer + their most recent bill + the items that would recur.
  const eligible = customers
    .filter(customer => customer.active !== false) // skip discontinued customers
    .map(customer => {
      const theirs = bills.filter(b => b.customerId === customer.id)
      if (!theirs.length) return null
      const lastBill = [...theirs].sort((a, b) => billDate(b).localeCompare(billDate(a)))[0]
      const items = recurringItems(lastBill)
      const total = items.reduce((s, i) => s + i.price, 0)
      return { customer, lastBill, items, total }
    })
    .filter(Boolean)
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name))

  const noHistoryCount = customers.filter(c => c.active !== false).length - eligible.length
  const selectedEligible = eligible.filter(e => selected.has(e.customer.id))
  const grandTotal = selectedEligible.reduce((s, e) => s + e.total, 0)
  const allSelected = eligible.length > 0 && selectedEligible.length === eligible.length

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(eligible.map(e => e.customer.id)))
  }

  const effectiveDate = (id) => dates[id] ?? bulkDate
  const setCustomerDate = (id, value) => setDates(prev => ({ ...prev, [id]: value }))

  function buildBill(e) {
    const date = effectiveDate(e.customer.id)
    return {
      id: uuid(),
      customerId: e.customer.id,
      customerName: e.customer.name,
      customerAddress: e.customer.address || '',
      customerCity: e.customer.city || '',
      customerState: e.customer.state || '',
      customerZip: e.customer.zip || '',
      customerPhone: e.customer.phone || '',
      customerEmail: e.customer.email || '',
      date,
      workDays: [{ id: uuid(), date, items: e.items }],
      items: e.items,
      total: e.total,
      notes: '',
      payment: { method: '', checkNumber: '', amountPaid: 0 },
      paid: false,
      createdAt: new Date().toISOString(),
    }
  }

  async function generate() {
    if (!selectedEligible.length || generating) return
    setGenerating(true)
    try {
      const made = []
      for (const e of selectedEligible) {
        const bill = buildBill(e)
        await window.api.bills.save(bill)
        made.push(bill)
      }
      setCreated(made)
    } finally {
      setGenerating(false)
    }
  }

  async function downloadAll() {
    if (!created?.length) return
    const buf = await generateBillsPDF(created, settings)
    await window.api.pdf.save(buf, `bills-${bulkDate.slice(0, 7)}.pdf`)
  }

  // --- Success view ---
  if (created) {
    const total = created.reduce((s, b) => s + b.total, 0)
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
          <h1 className="text-xl font-bold text-gray-800">Created {created.length} {created.length === 1 ? 'bill' : 'bills'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            ${total.toFixed(2)} total
          </p>
          <div className="flex gap-2 justify-center mt-6">
            <button onClick={downloadAll} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 text-sm font-medium">
              <Download size={16} /> Download all as PDF
            </button>
            <button onClick={() => navigate('/history')} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium">
              View in Bill History <ChevronRight size={15} />
            </button>
          </div>
          <button onClick={() => { setCreated(null); setBulkDate(today()); setDates({}) }} className="text-xs text-gray-400 hover:text-gray-600 mt-5">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Monthly Billing</h1>
      <p className="text-sm text-gray-500 mb-5">Bill repeat customers in one go, using the services &amp; prices from their last bill.</p>

      {eligible.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <Repeat size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">No repeat customers yet</p>
          <p className="text-xs mt-1">Create a first bill for a customer in <button onClick={() => navigate('/new-bill')} className="underline">New Bill</button>, then they'll appear here.</p>
        </div>
      ) : (
        <>
          {/* Default date */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Default service date</label>
            <p className="text-xs text-gray-400 mb-2">Applies to everyone — adjust any customer's date individually below.</p>
            <div className="relative inline-block">
              <Calendar size={14} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={bulkDate}
                onChange={e => setBulkDate(e.target.value)}
                className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

          {/* Customer list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <button onClick={toggleAll} className="text-sm font-medium text-green-600 hover:text-green-700">
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
              <span className="text-xs text-gray-400">{selectedEligible.length} of {eligible.length} selected</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[45vh] overflow-y-auto">
              {eligible.map(e => {
                const isOn = selected.has(e.customer.id)
                return (
                  <div
                    key={e.customer.id}
                    className={`px-4 py-3 flex items-center gap-3 transition-colors ${isOn ? 'bg-green-50/50' : ''}`}
                  >
                    <button onClick={() => toggle(e.customer.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isOn ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                        {isOn && <Check size={13} className="text-white" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{e.customer.name}</p>
                        <p className="text-xs text-gray-400 truncate">{e.items.map(i => i.name).join(', ') || 'No services'}</p>
                      </div>
                    </button>
                    <input
                      type="date"
                      value={effectiveDate(e.customer.id)}
                      onChange={ev => setCustomerDate(e.customer.id, ev.target.value)}
                      disabled={!isOn}
                      title="Service date"
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs shrink-0 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-300"
                    />
                    <span className="text-sm font-semibold text-gray-700 shrink-0 w-16 text-right">${e.total.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {noHistoryCount > 0 && (
            <p className="text-xs text-gray-400 mb-4">
              {noHistoryCount} {noHistoryCount === 1 ? 'customer has' : 'customers have'} no past bill yet and aren't shown — bill them once from New Bill first.
            </p>
          )}

          {/* Generate */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-semibold uppercase tracking-wider">Total to bill</p>
              <p className="text-3xl font-bold text-green-800">${grandTotal.toFixed(2)}</p>
            </div>
            <button
              onClick={generate}
              disabled={!selectedEligible.length || generating}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
            >
              <Repeat size={16} />
              {generating ? 'Creating…' : `Create ${selectedEligible.length} ${selectedEligible.length === 1 ? 'bill' : 'bills'}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
