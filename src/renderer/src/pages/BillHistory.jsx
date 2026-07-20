import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Trash2, FileDown, ChevronDown, Check, Eye, Download, Pencil, Search, Printer, Mail } from 'lucide-react'
import { useLang, fmtDate } from '../i18n'
import { generateBillPDF, generateBillsPDF } from '../utils/pdf'
import { itemsOf, billDate, parseDate, workDaysOf, billPeriod, paymentOf, paymentStatus, paymentMethodLabel, isOverdue, WEEKDAYS } from '../utils/bills'
import PdfPreviewModal from '../components/PdfPreviewModal'
import PaymentModal from '../components/PaymentModal'

// Every past bill: search/filter (name, service day, month, year), grouped
// by month with infinite-scroll-style paging when unfiltered, a pinned
// drafts section, and per-bill actions (preview/edit/print/email/download/delete).

const PAGE = 25
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function BillHistory() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [bills, setBills] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState({})
  const [search, setSearch] = useState('')    // customer name (type-in)
  const [month, setMonth] = useState('')      // '01'..'12'
  const [year, setYear] = useState('')        // 'yyyy'
  const [dayFilter, setDayFilter] = useState('')  // service day of week
  const [visible, setVisible] = useState(PAGE)
  const [deleteId, setDeleteId] = useState(null)
  const [previewBill, setPreviewBill] = useState(null)
  const [paymentBill, setPaymentBill] = useState(null)
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

  async function reExport(bill) {
    const buf = await generateBillPDF(bill, settings)
    const name = `invoice-${bill.customerName.replace(/\s+/g, '-')}-${billDate(bill)}.pdf`
    await window.api.pdf.save(buf, name)
  }

  // Stamp the bill as sent so the customer shows as handled in the list.
  async function markSent(bill, via) {
    await window.api.bills.save({ ...bill, lastSentVia: via, lastSentAt: new Date().toISOString() })
    load()
  }

  // Confirm a draft is done — it moves into the normal month groups.
  async function markFinished(bill) {
    await window.api.bills.save({ ...bill, draft: false })
    load()
  }

  async function printBill(bill) {
    const buf = await generateBillPDF(bill, settings, { autoPrint: true })
    const name = `invoice-${bill.customerName.replace(/\s+/g, '-')}-${billDate(bill)}.pdf`
    await window.api.pdf.print(buf, name)
    await markSent(bill, 'print')
  }

  async function emailBill(bill) {
    const buf = await generateBillPDF(bill, settings)
    const num = bill.invoiceNumber ? `#${bill.invoiceNumber} ` : ''
    await window.api.email.compose({
      to: bill.customerEmail || '',
      subject: `Invoice ${num}from ${settings.businessName || 'Lawnscape'}`,
      body: `Hi ${bill.customerName},\n\nYour invoice ${num}for $${Number(bill.total).toFixed(2)} is attached.\n\nThank you!\n${settings.businessName || ''}`,
      buffer: buf,
      filename: `invoice-${bill.customerName.replace(/\s+/g, '-')}-${billDate(bill)}.pdf`,
    })
    await markSent(bill, 'email')
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

  // Map each customer id to their service day, to filter bills by day of week.
  const dayByCustomer = customers.reduce((acc, c) => { acc[c.id] = c.serviceDay || ''; return acc }, {})

  const q = search.trim().toLowerCase()
  const hasFilter = !!(q || month || year || dayFilter)
  // Picking a month/year shows the whole period; everything else still pages.
  const dateFiltered = !!(month || year)

  let filtered = bills
  if (q) filtered = filtered.filter(b => (b.customerName || '').toLowerCase().includes(q))
  if (dayFilter) filtered = filtered.filter(b => dayByCustomer[b.customerId] === dayFilter)
  if (year) filtered = filtered.filter(b => billDate(b).startsWith(year + '-'))
  if (month) filtered = filtered.filter(b => billDate(b).slice(5, 7) === month)
  // Newest first, oldest at the bottom.
  filtered = [...filtered].sort((a, b) => billDate(b).localeCompare(billDate(a)))

  // Drafts live in their own pinned section until confirmed finished; they're
  // kept out of the month groups and out of "download all".
  const draftBills = filtered.filter(b => b.draft)
  filtered = filtered.filter(b => !b.draft)

  const shown = dateFiltered ? filtered : filtered.slice(0, visible)
  const canShowOlder = !dateFiltered && filtered.length > visible

  // Group the shown bills under "Month Year" headers.
  const groups = []
  shown.forEach(b => {
    const key = fmtDate(parseDate(billDate(b)), 'MMMM yyyy')
    let g = groups.find(g => g.key === key)
    if (!g) { g = { key, bills: [] }; groups.push(g) }
    g.bills.push(b)
  })

  // Labels for the "download all" action, based on the active filter.
  const monthName = month ? MONTHS[parseInt(month, 10) - 1] : ''
  const searchLabel = search.trim()
  const descParts = []
  if (searchLabel) descParts.push(t('matching "{q}"', { q: searchLabel }))
  if (dayFilter) descParts.push(t('on {day}s', { day: t(dayFilter) }))
  if (monthName || year) descParts.push(t('in {period}', { period: [monthName ? t(monthName) : '', year].filter(Boolean).join(' ') }))
  const filterDescription = descParts.join(' ')
  const downloadLabel = [searchLabel.replace(/\s+/g, '-'), dayFilter, monthName, year].filter(Boolean).join('-') || 'filtered'

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('Bill History')}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <Dropdown value={dayFilter} onChange={setDayFilter}>
            <option value="">{t('All days')}</option>
            {WEEKDAYS.map(d => <option key={d} value={d}>{t(d)}</option>)}
          </Dropdown>
          <Dropdown value={month} onChange={setMonth}>
            <option value="">{t('All months')}</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{t(m)}</option>)}
          </Dropdown>
          <Dropdown value={year} onChange={setYear}>
            <option value="">{t('All years')}</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Dropdown>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search customer…')}
              className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>
      </div>

      {!hasFilter && filtered.length > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          {t('Showing the {n} most recent of {total} bills · newest first', { n: Math.min(visible, filtered.length), total: filtered.length })}
        </p>
      )}

      {hasFilter && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          <p className="text-xs text-green-800">
            <span className="font-semibold">{filtered.length}</span> {filtered.length === 1 ? t('bill') : t('bills')} {filterDescription}
          </p>
          <button
            onClick={() => downloadAll(filtered, downloadLabel)}
            disabled={downloading}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 shrink-0"
          >
            <Download size={13} /> {downloading ? t('Preparing…') : t('Download all as PDF')}
          </button>
        </div>
      )}

      {/* Drafts — pinned until confirmed finished */}
      {draftBills.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
            <Pencil size={12} /> {t('Drafts — still being edited ({n})', { n: draftBills.length })}
          </h2>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 space-y-2">
            {draftBills.map(bill => (
              <BillCard
                key={bill.id}
                bill={bill}
                overdue={false}
                onPayment={() => setPaymentBill(bill)}
                onPreview={() => setPreviewBill(bill)}
                onEdit={() => navigate('/new-bill', { state: { editBill: bill } })}
                onPrint={() => printBill(bill)}
                onEmail={() => emailBill(bill)}
                onReExport={() => reExport(bill)}
                onDelete={() => setDeleteId(bill.id)}
                onFinish={() => markFinished(bill)}
              />
            ))}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <FileText size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">{draftBills.length ? t('No finished bills here yet') : t('No bills found')}</p>
          {hasFilter && <p className="text-xs mt-1">{t('Try adjusting the filters above')}</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.key}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{group.key}</h2>
              <div className="bg-gray-200 rounded-xl p-2.5 space-y-2">
                {group.bills.map(bill => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    overdue={isOverdue(bill, Number(settings.overdueDays) || 30)}
                    onPayment={() => setPaymentBill(bill)}
                    onPreview={() => setPreviewBill(bill)}
                    onEdit={() => navigate('/new-bill', { state: { editBill: bill } })}
                    onPrint={() => printBill(bill)}
                    onEmail={() => emailBill(bill)}
                    onReExport={() => reExport(bill)}
                    onDelete={() => setDeleteId(bill.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {canShowOlder && (
            <div className="text-center pt-1">
              <button
                onClick={() => setVisible(v => v + PAGE)}
                className="text-sm font-medium text-green-600 hover:text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-5 py-2 transition-colors inline-flex items-center gap-1.5"
              >
                <ChevronDown size={15} /> {t('Show older bills ({n} more)', { n: filtered.length - visible })}
              </button>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-800 mb-1">{t('Delete this bill?')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('This cannot be undone.')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">{t('Cancel')}</button>
              <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">{t('Delete')}</button>
            </div>
          </div>
        </div>
      )}

      {previewBill && (
        <PdfPreviewModal bill={previewBill} settings={settings} onClose={() => setPreviewBill(null)} downloadLabel="Download" />
      )}

      {paymentBill && (
        <PaymentModal bill={paymentBill} onClose={() => setPaymentBill(null)} onSaved={load} />
      )}
    </div>
  )
}

/** One bill row: summary, items, payment status, and the action row (preview/edit/print/email/download/delete). */
function BillCard({ bill, overdue, onPayment, onPreview, onEdit, onPrint, onEmail, onReExport, onDelete, onFinish }) {
  const { t } = useLang()
  const days = workDaysOf(bill)
  const multiDay = days.length > 1
  const period = billPeriod(bill)
  const pay = paymentOf(bill)
  const status = paymentStatus(bill)

  const sent = !!bill.lastSentAt
  const draft = !!bill.draft

  return (
    <div className={`bg-white rounded-xl shadow-sm border p-4 ${draft ? 'border-amber-200' : sent ? 'border-blue-100' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800">{bill.customerName}</p>
            {draft && (
              <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Pencil size={10} /> {t('Draft')}
              </span>
            )}
            <PaymentBadge status={status} overdue={overdue} onClick={onPayment} />
            {sent && (
              <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                {bill.lastSentVia === 'print' ? <Printer size={10} /> : <Mail size={10} />}
                {bill.lastSentVia === 'print' ? t('Printed') : t('Emailed')} {fmtDate(new Date(bill.lastSentAt), 'MMM d')}
              </span>
            )}
            {bill.invoiceNumber && <span className="text-xs text-gray-400">#{bill.invoiceNumber}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {period
              ? `${fmtDate(parseDate(period.start), 'MMM d')} – ${fmtDate(parseDate(period.end), 'MMM d, yyyy')}`
              : multiDay
                ? `${t('{n} work days', { n: days.length })} · ${fmtDate(parseDate(days[0].date), 'MMM d')} – ${fmtDate(parseDate(days[days.length - 1].date), 'MMM d, yyyy')}`
                : fmtDate(parseDate(billDate(bill)), 'MMMM d, yyyy')}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {itemsOf(bill).map((item, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {t(item.name)} — ${Number(item.price).toFixed(2)}
              </span>
            ))}
          </div>
          {bill.notes && (
            <p className="text-xs text-gray-400 mt-2 italic truncate">{bill.notes}</p>
          )}
        </div>
        <div className="ml-4 text-right shrink-0">
          <p className="font-bold text-gray-800 text-lg">${Number(bill.total).toFixed(2)}</p>
          {pay.amountPaid > 0 && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {status === 'partial' ? t('Paid ${amount}', { amount: pay.amountPaid.toFixed(2) }) : t('Paid in full')}
              {pay.method ? ` · ${t(paymentMethodLabel(pay.method))}${pay.method === 'check' && pay.checkNumber ? ` #${pay.checkNumber}` : ''}` : ''}
            </p>
          )}
          <div className="flex items-center gap-1 mt-2 justify-end">
            {draft && onFinish && (
              <button onClick={onFinish} className="text-[11px] font-medium bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 flex items-center gap-1 transition-colors mr-1">
                <Check size={11} /> {t('Mark finished')}
              </button>
            )}
            <button onClick={onPreview} title={t('Preview')} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Eye size={15} />
            </button>
            <button onClick={onEdit} title={t('Edit bill')} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={onPrint} title={t('Print')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Printer size={15} />
            </button>
            <button onClick={onEmail} title={t('Email to customer')} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Mail size={15} />
            </button>
            <button onClick={onReExport} title={t('Download PDF')} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
              <FileDown size={15} />
            </button>
            <button onClick={onDelete} title={t('Delete')} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700 hover:bg-green-200',
  partial: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  unpaid: 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200',
}
const STATUS_LABELS = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

/** Payment-status pill on a BillCard; click opens PaymentModal. Overdue takes visual priority over the underlying status. */
function PaymentBadge({ status, overdue, onClick }) {
  const { t } = useLang()
  if (overdue) {
    return (
      <button onClick={onClick} title={t('Edit payment')} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
        {t('Overdue')}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      title={t('Edit payment')}
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${STATUS_STYLES[status]}`}
    >
      {status === 'paid' && <Check size={11} />} {t(STATUS_LABELS[status])}
    </button>
  )
}

/** Styled native <select> with a chevron icon, used for the filter dropdowns. */
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
