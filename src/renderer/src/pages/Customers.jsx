import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Edit2, Trash2, User, X, ChevronDown, FileDown, FileText, Check, Eye, Pencil, Search, UserX, UserCheck, CalendarDays, UserPlus, FileSpreadsheet, CheckCircle, FilePlus } from 'lucide-react'
import { generateBillPDF } from '../utils/pdf'
import { itemsOf, billDate, parseDate, workDaysOf, billPeriod, paymentOf, paymentStatus, paymentMethodLabel, WEEKDAYS } from '../utils/bills'
import PdfPreviewModal from '../components/PdfPreviewModal'
import PaymentModal from '../components/PaymentModal'
import { useLang, fmtDate } from '../i18n'

const EMPTY = { name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', serviceDay: '', notes: '' }

// A customer is active unless explicitly discontinued (older records have no flag).
const isActive = (c) => c.active !== false

const SORTS = {
  name: { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) },
  city: { label: 'City (A–Z)', fn: (a, b) => (a.city || '').localeCompare(b.city || '', undefined, { sensitivity: 'base' }) || a.name.localeCompare(b.name) },
  zip:  { label: 'ZIP code',   fn: (a, b) => (a.zip || '').localeCompare(b.zip || '', undefined, { numeric: true }) || a.name.localeCompare(b.name) },
}

