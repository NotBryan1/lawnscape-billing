import { useState, useEffect } from 'react'
import { FileText, Trash2, FileDown, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { generateBillPDF } from '../utils/pdf'

export default function BillHistory() {
  const [bills, setBills] = useState([])
  const [customers, setCustomers] = useState([])
  const [filter, setFilter] = useState('')
  const [settings, setSettings] = useState({})
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [b, c, s] = await Promise.all([
      window.api.bills.getAll(),
      window.api.customers.getAll(),
      window.api.settings.get(),
    ])
    setBills(b)
    setCustomers(c)
    setSettings(s)
  }

  async function handleDelete() {
    await window.api.bills.delete(deleteId)
    setDeleteId(null)
    load()
  }

  async function reExport(bill) {
    const buf = await generateBillPDF(bill, settings)
    const name = `invoice-${bill.customerName.replace(/\s+/g, '-')}-${bill.date}.pdf`
    await window.api.pdf.save(buf, name)
  }

  const filtered = filter ? bills.filter(b => b.customerId === filter) : bills

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Bill History</h1>

        <div className="relative">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <FileText size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">No bills found</p>
          {filter && <p className="text-xs mt-1">This customer has no bills yet</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bill => (
            <div key={bill.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{bill.customerName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(bill.date + 'T00:00:00'), 'MMMM d, yyyy')}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {bill.items.map((item, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {item.name} — ${Number(item.price).toFixed(2)}
                      </span>
                    ))}
                  </div>
                  {bill.notes && (
                    <p className="text-xs text-gray-400 mt-2 italic truncate">{bill.notes}</p>
                  )}
                </div>
                <div className="ml-4 text-right shrink-0">
                  <p className="font-bold text-gray-800 text-lg">${Number(bill.total).toFixed(2)}</p>
                  <div className="flex gap-1 mt-2 justify-end">
                    <button
                      onClick={() => reExport(bill)}
                      title="Re-export PDF"
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <FileDown size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(bill.id)}
                      title="Delete"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-800 mb-1">Delete this bill?</h3>
            <p className="text-sm text-gray-500 mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
