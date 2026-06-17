import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileDown, ChevronDown, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { generateBillPDF } from '../utils/pdf'

const DEFAULT_SERVICES = ['Mowing', 'Mulch', 'Trimming']

function freshItems() {
  return DEFAULT_SERVICES.map(name => ({
    id: crypto.randomUUID(),
    name,
    price: '',
    enabled: false,
    isDefault: true,
  }))
}

export default function NewBill() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [items, setItems] = useState(freshItems)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [settings, setSettings] = useState({})

  useEffect(() => {
    Promise.all([window.api.customers.getAll(), window.api.settings.get()]).then(([c, s]) => {
      setCustomers(c)
      setSettings(s)
    })
  }, [])

  // Load last bill's prices when customer changes
  useEffect(() => {
    if (!selectedId) { setItems(freshItems()); return }

    window.api.bills.getByCustomer(selectedId).then(bills => {
      const base = freshItems()
      if (bills.length === 0) { setItems(base); return }

      const last = bills[0]

      const updated = base.map(item => {
        const prev = last.items.find(i => i.name === item.name)
        return prev ? { ...item, price: String(prev.price), enabled: true } : item
      })

      const customs = last.items
        .filter(i => !DEFAULT_SERVICES.includes(i.name))
        .map(i => ({ id: crypto.randomUUID(), name: i.name, price: String(i.price), enabled: true, isDefault: false }))

      setItems([...updated, ...customs])
    })
  }, [selectedId])

  const enabledItems = items.filter(i => i.enabled && i.name.trim() && i.price !== '')
  const total = enabledItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)
  const customer = customers.find(c => c.id === selectedId)
  const canGenerate = !!selectedId && enabledItems.length > 0

  function toggle(id) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i))
  }
  function setPrice(id, v) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, price: v } : i))
  }
  function setName(id, v) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, name: v } : i))
  }
  function addCustom() {
    setItems(prev => [...prev, { id: crypto.randomUUID(), name: '', price: '', enabled: true, isDefault: false }])
  }
  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleGenerate() {
    if (!canGenerate) return
    setSaving(true)
    try {
      const bill = {
        id: crypto.randomUUID(),
        customerId: customer.id,
        customerName: customer.name,
        customerAddress: customer.address || '',
        customerCity: customer.city || '',
        customerState: customer.state || '',
        customerZip: customer.zip || '',
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
        date,
        items: enabledItems.map(i => ({ name: i.name, price: parseFloat(i.price) })),
        total,
        notes,
        createdAt: new Date().toISOString(),
      }

      const pdfBuffer = await generateBillPDF(bill, settings)
      const filename = `invoice-${customer.name.replace(/\s+/g, '-')}-${date}.pdf`
      const saved = await window.api.pdf.save(pdfBuffer, filename)

      if (saved) {
        await window.api.bills.save(bill)
        showToast('Bill saved and PDF exported!')
        setTimeout(() => navigate('/history'), 1800)
      }
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">New Bill</h1>

      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm font-medium animate-pulse">
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      <div className="space-y-4">
        {/* Customer */}
        <Card label="Customer">
          <div className="relative">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm appearance-none bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Select a customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
          </div>
          {customers.length === 0 && (
            <p className="text-xs text-amber-600 mt-1.5">
              No customers yet.{' '}
              <button onClick={() => navigate('/customers')} className="underline font-medium">Add one first.</button>
            </p>
          )}
        </Card>

        {/* Date */}
        <Card label="Date of Work">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </Card>

        {/* Services */}
        <Card
          label="Services"
          action={
            <button onClick={addCustom} className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
              <Plus size={12} /> Add custom
            </button>
          }
        >
          <div className="space-y-2.5">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 rounded accent-green-600 cursor-pointer shrink-0"
                />

                {item.isDefault ? (
                  <span className={`flex-1 text-sm ${item.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{item.name}</span>
                ) : (
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => setName(item.id, e.target.value)}
                    placeholder="Service name"
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    value={item.price}
                    onChange={e => setPrice(item.id, e.target.value)}
                    placeholder="0.00"
                    disabled={!item.enabled}
                    min="0"
                    step="0.01"
                    className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-300"
                  />
                </div>

                {!item.isDefault && (
                  <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Notes */}
        <Card label="Notes (optional)">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes to include on the bill…"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </Card>

        {/* Total + Generate */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-700 font-semibold uppercase tracking-wider">Total</p>
            <p className="text-3xl font-bold text-green-800">${total.toFixed(2)}</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || saving}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
          >
            <FileDown size={16} />
            {saving ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>
      </div>
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