export default function Customers() {
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const [customers, setCustomers] = useState([])
  const [bills, setBills] = useState([])
  const [settings, setSettings] = useState({})
  const [sortBy, setSortBy] = useState('name')
  const [dayFilter, setDayFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [showChoice, setShowChoice] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)

  useEffect(() => { load() }, [])

  // Deep link from the command palette: open a customer's detail panel directly.
  useEffect(() => {
    if (location.state?.detailId) setDetailId(location.state.detailId)
  }, [location.state])

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

  async function setCustomerActive(c, active) {
    await window.api.customers.save({ ...c, active })
    load()
  }

  async function handleImport() {
    setShowChoice(false)
    const res = await window.api.customers.import()
    if (res?.ok) setImportPreview(res.customers)
    else if (res && !res.canceled) { setImportMsg(res.error || t('Import failed.')); setTimeout(() => setImportMsg(null), 3500) }
  }

  async function confirmImport() {
    if (!importPreview?.length || importing) return
    setImporting(true)
    try {
      const n = await window.api.customers.bulkAdd(importPreview)
      setImportPreview(null)
      setImportMsg(n === 1 ? t('Imported {n} customer.', { n }) : t('Imported {n} customers.', { n }))
      await load()
      setTimeout(() => setImportMsg(null), 3500)
    } finally {
      setImporting(false)
    }
  }

  function field(key) {
    return (v) => setForm(f => ({ ...f, [key]: v }))
  }

  const billsByCustomer = bills.reduce((acc, b) => {
    (acc[b.customerId] = acc[b.customerId] || []).push(b)
    return acc
  }, {})

  const q = search.trim().toLowerCase()
  const visible = [...customers]
    .filter(c => !dayFilter || c.serviceDay === dayFilter)
    .filter(c => !q || [c.name, c.address, c.city, c.state, c.zip, c.phone, c.email]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
    .sort(SORTS[sortBy].fn)
  const activeList = visible.filter(isActive)
  const inactiveList = visible.filter(c => !isActive(c))
  const detailCustomer = customers.find(c => c.id === detailId)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('Customers')}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={dayFilter}
              onChange={e => setDayFilter(e.target.value)}
              className="border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">{t('All days')}</option>
              {WEEKDAYS.map(d => <option key={d} value={d}>{t(d)}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>{t('Sort:')} {t(v.label)}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => setShowChoice(true)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm">
            <Plus size={16} /> {t('Add Customer')}
          </button>
        </div>
      </div>

      {customers.length > 0 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search customers by name, address, phone…')}
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
          <p className="font-medium text-sm">{t('No customers saved yet')}</p>
          <p className="text-xs mt-1">{t('Click "Add Customer" to get started')}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center text-gray-400">
          <Search size={36} className="mx-auto mb-2 opacity-25" />
          <p className="text-sm font-medium">{t('No customers match "{q}"', { q: search })}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            {activeList.map(c => (
              <CustomerRow
                key={c.id}
                customer={c}
                bills={billsByCustomer[c.id] || []}
                active
                onOpen={() => setDetailId(c.id)}
                onBill={() => navigate('/new-bill', { state: { customerId: c.id } })}
                onEdit={() => openEdit(c)}
                onDelete={() => setDeleteId(c.id)}
                onToggleActive={() => setCustomerActive(c, false)}
              />
            ))}
            {activeList.length === 0 && (
              <p className="text-sm text-gray-400 px-1 py-4 text-center">{q ? t('No active customers match your search.') : t('No active customers.')}</p>
            )}
          </div>

          {inactiveList.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {t('Discontinued ({n})', { n: inactiveList.length })}
              </h2>
              <div className="space-y-2">
                {inactiveList.map(c => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    bills={billsByCustomer[c.id] || []}
                    active={false}
                    onOpen={() => setDetailId(c.id)}
                    onEdit={() => openEdit(c)}
                    onDelete={() => setDeleteId(c.id)}
                    onToggleActive={() => setCustomerActive(c, true)}
                  />
                ))}
              </div>
            </div>
          )}
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

      {importMsg && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-[60] flex items-center gap-2 text-sm font-medium">
          <CheckCircle size={16} /> {importMsg}
        </div>
      )}

      {/* Add choice: one customer or import a spreadsheet */}
      {showChoice && (
        <Modal title={t('Add customers')} onClose={() => setShowChoice(false)}>
          <div className="space-y-2.5">
            <button onClick={() => { setShowChoice(false); openAdd() }} className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50/40 text-left transition-colors">
              <span className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><UserPlus size={18} className="text-green-600" /></span>
              <span>
                <span className="block text-sm font-medium text-gray-800">{t('Add a customer')}</span>
                <span className="block text-xs text-gray-400">{t("Enter one customer's details")}</span>
              </span>
            </button>
            <button onClick={handleImport} className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50/40 text-left transition-colors">
              <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><FileSpreadsheet size={18} className="text-blue-600" /></span>
              <span>
                <span className="block text-sm font-medium text-gray-800">{t('Import from spreadsheet')}</span>
                <span className="block text-xs text-gray-400">{t('Upload an Excel or CSV list of customers')}</span>
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            {t('Spreadsheet columns (any order): Name, Address, City, State, Zip, Phone, Email, Service Day.')}
          </p>
        </Modal>
      )}

      {/* Import preview */}
      {importPreview && (
        <Modal title={t('Import customers')} onClose={() => setImportPreview(null)} wide>
          {importPreview.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {t('No customers were found. Make sure the spreadsheet has a ')}<span className="font-medium text-gray-700">{t('Name')}</span>{t(' column.')}
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                {t('Found')} <span className="font-semibold">{importPreview.length}</span> {importPreview.length === 1 ? t('customer — review and import:') : t('customers — review and import:')}
              </p>
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {importPreview.map((c, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {[c.serviceDay && t('{day}s', { day: t(c.serviceDay) }), [c.address, c.city, c.state, c.zip].filter(Boolean).join(', '), c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setImportPreview(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">{t('Cancel')}</button>
            <button onClick={confirmImport} disabled={importPreview.length === 0 || importing} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40">
              {importing ? t('Importing…') : (importPreview.length === 1 ? t('Import {n} customer', { n: importPreview.length }) : t('Import {n} customers', { n: importPreview.length }))}
            </button>
          </div>
        </Modal>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal title={editId ? t('Edit Customer') : t('Add Customer')} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Field label={t('Full Name *')} value={form.name} onChange={field('name')} placeholder={t('John Doe')} />
            <Field label={t('Address')} value={form.address} onChange={field('address')} placeholder={t('123 Main St')} />
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2"><Field label={t('City')} value={form.city} onChange={field('city')} placeholder={t('Springfield')} /></div>
              <div><Field label={t('State')} value={form.state} onChange={field('state')} placeholder={t('IL')} /></div>
              <div className="col-span-2"><Field label={t('ZIP')} value={form.zip} onChange={field('zip')} placeholder={t('62701')} /></div>
            </div>
            <Field label={t('Phone')} value={form.phone} onChange={field('phone')} placeholder={t('555-555-5555')} />
            <Field label={t('Email')} value={form.email} onChange={field('email')} placeholder={t('john@email.com')} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('Service day')}</label>
              <div className="relative">
                <select
                  value={form.serviceDay || ''}
                  onChange={e => field('serviceDay')(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">{t('No set day')}</option>
                  {WEEKDAYS.map(d => <option key={d} value={d}>{t(d)}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('Notes')}</label>
              <textarea
                value={form.notes || ''}
                onChange={e => field('notes')(e.target.value)}
                rows={2}
                placeholder={t('e.g. Gate code 4482, dog in backyard, skip side yard')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">{t('Cancel')}</button>
            <button onClick={handleSave} disabled={!form.name.trim()} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40">{t('Save')}</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title={t('Delete Customer?')} onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-500 mb-4">{t('Their billing history will not be deleted.')}</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">{t('Cancel')}</button>
            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">{t('Delete')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CustomerRow({ customer: c, bills, active, onOpen, onBill, onEdit, onDelete, onToggleActive }) {
  const { t } = useLang()
  const unpaid = bills.filter(b => !b.paid).length
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-start justify-between transition-colors ${active ? 'hover:border-green-200' : 'opacity-70'}`}>
      <button onClick={onOpen} className="text-left flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-800">{c.name}</p>
          {!active && <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t('Discontinued')}</span>}
        </div>
        {c.address && (
          <p className="text-sm text-gray-500 mt-0.5">
            {[c.address, c.city, c.state, c.zip].filter(Boolean).join(', ')}
          </p>
        )}
        {c.notes && <p className="text-xs text-gray-400 italic truncate mt-0.5">{c.notes}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
          {c.serviceDay && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
              <CalendarDays size={12} /> {t('{day}s', { day: t(c.serviceDay) })}
            </span>
          )}
          {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
          {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
          <span className="text-xs text-green-700 font-medium">
            {bills.length === 1 ? t('{n} bill', { n: bills.length }) : t('{n} bills', { n: bills.length })}
            {unpaid > 0 && <span className="text-amber-600">{t(' · {n} unpaid', { n: unpaid })}</span>}
          </span>
        </div>
      </button>
      <div className="flex gap-1 mt-0.5 shrink-0">
        {active && (
          <button onClick={onBill} title={t('New bill for this customer')} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <FilePlus size={15} />
          </button>
        )}
        {active ? (
          <button onClick={onToggleActive} title={t('Discontinue service')} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
            <UserX size={15} />
          </button>
        ) : (
          <button onClick={onToggleActive} title={t('Reactivate')} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <UserCheck size={15} />
          </button>
        )}
        <button onClick={onEdit} title={t('Edit')} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <Edit2 size={15} />
        </button>
        <button onClick={onDelete} title={t('Delete')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function CustomerDetail({ customer, bills, settings, onClose, onChanged }) {
  const { t } = useLang()
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
      {customer.notes && (
        <p className="text-xs text-gray-500 italic bg-gray-100 rounded-lg px-3 py-2 -mt-2 mb-4">{customer.notes}</p>
      )}

      {customer.active !== false && (
        <button
          onClick={() => navigate('/new-bill', { state: { customerId: customer.id } })}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors mb-4"
        >
          <FilePlus size={15} /> {t('New bill for {name}', { name: customer.name })}
        </button>
      )}

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Past Bills')}</p>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-2 opacity-25" />
          <p className="text-sm">{t('No bills issued yet')}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {sorted.map(bill => {
            const days = workDaysOf(bill)
            const period = billPeriod(bill)
            const status = paymentStatus(bill)
            const pay = paymentOf(bill)
            return (
              <div key={bill.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {period
                        ? `${fmtDate(parseDate(period.start), 'MMM d')} – ${fmtDate(parseDate(period.end), 'MMM d, yyyy')}`
                        : fmtDate(parseDate(billDate(bill)), 'MMMM d, yyyy')}
                      {!period && days.length > 1 && <span className="text-gray-400 font-normal">{t(' · {n} work days', { n: days.length })}</span>}
                      {bill.draft && <span className="text-xs text-amber-600 font-normal">{t(' · draft')}</span>}
                      {bill.lastSentAt && (
                        <span className="text-xs text-blue-600 font-normal">{bill.lastSentVia === 'print'
                          ? t(' · printed {date}', { date: fmtDate(new Date(bill.lastSentAt), 'MMM d') })
                          : t(' · emailed {date}', { date: fmtDate(new Date(bill.lastSentAt), 'MMM d') })}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {itemsOf(bill).map((item, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {t(item.name)} — ${Number(item.price).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-800">${Number(bill.total).toFixed(2)}</p>
                    {pay.amountPaid > 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {status === 'partial' ? t('Paid ${amount}', { amount: pay.amountPaid.toFixed(2) }) : t('Paid in full')}
                        {pay.method ? ` · ${paymentMethodLabel(pay.method)}${pay.method === 'check' && pay.checkNumber ? ` #${pay.checkNumber}` : ''}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                  <PaymentToggle status={status} onClick={() => setPaymentBill(bill)} />
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPreviewBill(bill)} className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 font-medium">
                      <Eye size={13} /> {t('Preview')}
                    </button>
                    <button onClick={() => navigate('/new-bill', { state: { editBill: bill } })} className="text-xs text-gray-500 hover:text-amber-600 flex items-center gap-1 font-medium">
                      <Pencil size={13} /> {t('Edit')}
                    </button>
                    <button onClick={() => reExport(bill)} className="text-xs text-gray-500 hover:text-green-600 flex items-center gap-1 font-medium">
                      <FileDown size={13} /> {t('Download')}
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
      <PdfPreviewModal bill={previewBill} settings={settings} onClose={() => setPreviewBill(null)} downloadLabel={t('Download')} />
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
  const { t } = useLang()
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${TOGGLE_STYLES[status]}`}
    >
      {status === 'paid' && <Check size={12} />} {t(TOGGLE_LABELS[status])}
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
