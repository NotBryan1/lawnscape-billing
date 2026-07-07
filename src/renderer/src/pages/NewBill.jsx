import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Trash2, FileDown, CheckCircle, Check, ArrowLeft, ArrowRight, Calendar, Save, Search, Eye, X, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { generateBillPDF } from '../utils/pdf'
import { itemsOf, billDate, parseDate, workDaysOf, paymentOf, billSignature, DEFAULT_SERVICES, WEEKDAYS } from '../utils/bills'
import PdfPreviewModal from '../components/PdfPreviewModal'

const uuid = () => crypto.randomUUID()
const today = () => format(new Date(), 'yyyy-MM-dd')

function baseTemplate() {
  return DEFAULT_SERVICES.map(name => ({ name, price: '', enabled: false, isDefault: true }))
}

// Pre-fill services/prices from a customer's most recent bill so they carry over.
function templateFromBill(bill) {
  const tpl = baseTemplate()
  if (!bill) return tpl
  const priceByName = {}
  itemsOf(bill).forEach(i => { priceByName[i.name] = i.price })
  const updated = tpl.map(t =>
    priceByName[t.name] != null ? { ...t, price: Number(priceByName[t.name]).toFixed(2), enabled: true } : t
  )
  const customs = Object.keys(priceByName)
    .filter(n => !DEFAULT_SERVICES.includes(n))
    .map(n => ({ name: n, price: Number(priceByName[n]).toFixed(2), enabled: true, isDefault: false }))
  return [...updated, ...customs]
}

function dayFromTemplate(tpl, date) {
  return { id: uuid(), date, items: tpl.map(t => ({ ...t, id: uuid() })) }
}

// Convert an existing bill's work days into the wizard's editable item shape.
function daysFromBill(bill) {
  return workDaysOf(bill).map(d => ({
    id: uuid(),
    date: d.date,
    items: [
      ...DEFAULT_SERVICES.map(name => {
        const found = (d.items || []).find(i => i.name === name)
        return { id: uuid(), name, price: found ? Number(found.price).toFixed(2) : '', enabled: !!found, isDefault: true }
      }),
      ...(d.items || []).filter(i => !DEFAULT_SERVICES.includes(i.name)).map(i => ({
        id: uuid(), name: i.name, price: Number(i.price).toFixed(2), enabled: true, isDefault: false,
      })),
    ],
  }))
}

const STEPS = ['Customer', 'Work Days', 'Services']

