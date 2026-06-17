import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Trash2, FileDown, ChevronDown, Check, Eye, Download, Pencil, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { generateBillPDF, generateBillsPDF } from '../utils/pdf'
import { itemsOf, billDate, parseDate, workDaysOf } from '../utils/bills'
import PdfPreviewModal from '../components/PdfPreviewModal'

const PAGE = 40
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function BillHistory() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState({})
  const [filter, setFilter] = useState('')   // customerId
  const [month, setMonth] = useState('')      // '01'..'12'
  const [year, setYear] = useState('')        // 'yyyy'
  const [visible, setVisible] = useState(PAGE)
  const [deleteId, setDeleteId] = useState(null)
  const [previewBill, setPreviewBill] = useState(null)
  const [downloading, setDownloading] = useState(false)

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

  async function togglePaid(bill) {
    await window.api.bills.setPaid(bill.id, !bill.paid)
    load()
  }

  async function reExport(bill) {
    const buf = await generateBillPDF(bill, settings)
    const name = `invoice-${bill.customerName.replace(/\s+/g, '-')}-${billDate(bill)}.pdf`
    await window.api.pdf.save(buf, name)
  }

  // Combine every bill in the current filter into one multi-page PDF.
  async function downloadAll(billsToExport, label) {
    if (!billsToExport.length || downloading) return
    setDownloading(true)
    try {
      const chronological = [...billsToExport].sort((a, b) => billDate(a).localeCompare(billDate(b)))
      const buf = await generateBillsPDF(chronological, settings)
      await window.api.pdf.save(buf, `bills-${label}.pdf`.replace(/-+/g, '-'))
    } finally {
      setDownloading(false)
    }
  }

  // Years present in the data (newest first), for the year dropdown.
  const years = [...new Set(bills.map(b => billDate(b).slice(0, 4)).filter(Boolean))].sort().reverse()

  const hasFilter = !!(filter || month || year)

  let filtered = bills
  if (filter) filtered = filtered.filter(b => b.customerId === filter)
  if (year) filtered = filtered.filter(b => billDate(b).startsWith(year + '-'))
  if (month) filtered = filtered.filter(b => billDate(b).slice(5, 7) === month)
  // Chronological: oldest first, most recent at the bottom.
  filtered = [...filtered].sort((a, b) => billDate(a).localeCompare(billDate(b)))

  // With no filter, keep the most recent `visible` bills (still oldest-first within that window).
  const shown = hasFilter ? filtered : filtered.slice(-visible)
  const canShowOlder = !hasFilter && filtered.length > visible

  // Group the shown bills under "Month Year" headers.
  const groups = []
  shown.forEach(b => {
    const key = format(parseDate(billDate(b)), 'MMMM yyyy')
    let g = groups.find(g => g.key === key)
    if (!g) { g = { key, bills: [] }; groups.push(g) }
    g.bills.push(b)
  })

  // Labels for the "download all" action, based on the active filter.
  const monthName = month ? MONTHS[parseInt(month, 10) - 1] : ''
  const customerName = filter ? (customers.find(c => c.id === filter)?.name || '') : ''
  const descParts = []
  if (customerName) descParts.push(`for ${customerName}`)
  if (monthName || year) descParts.push(`in ${[monthName, year].filter(Boolean).join(' ')}`)
  const filterDescription = descParts.join(' ')
  const downloadLabel = [customerName.replace(/\s+/g, '-'), monthName, year].filter(Boolean).join('-') || 'filtered'

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Bill History</h1>

        <div className="flex flex-wrap items-center gap-2">
          <Dropdown value={month} onChange={setMonth}>
            <option value="">All months</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </Dropdown>
          <Dropdown value={year} onChange={setYear}>
            <option value="">All years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Dropdown>
          <Dropdown value={filter} onChange={setFilter}>
            <option value="">All customers</option>
            {[...customers].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Dropdown>
        </div>
      </div>

      {!hasFilter && filtered.length > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          Showing the {Math.min(visible, filtered.length)} most recent of {filtered.length} bills · oldest first
        </p>
      )}

      {hasFilter && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          <p className="text-xs text-green-800">
            <span className="font-semibold">{filtered.length}</span> {filtered.length === 1 ? 'bill' : 'bills'} {filterDescription}
          </p>
          <button
            onClick={() => downloadAll(filtered, downloadLabel)}
            disabled={downloading}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 shrink-0"
          >
            <Download size={13} /> {downloading ? 'Preparing…' : 'Download all as PDF'}
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <FileText size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">No bills found</p>
          {hasFilter && <p className="text-xs mt-1">Try adjusting the filters above</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {canShowOlder && (
            <div className="text-center pb-1">
              <button
                onClick={() => setVisible(v => v + PAGE)}
                className="text-sm font-medium text-green-600 hover:text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-5 py-2 transition-colors inline-flex items-center gap-1.5"
              >
                <ChevronUp size={15} /> Show older bills ({filtered.length - visible} more)
              </button>
            </div>
          )}

          {groups.map(group => (
            <div key={group.key}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{group.key}</h2>
              <div className="space-y-3">
                {group.bills.map(bill => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onTogglePaid={() => togglePaid(bill)}
                    onPreview={() => setPreviewBill(bill)}
                    onEdit={() => navigate('/new-bill', { state: { editBill: bill } })}
                    onReExport={() => reExport(bill)}
                    onDelete={() => setDeleteId(bill.id)}
                  />
                ))}
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

      {previewBill && (
        <PdfPreviewModal bill={previewBill} settings={settings} onClose={() => setPreviewBill(null)} downloadLabel="Download" />
      )}
    </div>
  )
}

function BillCard({ bill, onTogglePaid, onPreview, onEdit, onReExport, onDelete }) {
  const days = workDaysOf(bill)
  const multiDay = days.length > 1

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800">{bill.customerName}</p>
            <PaidBadge paid={bill.paid} onClick={onTogglePaid} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {multiDay
              ? `${days.length} work days · ${format(parseDate(days[0].date), 'MMM d')} – ${format(parseDate(days[days.length - 1].date), 'MMM d, yyyy')}`
              : format(parseDate(billDate(bill)), 'MMMM d, yyyy')}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {itemsOf(bill).map((item, i) => (
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
            <button onClick={onPreview} title="Preview" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Eye size={15} />
            </button>
            <button onClick={onEdit} title="Edit bill" className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={onReExport} title="Download PDF" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
              <FileDown size={15} />
            </button>
            <button onClick={onDelete} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaidBadge({ paid, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Click to toggle"
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
        paid
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
      }`}
    >
      {paid ? <><Check size={11} /> Paid</> : 'Unpaid'}
    </button>
  )
}

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
