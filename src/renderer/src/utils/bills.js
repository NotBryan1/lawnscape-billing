// Helpers for working with bills. Bills now support multiple "work days"
// (a property visited several times in a month). Older bills stored a single
// top-level `date` + `items`; these helpers normalize both shapes so every
// view can treat a bill the same way.

const DEFAULT_SERVICES = ['Lawn Mowing', 'Mulch']

// Days of the week a customer can be assigned for recurring service.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DOW_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }

// JS Date.getDay() index (0=Sun) for a weekday name, or -1 if unknown.
export function weekdayIndex(name) {
  return name in DOW_INDEX ? DOW_INDEX[name] : -1
}

// Returns an array of { id, date, items } for a bill, sorted oldest → newest,
// regardless of whether it uses the new `workDays` shape or the legacy single-day shape.
export function workDaysOf(bill) {
  const days = (Array.isArray(bill.workDays) && bill.workDays.length)
    ? bill.workDays
    : [{ id: 'legacy', date: bill.date, items: bill.items || [] }]
  return [...days].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

// All line items across every work day, flattened.
export function itemsOf(bill) {
  return workDaysOf(bill).flatMap(d => d.items || [])
}

// The bill's primary date (the most recent work day) — used for sorting,
// list display, and month/year filtering. Dates are 'yyyy-MM-dd' strings.
export function billDate(bill) {
  if (bill.periodEnd) return bill.periodEnd
  if (bill.date) return bill.date
  const dates = workDaysOf(bill).map(d => d.date).filter(Boolean).sort()
  return dates[dates.length - 1] || ''
}

// A service period range { start, end } for bills billed over a span (e.g. monthly
// billing), or null for single-date/multi-day bills.
export function billPeriod(bill) {
  if (bill.periodStart && bill.periodEnd) return { start: bill.periodStart, end: bill.periodEnd }
  return null
}

// Parse a 'yyyy-MM-dd' string into a local Date (avoids UTC off-by-one).
export function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

// Normalized payment info for a bill. Falls back to the legacy `paid` boolean
// (a paid bill with no payment record is treated as paid in full).
export function paymentOf(bill) {
  const p = bill.payment || {}
  const hasAmount = p.amountPaid != null && p.amountPaid !== ''
  const amountPaid = hasAmount
    ? Number(p.amountPaid) || 0
    : (bill.paid ? Number(bill.total) || 0 : 0)
  return { method: p.method || '', checkNumber: p.checkNumber || '', amountPaid }
}

// 'paid' | 'partial' | 'unpaid' for a bill, based on amount paid vs total.
export function paymentStatus(bill) {
  const total = Number(bill.total) || 0
  const { amountPaid } = paymentOf(bill)
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid + 0.005 < total) return 'partial'
  return 'paid'
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other' },
]

export function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || ''
}

export { DEFAULT_SERVICES }
