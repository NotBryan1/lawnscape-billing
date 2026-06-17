import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { paymentOf, PAYMENT_METHODS } from '../utils/bills'

// Edit how a bill was paid: method, check number, and amount paid (supports partial).
export default function PaymentModal({ bill, onClose, onSaved }) {
  const initial = paymentOf(bill)
  const total = Number(bill.total) || 0
  const [method, setMethod] = useState(initial.method)
  const [checkNumber, setCheckNumber] = useState(initial.checkNumber)
  const [amountPaid, setAmountPaid] = useState(initial.amountPaid ? String(initial.amountPaid) : '')
  const [saving, setSaving] = useState(false)

  const paid = parseFloat(amountPaid) || 0
  const over = paid > total + 0.005 // can't pay more than the bill
  const balance = Math.max(0, total - paid)
  const status = paid <= 0 ? 'Unpaid' : paid + 0.005 < total ? 'Partial' : 'Paid in full'
  const statusColor = paid <= 0 ? 'text-gray-500' : paid + 0.005 < total ? 'text-amber-600' : 'text-green-600'

  async function handleSave() {
    if (over) return
    setSaving(true)
    try {
      await window.api.bills.setPayment(bill.id, {
        method,
        checkNumber: method === 'check' ? checkNumber : '',
        amountPaid: paid,
      })
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-800">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{bill.customerName} · Total <span className="font-semibold text-gray-700">${total.toFixed(2)}</span></p>

        {/* Method */}
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Payment method</label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => setMethod(method === m.value ? '' : m.value)}
              className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                method === m.value
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-green-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Check number */}
        {method === 'check' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Check number</label>
            <input
              value={checkNumber}
              onChange={e => setCheckNumber(e.target.value)}
              placeholder="e.g. 1042"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        )}

        {/* Amount paid */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">Amount paid</label>
            <button onClick={() => setAmountPaid(String(total))} className="text-xs text-green-600 hover:text-green-700 font-medium">
              Paid in full
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-400">$</span>
            <input
              type="number"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              placeholder="0.00"
              min="0"
              max={total}
              step="0.01"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                over ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-green-400'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs mt-2 mb-5">
          {over
            ? <span className="font-semibold text-red-600">Can't exceed the total of ${total.toFixed(2)}</span>
            : <span className={`font-semibold ${statusColor}`}>{status}</span>}
          {!over && paid > 0 && balance > 0 && <span className="text-gray-500">Balance due: ${balance.toFixed(2)}</span>}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || over} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            <Check size={15} /> {saving ? 'Saving…' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
