import { useState, useEffect } from 'react'
import { BarChart3, Download, ChevronDown, CheckCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { billDate, paymentOf } from '../utils/bills'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Reports() {
  const [bills, setBills] = useState([])
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [exporting, setExporting] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { window.api.bills.getAll().then(setBills) }, [])

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
        Month: m.name, Bills: m.count, Billed: m.billed, Collected: m.collected, 'Balance due': m.balance,
      }))
      monthlyRows.push({ Month: 'TOTAL', Bills: totals.count, Billed: totals.billed, Collected: totals.collected, 'Balance due': outstanding })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), 'Monthly')
      const customerRows = customers.map(c => ({
        Customer: c.name, Bills: c.count, Billed: c.billed, Collected: c.collected, 'Balance due': Math.max(0, c.billed - c.collected),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerRows), 'By customer')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const ok = await window.api.files.save({
        buffer: buf,
        filename: `lawnscape-income-${year}.xlsx`,
        filterName: 'Excel Spreadsheet',
        extensions: ['xlsx'],
      })
      if (ok) { setMsg('Report exported!'); setTimeout(() => setMsg(null), 3000) }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {msg && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm font-medium">
          <CheckCircle size={16} /> {msg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
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
            <Download size={15} /> {exporting ? 'Exporting…' : 'Export spreadsheet'}
          </button>
        </div>
      </div>

      {yearBills.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
          <BarChart3 size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">No bills in {year}</p>
        </div>
      ) : (
        <>
          {/* Year totals */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Billed in {year}</p>
              <p className="text-2xl font-bold text-green-800">${totals.billed.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-green-100">
              <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Collected</p>
              <p className="text-2xl font-bold text-green-800">${totals.collected.toFixed(2)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Balance due</p>
              <p className="text-2xl font-bold text-amber-800">${outstanding.toFixed(2)}</p>
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3 border-b border-gray-100">Month by month</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-50">
                  <th className="text-left font-medium px-4 py-2">Month</th>
                  <th className="text-right font-medium px-4 py-2">Bills</th>
                  <th className="text-right font-medium px-4 py-2">Billed</th>
                  <th className="text-right font-medium px-4 py-2">Collected</th>
                  <th className="text-right font-medium px-4 py-2">Balance due</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.name} className={`border-b border-gray-50 last:border-0 ${m.count === 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                    <td className="px-4 py-2">{m.name}</td>
                    <td className="px-4 py-2 text-right">{m.count || '—'}</td>
                    <td className="px-4 py-2 text-right">{m.count ? `$${m.billed.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2 text-right">{m.count ? `$${m.collected.toFixed(2)}` : '—'}</td>
                    <td className={`px-4 py-2 text-right ${m.balance > 0 ? 'text-amber-600 font-medium' : ''}`}>{m.count ? `$${m.balance.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-gray-800 bg-gray-100">
                  <td className="px-4 py-2">Total</td>
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
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3 border-b border-gray-100">By customer</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-50">
                  <th className="text-left font-medium px-4 py-2">Customer</th>
                  <th className="text-right font-medium px-4 py-2">Bills</th>
                  <th className="text-right font-medium px-4 py-2">Billed</th>
                  <th className="text-right font-medium px-4 py-2">Collected</th>
                  <th className="text-right font-medium px-4 py-2">Balance due</th>
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
    </div>
  )
}