export default function NewBill() {
  const navigate = useNavigate()
  const location = useLocation()
  const editBill = location.state?.editBill || null
  // Tracks which customer the current work days belong to, so we only reset on a
  // genuine customer change (and survive React StrictMode's double-invoked effects).
  const loadedForRef = useRef(editBill ? editBill.customerId : null)

  const [step, setStep] = useState(editBill ? 2 : 0)
  const [customers, setCustomers] = useState([])
  const [allBills, setAllBills] = useState([])
  const [settings, setSettings] = useState({})
  const [selectedId, setSelectedId] = useState(editBill?.customerId || '')
  const [search, setSearch] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [template, setTemplate] = useState(() => (editBill ? templateFromBill(editBill) : baseTemplate()))
  const [workDays, setWorkDays] = useState(() => (editBill ? daysFromBill(editBill) : []))
  const [notes, setNotes] = useState(editBill?.notes || '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [previewBill, setPreviewBill] = useState(null)
  const [dupPending, setDupPending] = useState(null)
  const [editId] = useState(editBill?.id || null)
  // Preserve the existing payment when editing (payment is edited in the Payments tab, not here).
  const [editMeta] = useState(editBill ? { createdAt: editBill.createdAt, periodStart: editBill.periodStart, periodEnd: editBill.periodEnd, ...paymentOf(editBill) } : null)

  useEffect(() => {
    Promise.all([window.api.customers.getAll(), window.api.settings.get(), window.api.bills.getAll()]).then(([c, s, b]) => {
      setCustomers(c)
      setSettings(s)
      setAllBills(b)
    })
  }, [])

  // When the customer changes, pre-fill the services, prices, and notes from their
  // most recent bill so they carry over.
  useEffect(() => {
    if (!selectedId) {
      setWorkDays([])
      setTemplate(baseTemplate())
      loadedForRef.current = null
      return
    }

    // Already initialized for this customer (edit-mode load, or StrictMode's second
    // effect pass) — just refresh the template, keep the loaded work days and notes.
    if (loadedForRef.current === selectedId) {
      window.api.bills.getByCustomer(selectedId).then(bills => {
        const last = bills.length ? [...bills].sort((a, b) => billDate(b).localeCompare(billDate(a)))[0] : null
        setTemplate(templateFromBill(last))
      })
      return
    }

    // Genuine customer change → seed one day pre-filled from their last bill.
    loadedForRef.current = selectedId
    setTemplate(baseTemplate())
    setWorkDays([dayFromTemplate(baseTemplate(), today())])
    setNotes('')
    window.api.bills.getByCustomer(selectedId).then(bills => {
      const last = bills.length ? [...bills].sort((a, b) => billDate(b).localeCompare(billDate(a)))[0] : null
      const tpl = templateFromBill(last)
      setTemplate(tpl)
      setWorkDays(prev => (prev.length ? prev : [{ date: today() }]).map(d => dayFromTemplate(tpl, d.date || today())))
      setNotes(last?.notes || '')
    })
  }, [selectedId])

  const customer = customers.find(c => c.id === selectedId)

  // --- per-day item editing ---
  const updateDay = (dayId, fn) => setWorkDays(prev => prev.map(d => (d.id === dayId ? fn(d) : d)))
  const toggle = (dayId, itemId) => updateDay(dayId, d => ({ ...d, items: d.items.map(i => i.id === itemId ? { ...i, enabled: !i.enabled } : i) }))
  const setPrice = (dayId, itemId, v) => updateDay(dayId, d => ({ ...d, items: d.items.map(i => i.id === itemId ? { ...i, price: v } : i) }))
  const setName = (dayId, itemId, v) => updateDay(dayId, d => ({ ...d, items: d.items.map(i => i.id === itemId ? { ...i, name: v } : i) }))
  const addCustom = (dayId) => updateDay(dayId, d => ({ ...d, items: [...d.items, { id: uuid(), name: '', price: '', enabled: true, isDefault: false }] }))
  const removeItem = (dayId, itemId) => updateDay(dayId, d => ({ ...d, items: d.items.filter(i => i.id !== itemId) }))
  const setDayDate = (dayId, v) => updateDay(dayId, d => ({ ...d, date: v }))

  // --- work day add/remove ---
  const addWorkDay = () => setWorkDays(prev => [...prev, dayFromTemplate(template, today())])
  const removeWorkDay = (dayId) => setWorkDays(prev => (prev.length > 1 ? prev.filter(d => d.id !== dayId) : prev))

  // Normalize a price to two decimals on blur ("50" -> "50.00").
  const normalizePrice = (dayId, itemId) => updateDay(dayId, d => ({
    ...d,
    items: d.items.map(i => {
      if (i.id !== itemId || i.price === '' || i.price == null) return i
      const n = parseFloat(i.price)
      return { ...i, price: isNaN(n) ? '' : n.toFixed(2) }
    }),
  }))

  const enabledItems = (day) => day.items.filter(i => i.enabled && i.name.trim() && i.price !== '')
  const total = workDays.reduce((s, d) => s + enabledItems(d).reduce((ss, i) => ss + (parseFloat(i.price) || 0), 0), 0)

  // Every work day must have at least one selected service, each with an amount entered.
  const dayComplete = (day) => {
    const enabled = day.items.filter(i => i.enabled)
    return enabled.length > 0 && enabled.every(i => i.name.trim() && i.price !== '' && !isNaN(parseFloat(i.price)))
  }
  const allDaysComplete = workDays.length > 0 && workDays.every(dayComplete)

  const canStep1 = !!selectedId
  const canStep2 = workDays.length > 0 && workDays.every(d => !!d.date)
  const canSave = allDaysComplete && !saving

  // Show the Services step oldest → newest, even if days were added out of order.
  const orderedDays = [...workDays].sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  function buildBill() {
    const cleanDays = workDays
      .map(d => ({
        id: d.id,
        date: d.date,
        items: enabledItems(d).map(i => ({ name: i.name.trim(), price: parseFloat(i.price) })),
      }))
      .filter(d => d.items.length > 0)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')) // store oldest → newest
    const flat = cleanDays.flatMap(d => d.items)
    const sum = flat.reduce((s, i) => s + i.price, 0)
    const primaryDate = [...cleanDays.map(d => d.date)].sort().slice(-1)[0]
    // Preserve the existing payment when editing; new bills start unpaid.
    const amountPaid = editId ? (editMeta.amountPaid || 0) : 0
    return {
      id: editId || uuid(),
      customerId: customer.id,
      customerName: customer.name,
      customerAddress: customer.address || '',
      customerCity: customer.city || '',
      customerState: customer.state || '',
      customerZip: customer.zip || '',
      customerPhone: customer.phone || '',
      customerEmail: customer.email || '',
      date: primaryDate,
      workDays: cleanDays,
      items: flat,
      total: sum,
      notes,
      payment: editId
        ? { method: editMeta.method, checkNumber: editMeta.checkNumber, amountPaid }
        : { method: '', checkNumber: '', amountPaid: 0 },
      paid: amountPaid > 0 && amountPaid >= sum,
      createdAt: editId ? editMeta.createdAt : new Date().toISOString(),
      ...(editId && editMeta.periodStart ? { periodStart: editMeta.periodStart, periodEnd: editMeta.periodEnd } : {}),
      ...(editId ? { updatedAt: new Date().toISOString() } : {}),
    }
  }

  function save(withPdf) {
    if (!canSave) return
    const bill = buildBill()
    // Warn if an existing bill has the same customer, dates, and services.
    const sig = billSignature(bill)
    const dup = allBills.some(b => b.id !== editId && billSignature(b) === sig)
    if (dup) { setDupPending({ bill, withPdf }); return }
    doSave(bill, withPdf)
  }

  async function doSave(bill, withPdf) {
    setSaving(true)
    try {
      // Use the saved copy — the invoice number is assigned on save.
      const saved = await window.api.bills.save(bill)
      if (withPdf) {
        const buf = await generateBillPDF(saved, settings)
        const filename = `invoice-${saved.customerName.replace(/\s+/g, '-')}-${saved.date}.pdf`
        const saved = await window.api.pdf.save(buf, filename)
        const ok = editId ? 'Bill updated & PDF exported!' : 'Bill saved & PDF exported!'
        showToast(saved ? ok : 'Bill saved (PDF export canceled)')
      } else {
        showToast(editId ? 'Bill updated!' : 'Bill saved to customer profile!')
      }
      setTimeout(() => navigate('/history'), 1600)
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Which customers already have a bill dated in the current calendar month.
  const now = new Date()
  const billedThisMonth = new Set(
    allBills
      .filter(b => {
        const d = parseDate(billDate(b))
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .map(b => b.customerId)
  )

  const filteredCustomers = [...customers]
    .filter(c => c.active !== false) // discontinued customers aren't billed
    .filter(c => !dayFilter || c.serviceDay === dayFilter)
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-5">{editId ? 'Edit Bill' : 'New Bill'}</h1>

      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm font-medium">
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      <Stepper step={step} />

      {/* STEP 1 — Customer */}
      {step === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          {customers.length === 0 ? (
            <p className="text-sm text-amber-600 py-6 text-center">
              No customers yet.{' '}
              <button onClick={() => navigate('/customers')} className="underline font-medium">Add one first.</button>
            </p>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search customers…"
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <select
                  value={dayFilter}
                  onChange={e => setDayFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400 shrink-0"
                >
                  <option value="">All days</option>
                  {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors flex items-center justify-between ${
                      selectedId === c.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      {(c.city || c.address) && (
                        <p className="text-xs text-gray-400 truncate">{[c.address, c.city, c.state].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                    {billedThisMonth.has(c.id) ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        <Check size={11} /> Billed this month
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        <X size={11} /> No bill yet
                      </span>
                    )}
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No matches for "{search}"</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2 — Work Days */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500 mb-3">
            Add each day work was done at <span className="font-medium text-gray-700">{customer?.name}</span>'s property this billing period.
          </p>
          {customer?.notes && (
            <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-600">
              <span className="font-semibold">Customer note:</span> {customer.notes}
            </div>
          )}
          <div className="space-y-2">
            {workDays.map((d, i) => (
              <div key={d.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                <div className="relative flex-1">
                  <Calendar size={14} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={d.date}
                    onChange={e => setDayDate(d.id, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                {workDays.length > 1 && (
                  <button onClick={() => removeWorkDay(d.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addWorkDay} className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
            <Plus size={14} /> Add another day
          </button>
        </div>
      )}

      {/* STEP 3 — Services & Notes */}
      {step === 2 && (
        <div className="space-y-4">
          {orderedDays.map((day, idx) => (
            <Card
              key={day.id}
              label={
                <span className="flex items-center gap-2">
                  <Calendar size={14} className="text-green-600" />
                  {day.date ? format(parseDate(day.date), 'EEEE, MMM d, yyyy') : `Day ${idx + 1}`}
                </span>
              }
              action={
                <button onClick={() => addCustom(day.id)} className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                  <Plus size={12} /> Add custom
                </button>
              }
            >
              <div className="space-y-2.5">
                {day.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggle(day.id, item.id)}
                      className="h-4 w-4 rounded accent-green-600 cursor-pointer shrink-0"
                    />
                    {item.isDefault ? (
                      <span className={`flex-1 text-sm ${item.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{item.name}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => setName(day.id, item.id, e.target.value)}
                        placeholder="Service name"
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm text-gray-400">$</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={e => setPrice(day.id, item.id, e.target.value)}
                        onBlur={() => normalizePrice(day.id, item.id)}
                        placeholder="0.00"
                        disabled={!item.enabled}
                        min="0"
                        step="0.01"
                        className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-300"
                      />
                    </div>
                    {!item.isDefault && (
                      <button onClick={() => removeItem(day.id, item.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!dayComplete(day) && (
                <p className="text-xs text-amber-600 mt-2.5">Select at least one service and enter an amount for this day.</p>
              )}
            </Card>
          ))}

          <Card label="Notes (optional)">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes to include on the bill…"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </Card>

          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-green-700 font-semibold uppercase tracking-wider">Total</p>
                <p className="text-3xl font-bold text-green-800">${total.toFixed(2)}</p>
              </div>
              <button
                onClick={() => canSave && setPreviewBill(buildBill())}
                disabled={!canSave}
                className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Eye size={15} /> Preview
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => save(false)}
                disabled={!canSave}
                className="flex-1 flex items-center justify-center gap-2 border border-green-600 text-green-700 bg-white px-4 py-2.5 rounded-lg hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                <Save size={16} /> {saving ? 'Saving…' : (editId ? 'Save changes' : 'Save only')}
              </button>
              <button
                onClick={() => save(true)}
                disabled={!canSave}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
              >
                <FileDown size={16} /> {saving ? 'Working…' : 'Save & PDF'}
              </button>
            </div>
            {!allDaysComplete && (
              <p className="text-xs text-amber-600 text-center mt-2">Each work day needs at least one service with an amount.</p>
            )}
          </div>
        </div>
      )}

      {/* Wizard navigation */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-0 disabled:cursor-default transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
        {step < 2 && (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 ? !canStep1 : !canStep2}
            className="flex items-center gap-1.5 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
          >
            Next <ArrowRight size={15} />
          </button>
        )}
      </div>

      {previewBill && (
        <PdfPreviewModal
          bill={previewBill}
          settings={settings}
          onClose={() => setPreviewBill(null)}
          onDownload={() => { setPreviewBill(null); save(true) }}
          downloadLabel="Save & Download"
        />
      )}

      {dupPending && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setDupPending(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="font-semibold text-gray-800">Possible duplicate</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {dupPending.bill.customerName} already has a bill with the same dates and services. Create this one anyway?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDupPending(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => { const { bill, withPdf } = dupPending; setDupPending(null); doSave(bill, withPdf) }}
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
              >
                Create anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stepper({ step }) {
  return (
    <div className="flex items-center mb-5">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors ${
              i < step ? 'bg-green-600 text-white'
              : i === step ? 'bg-green-600 text-white ring-4 ring-green-100'
              : 'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i <= step ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 rounded ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function Card({ label, action, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {action}
      </div>
      {children}
    </div>
  )
}
