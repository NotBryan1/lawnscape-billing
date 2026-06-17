import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, User, X, ChevronDown, FileDown, FileText, Check, Eye, Pencil, Search } from 'lucide-react'
import { format } from 'date-fns'
import { generateBillPDF } from '../utils/pdf'
import { itemsOf, billDate, parseDate, workDaysOf, paymentOf, paymentStatus, paymentMethodLabel } from '../utils/bills'
import PdfPreviewModal from '../components/PdfPreviewModal'
import PaymentModal from '../components/PaymentModal'

const EMPTY = { name: '', address: '', city: '', state: '', zip: '', phone: '', email: '' }

const SORTS = {
  name: { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) },
  city: { label: 'City (A–Z)', fn: (a, b) => (a.city || '').localeCompare(b.city || '', undefined, { sensitivity: 'base' }) || a.name.localeCompare(b.name) },
  zip:  { label: 'ZIP code',   fn: (a, b) => (a.zip || '').localeCompare(b.zip || '', undefined, { numeric: true }) || a.name.localeCompare(b.name) },
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [bills, setBills] = useState([])
  const [settings, setSettings] = useState({})
  const [sortBy, setSortBy] = useState('name')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [detailId, setDetailId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [c, b, s] = await Promise.all([
      window.api.customers.getAll(),
      window.api.bills.getAll(),
      window.api.settings.get(),
    ])
    setCustomers(c)
    setBills(b)
    setSettings(s)
  }

  function openAdd() { setEditId(null); setForm(EMPTY); setShowModal(true) }
  function openEdit(c) { setEditId(c.id); setForm({ ...c }); setShowModal(true) }

  async function handleSave() {
    if (!form.name.trim()) return
    await window.api.customers.save({
      ...form,
      id: editId || crypto.randomUUID(),
      createdAt: editId
        ? customers.find(c => c.id === editId)?.createdAt
        : new Date().toISOString(),
    })
    setShowModal(false)
    load()
  }

  async function handleDelete() {
    await window.api.customers.delete(deleteId)
    setDeleteId(null)
    load()
  }

  function field(key) {
    return (v) => setForm(f => ({ ...f, [key]: v }))
  }

  const billsByCustomer = bills.reduce((acc, b) => {
    (acc[b.customerId] = acc[b.customerId] || []).push(b)
    return acc
  }, {})

  const q = search.trim().toLowerCase()
  const sorted = [...customers]
    .filter(c => !q || [c.name, c.address, c.city, c.state, c.zip, c.phone, c.email]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
    .sort(SORTS[sortBy].fn)
  const detailCustomer = customers.find(c => c.id === detailId)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>Sort: {v.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm">
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {customers.length > 0 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers by name, address, phone…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {customers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <User size={44} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium text-sm">No customers saved yet</p>
          <p className="text-xs mt-1">Click "Add Customer" to get started</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center text-gray-400">
          <Search size={36} className="mx-auto mb-2 opacity-25" />
          <p className="text-sm font-medium">No customers match "{search}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(c => {
            const cBills = billsByCustomer[c.id] || []
            const unpaid = cBills.filter(b => !b.paid).length
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-start justify-between hover:border-green-200 transition-colors">
                <button onClick={() => setDetailId(c.id)} className="text-left flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  {c.address && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {[c.address, c.city, c.state, c.zip].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                    <span className="text-xs text-green-700 font-medium">
                      {cBills.length} {cBills.length === 1 ? 'bill' : 'bills'}
                      {unpaid > 0 && <span className="text-amber-600"> · {unpaid} unpaid</span>}
                    </span>
                  </div>
                </button>
                <div className="flex gap-1 mt-0.5 shrink-0">
                  <button onClick={() => openEdit(c)} title="Edit" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => setDeleteId(c.id)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Customer detail / bill history */}
      {detailCustomer && (
        <CustomerDetail
          customer={detailCustomer}
          bills={(billsByCustomer[detailId] || [])}
          settings={settings}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal title={editId ? 'Edit Customer' : 'Add Customer'} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Field label="Full Name *" value={form.name} onChange={field('name')} placeholder="John Doe" />
            <Field label="Address" value={form.address} onChange={field('address')} placeholder="123 Main St" />
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2"><Field label="City" value={form.city} onChange={field('city')} placeholder="Springfield" /></div>
              <div><Field label="State" value={form.state} onChange={field('state')} placeholder="IL" /></div>
              <div className="col-span-2"><Field label="ZIP" value={form.zip} onChange={field('zip')} placeholder="62701" /></div>
            </div>
            <Field label="Phone" value={form.phone} onChange={field('phone')} placeholder="555-555-5555" />
            <Field label="Email" value={form.email} onChange={field('email')} placeholder="john@email.com" />
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={!form.name.trim()} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40">Save</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Delete Customer?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-500 mb-4">Their billing history will not be deleted.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CustomerDetail({ customer, bills, settings, onClose, onChanged }) {
  const navigate = useNavigate()
  const [previewBill, setPreviewBill] = useState(null)
  const [paymentBill, setPaymentBill] = useState(null)
  const sorted = [...bills].sort((a, b) => billDate(a).localeCompare(billDate(b)))

  async function reExport(bill) {
    const buf = await generateBillPDF(bill, settings)
    const name = `invoice-${bill.customerName.replace(/\s+/g, '-')}-${billDate(bill)}.pdf`
    await window.api.pdf.save(buf, name)
  }

  return (
    <>
    <Modal title={customer.name} onClose={onClose} wide>
      {[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).length > 0 && (
        <p className="text-sm text-gray-500 -mt-2 mb-4">
          {[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}
        </p>
      )}

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Past Bills</p>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-2 opacity-25" />
          <p className="text-sm">No bills issued yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {sorted.map(bill => {
            const days = workDaysOf(bill)
            const status = paymentStatus(bill)
            const pay = paymentOf(bill)
            return (
              <div key={bill.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {format(parseDate(billDate(bill)), 'MMMM d, yyyy')}
                      {days.length > 1 && <span className="text-gray-400 font-normal"> · {days.length} work days</span>}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {itemsOf(bill).map((item, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {item.name} — ${Number(item.price).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-800">${Number(bill.total).toFixed(2)}</p>
                    {pay.amountPaid > 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {status === 'partial' ? `Paid $${pay.amountPaid.toFixed(2)}` : 'Paid in full'}
                        {pay.method ? ` · ${paymentMethodLabel(pay.method)}${pay.method === 'check' && pay.checkNumber ? ` #${pay.checkNumber}` : ''}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                  <PaymentToggle status={status} onClick={() => setPaymentBill(bill)} />
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPreviewBill(bill)} className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 font-medium">
                      <Eye size={13} /> Preview
                    </button>
                    <button onClick={() => navigate('/new-bill', { state: { editBill: bill } })} className="text-xs text-gray-500 hover:text-amber-600 flex items-center gap-1 font-medium">
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => reExport(bill)} className="text-xs text-gray-500 hover:text-green-600 flex items-center gap-1 font-medium">
                      <FileDown size={13} /> Download
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
    {previewBill && (
      <PdfPreviewModal bill={previewBill} settings={settings} onClose={() => setPreviewBill(null)} downloadLabel="Download" />
    )}
    {paymentBill && (
      <PaymentModal bill={paymentBill} onClose={() => setPaymentBill(null)} onSaved={onChanged} />
    )}
    </>
  )
}

const TOGGLE_STYLES = {
  paid: 'bg-green-100 text-green-700 hover:bg-green-200',
  partial: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  unpaid: 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200',
}
const TOGGLE_LABELS = { paid: 'Paid', partial: 'Partial', unpaid: 'Record payment' }

function PaymentToggle({ status, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${TOGGLE_STYLES[status]}`}
    >
      {status === 'paid' && <Check size={12} />} {TOGGLE_LABELS[status]}
    </button>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl w-full p-6 ${wide ? 'max-w-lg' : 'max-w-md'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
      />
    </div>
  )
}
