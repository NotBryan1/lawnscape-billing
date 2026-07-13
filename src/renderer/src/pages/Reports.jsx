import { useState, useEffect } from 'react'
import { BarChart3, Download, ChevronDown, CheckCircle, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import { billDate, paymentOf } from '../utils/bills'
import { generateDirectoryPDF } from '../utils/pdf'
import { useLang, fmtDate } from '../i18n'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Reports() {
  const { t } = useLang()
  const [bills, setBills] = useState([])
  const [allCustomers, setAllCustomers] = useState([])
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [exporting, setExporting] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    Promise.all([window.api.bills.getAll(), window.api.customers.getAll()]).then(([b, c]) => {
      setBills(b)
      setAllCustomers(c)
    })
  }, [])

  const years = [...new Set([String(new Date().getFullYear()), ...bills.map(b => billDate(b).slice(0, 4)).filter(Boolean)])].sort().reverse()
  const yearBills = bills.filter(b => billDate(b).startsWith(year + '-'))

  // Billed vs collected per month of the selected year.
  const monthly = MONTHS.map((name, i) => {
    const mm = String(i + 1).padStart(2, '0')
    const list = yearBills.filter(b => billDate(b).slice(5, 7) === mm)
    const billed = list.reduce((s, b) => s + (Number(b.total) || 0), 0)
    const collected = list.reduce((s, b) => s + paymentOf(b).amountPaid, 0)
    return { name, count: list.length, billed, collected, balance: Math.max(0, billed - collected) }
  })
  const totals = monthly.reduce(
    (acc, m) => ({ count: acc.count + m.count, billed: acc.billed + m.billed, collected: acc.collected + m.collected }),
    { count: 0, billed: 0, collected: 0 }
  )
  const outstanding = Math.max(0, totals.billed - totals.collected)

  // Per-customer totals for the year.
  const byCustomer = {}
  yearBills.forEach(b => {
    const key = b.customerName || 'Unknown'
    const e = byCustomer[key] || (byCustomer[key] = { name: key, count: 0, billed: 0, collected: 0 })
    e.count++
    e.billed += Number(b.total) || 0
    e.collected += paymentOf(b).amountPaid
  })
  const customers = Object.values(byCustomer).sort((a, b) => b.billed - a.billed)

  async function exportSheet() {
    if (exporting) return
    setExporting(true)
    try {
      const wb = XLSX.utils.book_new()
      const monthlyRows = monthly.filter(m => m.count > 0).map(m => ({
        [t('Month')]: t(m.name), [t('Bills')]: m.count, [t('Billed')]: m.billed, [t('Collected')]: m.collected, [t('Balance due')]: m.balance,
      }))
      monthlyRows.push({ [t('Month')]: t('TOTAL'), [t('Bills')]: totals.count, [t('Billed')]: totals.billed, [t('Collected')]: totals.collected, [t('Balance due')]: outstanding })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), t('Monthly'))
      const customerRows = customers.map(c => ({
        [t('Customer')]: c.name, [t('Bills')]: c.count, [t('Billed')]: c.billed, [t('Collected')]: c.collected, [t('Balance due')]: Math.max(0, c.billed - c.collected),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerRows), t('By customer'))
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const ok = await window.api.files.save({
        buffer: buf,
        filename: `lawnscape-income-${year}.xlsx`,
        filterName: 'Excel Spreadsheet',
        extensions: ['xlsx'],
      })
      if (ok) { setMsg(t('Report exported!')); setTimeout(() => setMsg(null), 3000) }
    } finally {
      setExporting(false)
    }
  }

  // Client directory: every active customer with contact info and their
  // average charge per month (averaged over the months they were billed).
  const dirRows = allCustomers
    .filter(c => c.active !== false)
    .map(c => {
      const theirs = bills.filter(b => b.customerId === c.id)
      const months = new Set(theirs.map(b => billDate(b).slice(0, 7)))
      const total = theirs.reduce((s, b) => s + (Number(b.total) || 0), 0)
      return {
        c,
        address: [c.address, c.city, c.state, c.zip].filter(Boolean).join(', '),
        avg: months.size ? total / months.size : null,
      }
    })
    .sort((a, b) => a.c.name.localeCompare(b.c.name, undefined, { sensitivity: 'base' }))

  async function printDirectory() {
    const buf = await generateDirectoryPDF(
      dirRows.map(r => ({
        name: r.c.name,
        address: r.address,
        contact: [r.c.phone, r.c.email].filter(Boolean),
        avg: r.avg != null ? `$${r.avg.toFixed(2)}` : '—',
      })),
      {
        title: t('Client directory'),
        subtitle: `${t('Generated {date}', { date: fmtDate(new Date(), 'MMMM d, yyyy') })} · ${t('{n} clients', { n: dirRows.length })}`,
        name: t('Name'),
        address: t('Address'),
        contact: t('Contact'),
        avg: t('Avg / month'),
      },
      { autoPrint: true }
    )
    await window.api.pdf.print(buf, 'client-directory.pdf')
  }

  async function exportDirectory() {
    const rows = dirRows.map(r => ({
      [t('Name')]: r.c.name,
      [t('Address')]: r.address,
      [t('Phone')]: r.c.phone || '',
      [t('Email')]: r.c.email || '',
      [t('Avg / month')]: r.avg != null ? Number(r.avg.toFixed(2)) : '',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), t('Customers'))
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const ok = await window.api.files.save({
      buffer: buf,
      filename: 'lawnscape-clients.xlsx',
      filterName: 'Excel Spreadsheet',
      extensions: ['xlsx'],
    })
    if (ok) { setMsg(t('Client list exported!')); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {msg && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm font-medium">
          <CheckCircle size={16} /> {msg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('Reports')}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={exportSheet}
            disabled={yearBills.length === 0 || exporting}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 text-sm font-medium shadow-sm"
          >
            <Download size={15} /> {exporting ? t('Exporting…') : t('Export spreadsheet')}
          </button>
        </div>
      </div>

      {yearBills.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <BarChart3 size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">{t('No bills in {year}', { year })}</p>
        </div>
      ) : (
        <>
          {/* Year totals */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">{t('Billed in {year}', { year })}</p>
              <p className="text-2xl font-bold text-green-800">${totals.billed.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-green-100">
              <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">{t('Collected')}</p>
              <p className="text-2xl font-bold text-green-800">${totals.collected.toFixed(2)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">{t('Balance due')}</p>
              <p className="text-2xl font-bold text-amber-800">${outstanding.toFixed(2)}</p>
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3 border-b border-gray-100">{t('Month by month')}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-50">
                  <th className="text-left font-medium px-4 py-2">{t('Month')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Bills')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Billed')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Collected')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Balance due')}</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.name} className={`border-b border-gray-50 last:border-0 ${m.count === 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                    <td className="px-4 py-2">{t(m.name)}</td>
                    <td className="px-4 py-2 text-right">{m.count || '—'}</td>
                    <td className="px-4 py-2 text-right">{m.count ? `$${m.billed.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2 text-right">{m.count ? `$${m.collected.toFixed(2)}` : '—'}</td>
                    <td className={`px-4 py-2 text-right ${m.balance > 0 ? 'text-amber-600 font-medium' : ''}`}>{m.count ? `$${m.balance.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-gray-800 bg-gray-100">
                  <td className="px-4 py-2">{t('Total')}</td>
                  <td className="px-4 py-2 text-right">{totals.count}</td>
                  <td className="px-4 py-2 text-right">${totals.billed.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${totals.collected.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${outstanding.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Per-customer totals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3 border-b border-gray-100">{t('By customer')}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-50">
                  <th className="text-left font-medium px-4 py-2">{t('Customer')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Bills')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Billed')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Collected')}</th>
                  <th className="text-right font-medium px-4 py-2">{t('Balance due')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  const balance = Math.max(0, c.billed - c.collected)
                  return (
                    <tr key={c.name} className="border-b border-gray-50 last:border-0 text-gray-700">
                      <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-2 text-right">{c.count}</td>
                      <td className="px-4 py-2 text-right">${c.billed.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${c.collected.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-right ${balance > 0 ? 'text-amber-600 font-medium' : ''}`}>${balance.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Client directory — printable roster with contact info and averages */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Client directory')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('Every active client with contact info and their average charge per billed month.')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={printDirectory}
              disabled={!dirRows.length}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-xs font-medium transition-colors"
            >
              <Printer size={13} /> {t('Print')}
            </button>
            <button
              onClick={exportDirectory}
              disabled={!dirRows.length}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-40 text-xs font-medium transition-colors"
            >
              <Download size={13} /> {t('Export spreadsheet')}
            </button>
          </div>
        </div>
        {dirRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">{t('No active customers.')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-50">
                <th className="text-left font-medium px-4 py-2">{t('Name')}</th>
                <th className="text-left font-medium px-4 py-2">{t('Address')}</th>
                <th className="text-left font-medium px-4 py-2">{t('Contact')}</th>
                <th className="text-right font-medium px-4 py-2">{t('Avg / month')}</th>
              </tr>
            </thead>
            <tbody>
              {dirRows.map(r => (
                <tr key={r.c.id} className="border-b border-gray-50 last:border-0 text-gray-700 align-top">
                  <td className="px-4 py-2 font-medium text-gray-800">{r.c.name}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{r.address || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {r.c.phone && <p>{r.c.phone}</p>}
                    {r.c.email && <p>{r.c.email}</p>}
                    {!r.c.phone && !r.c.email && '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{r.avg != null ? `$${r.avg.toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
