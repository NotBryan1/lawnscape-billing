import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus, Users, DollarSign, FileText, ChevronRight, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { itemsOf, billDate, parseDate, paymentOf, isOverdue } from '../utils/bills'

export default function Dashboard() {
  const navigate = useNavigate()
  const [recentBills, setRecentBills] = useState([])
  const [customerCount, setCustomerCount] = useState(0)
  const [monthTotal, setMonthTotal] = useState(0)
  const [overdueBills, setOverdueBills] = useState([])

  useEffect(() => {
    async function load() {
      const [bills, customers, settings] = await Promise.all([
        window.api.bills.getAll(),
        window.api.customers.getAll(),
        window.api.settings.get(),
      ])
      setRecentBills(bills.slice(0, 6))
      setCustomerCount(customers.length)
      const now = new Date()
      const thisMonth = bills.filter(b => {
        const d = parseDate(billDate(b))
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      setMonthTotal(thisMonth.reduce((sum, b) => sum + b.total, 0))

      const days = Number(settings.overdueDays) || 30
      setOverdueBills(
        bills.filter(b => isOverdue(b, days)).sort((a, b) => billDate(a).localeCompare(billDate(b)))
      )
    }
    load()
  }, [])

  const balanceOf = (b) => Math.max(0, (Number(b.total) || 0) - paymentOf(b).amountPaid)
  const overdueTotal = overdueBills.reduce((s, b) => s + balanceOf(b), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <button
          onClick={() => navigate('/new-bill')}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
        >
          <FilePlus size={16} /> New Bill
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={20} className="text-blue-600" />} bg="bg-blue-50" label="Customers" value={customerCount} />
        <StatCard icon={<DollarSign size={20} className="text-green-600" />} bg="bg-green-50" label="Billed This Month" value={`$${monthTotal.toFixed(2)}`} />
        <StatCard icon={<AlertTriangle size={20} className="text-red-600" />} bg="bg-red-50" label="Overdue" value={`$${overdueTotal.toFixed(2)}`} />
        <StatCard icon={<FileText size={20} className="text-purple-600" />} bg="bg-purple-50" label="Recent Bills" value={recentBills.length} />
      </div>

      {/* Overdue bills that need chasing */}
      {overdueBills.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-50">
            <h2 className="font-semibold text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle size={15} /> Needs attention — overdue bills
            </h2>
            <button onClick={() => navigate('/payments')} className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
              Go to Payments <ChevronRight size={13} />
            </button>
          </div>
          <ul>
            {overdueBills.slice(0, 5).map((bill, i) => (
              <li key={bill.id} className={`flex items-center justify-between px-4 py-2.5 ${i < Math.min(overdueBills.length, 5) - 1 ? 'border-b border-gray-50' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {bill.customerName}
                    {bill.invoiceNumber && <span className="text-xs text-gray-400 font-normal"> · #{bill.invoiceNumber}</span>}
                  </p>
                  <p className="text-xs text-gray-400">{format(parseDate(billDate(bill)), 'MMM d, yyyy')}</p>
                </div>
                <p className="text-sm font-bold text-red-600">${balanceOf(bill).toFixed(2)} due</p>
              </li>
            ))}
          </ul>
          {overdueBills.length > 5 && (
            <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">+{overdueBills.length - 5} more in Payments</p>
          )}
        </div>
      )}

      {/* Recent bills */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm">Recent Bills</h2>
          <button onClick={() => navigate('/history')} className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
            View all <ChevronRight size={13} />
          </button>
        </div>

        {recentBills.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm font-medium">No bills yet</p>
            <p className="text-xs mt-1">Create your first bill to get started</p>
          </div>
        ) : (
          <ul>
            {recentBills.map((bill, i) => (
              <li key={bill.id} className={`flex items-center justify-between px-4 py-3 ${i < recentBills.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{bill.customerName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{itemsOf(bill).map(i => i.name).join(' · ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">${Number(bill.total).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">
                    {format(parseDate(billDate(bill)), 'MMM d, yyyy')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, bg, label, value }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-white`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-white rounded-lg shadow-sm">{icon}</div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  )
}
