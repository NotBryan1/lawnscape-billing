import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, User, X } from 'lucide-react'

const EMPTY = { name: '', address: '', city: '', state: '', zip: '', phone: '', email: '' }

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setCustomers(await window.api.customers.getAll())
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <User size={44} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium text-sm">No customers saved yet</p>
          <p className="text-xs mt-1">Click "Add Customer" to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-800">{c.name}</p>
                {c.address && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[c.address, c.city, c.state, c.zip].filter(Boolean).join(', ')}
                  </p>
                )}
                <div className="flex gap-4 mt-1">
                  {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                  {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                </div>
              </div>
              <div className="flex gap-1 mt-0.5">
                <button onClick={() => openEdit(c)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => setDeleteId(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
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
