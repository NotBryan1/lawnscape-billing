import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Trash2, FileDown, CheckCircle, Check, ArrowLeft, ArrowRight, Calendar, Save, Search, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { generateBillPDF } from '../utils/pdf'
import { itemsOf, billDate, parseDate, workDaysOf, DEFAULT_SERVICES } from '../utils/bills'
import PdfPreviewModal from '../components/PdfPreviewModal'

const uuid = () => crypto.randomUUID()
const today = () => format(new Date(), 'yyyy-MM-dd')

function baseTemplate() {
  return DEFAULT_SERVICES.map(name => ({ name, price: '', enabled: false, isDefault: true }))
}

// Build a price template from the customer's most recent bill so prices carry over.
function templateFromBill(bill) {
  const tpl = baseTemplate()
  if (!bill) return tpl
  const priceByName = {}
  itemsOf(bill).forEach(i => { priceByName[i.name] = i.price })
  const updated = tpl.map(t =>
    priceByName[t.name] != null ? { ...t, price: String(priceByName[t.name]), enabled: true } : t
  )
  const customs = Object.keys(priceByName)
    .filter(n => !DEFAULT_SERVICES.includes(n))
    .map(n => ({ name: n, price: String(priceByName[n]), enabled: true, isDefault: false }))
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
        return { id: uuid(), name, price: found ? String(found.price) : '', enabled: !!found, isDefault: true }
      }),
      ...(d.items || []).filter(i => !DEFAULT_SERVICES.includes(i.name)).map(i => ({
        id: uuid(), name: i.name, price: String(i.price), enabled: true, isDefault: false,
      })),
    ],
  }))
}

const STEPS = ['Customer', 'Work Days', 'Services']

export default function NewBill() {
  const navigate = useNavigate()
  const location = useLocation()
  const editBill = location.state?.editBill || null
  // In edit mode, skip the first customer-change reset so the loaded days survive.
  const skipResetRef = useRef(!!editBill)

  const [step, setStep] = useState(editBill ? 2 : 0)
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState({})
  const [selectedId, setSelectedId] = useState(editBill?.customerId || '')
  const [search, setSearch] = useState('')
  const [template, setTemplate] = useState(() => (editBill ? templateFromBill(editBill) : baseTemplate()))
  const [workDays, setWorkDays] = useState(() => (editBill ? daysFromBill(editBill) : []))
  const [notes, setNotes] = useState(editBill?.notes || '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [previewBill, setPreviewBill] = useState(null)
  const [editId] = useState(editBill?.id || null)
  const [editMeta] = useState(editBill ? { createdAt: editBill.createdAt, paid: editBill.paid } : null)

  useEffect(() => {
    Promise.all([window.api.customers.getAll(), window.api.settings.get()]).then(([c, s]) => {
      setCustomers(c)
      setSettings(s)
    })
  }, [])

  // When the customer changes, seed one work day and pull in their last prices.
  useEffect(() => {
    if (!selectedId) { setWorkDays([]); setTemplate(baseTemplate()); return }

    // In edit mode the days are already loaded — just refresh the price template
    // (used when adding a brand-new day) without discarding the loaded work days.
    if (skipResetRef.current) {
      skipResetRef.current = false
      window.api.bills.getByCustomer(selectedId).then(bills => {
        const last = bills.length ? [...bills].sort((a, b) => billDate(b).localeCompare(billDate(a)))[0] : null
        setTemplate(templateFromBill(last))
      })
      return
    }

    const optimistic = baseTemplate()
    setTemplate(optimistic)
    setWorkDays([dayFromTemplate(optimistic, today())])

    window.api.bills.getByCustomer(selectedId).then(bills => {
      const last = bills.length
        ? [...bills].sort((a, b) => billDate(b).localeCompare(billDate(a)))[0]
        : null
      const tpl = templateFromBill(last)
      setTemplate(tpl)
      setWorkDays(prev => (prev.length ? prev : [{ date: today() }]).map(d => dayFromTemplate(tpl, d.date || today())))
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

  const enabledItems = (day) => day.items.filter(i => i.enabled && i.name.trim() && i.price !== '')
  const total = workDays.reduce((s, d) => s + enabledItems(d).reduce((ss, i) => ss + (parseFloat(i.price) || 0), 0), 0)
  const totalEnabled = workDays.reduce((n, d) => n + enabledItems(d).length, 0)

  const canStep1 = !!selectedId
  const canStep2 = workDays.length > 0 && workDays.every(d => !!d.date)
  const canSave = totalEnabled > 0 && !saving

  function buildBill() {
    const cleanDays = workDays
      .map(d => ({
        id: d.id,
        date: d.date,
        items: enabledItems(d).map(i => ({ name: i.name.trim(), price: parseFloat(i.price) })),
      }))
      .filter(d => d.items.length > 0)
    const flat = cleanDays.flatMap(d => d.items)
    const sum = flat.reduce((s, i) => s + i.price, 0)
    const primaryDate = [...cleanDays.map(d => d.date)].sort().slice(-1)[0]
    return {
      id: uuid(),
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
      paid: editMeta ? !!editMeta.paid : false,
      createdAt: editMeta ? editMeta.createdAt : new Date().toISOString(),
      ...(editId ? { updatedAt: new Date().toISOString() } : {}),
    }
  }

  async function save(withPdf) {
    if (!canSave) return
    setSaving(true)
    try {
      const bill = buildBill()
      await window.api.bills.save(bill)
      if (withPdf) {
        const buf = await generateBillPDF(bill, settings)
        const filename = `invoice-${bill.customerName.replace(/\s+/g, '-')}-${bill.date}.pdf`
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

  const filteredCustomers = [...customers]
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
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search customers…"
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
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
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      {(c.city || c.address) && (
                        <p className="text-xs text-gray-400">{[c.address, c.city, c.state].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                    {selectedId === c.id && <Check size={16} className="text-green-600 shrink-0" />}
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
          {workDays.map((day, idx) => (
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
            {totalEnabled === 0 && (
              <p className="text-xs text-gray-400 text-center mt-2">Check at least one service to save this bill.</p>
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
