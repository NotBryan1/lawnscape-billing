// Helpers for working with bills. Bills now support multiple "work days"
// (a property visited several times in a month). Older bills stored a single
// top-level `date` + `items`; these helpers normalize both shapes so every
// view can treat a bill the same way.

const DEFAULT_SERVICES = ['Lawn Mowing', 'Mulch', 'Maintenance']

// Days of the week a customer can be assigned for recurring service.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DOW_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }

/**
 * JS `Date.getDay()` index (0 = Sunday) for a weekday name.
 * @param {string} name e.g. 'Monday'
 * @returns {number} 0-6, or -1 if unrecognized
 */
export function weekdayIndex(name) {
  return name in DOW_INDEX ? DOW_INDEX[name] : -1
}

/**
 * Every work day on a bill, oldest → newest, regardless of storage shape.
 * @param {object} bill
 * @returns {Array<{id: string, date: string, items: object[]}>}
 */
export function workDaysOf(bill) {
  const days = (Array.isArray(bill.workDays) && bill.workDays.length)
    ? bill.workDays
    : [{ id: 'legacy', date: bill.date, items: bill.items || [] }]
  return [...days].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

/** All line items across every work day on a bill, flattened into one array. */
export function itemsOf(bill) {
  return workDaysOf(bill).flatMap(d => d.items || [])
}

/**
 * The bill's primary date — its period end if it has one, otherwise its
 * most recent work day. Used for sorting, list display, and month/year
 * filtering.
 * @param {object} bill
 * @returns {string} 'yyyy-MM-dd', or '' if the bill has no dates at all
 */
export function billDate(bill) {
  if (bill.periodEnd) return bill.periodEnd
  if (bill.date) return bill.date
  const dates = workDaysOf(bill).map(d => d.date).filter(Boolean).sort()
  return dates[dates.length - 1] || ''
}

/**
 * The service period a bill covers (e.g. monthly billing spans a date range).
 * @param {object} bill
 * @returns {{start: string, end: string} | null} null for single/multi-day bills with no period
 */
export function billPeriod(bill) {
  if (bill.periodStart && bill.periodEnd) return { start: bill.periodStart, end: bill.periodEnd }
  return null
}

/** Parses a 'yyyy-MM-dd' string into a local Date (avoids the UTC off-by-one `new Date(str)` gives). */
export function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

/**
 * A signature for detecting duplicate bills: same customer, same work
 * dates, and same set of services ("same dates and jobs"). Two bills with
 * equal signatures trigger the "duplicate bill" warning in New Bill.
 */
export function billSignature(bill) {
  const dates = workDaysOf(bill).map(d => d.date).filter(Boolean).sort().join(',')
  const jobs = [...new Set(itemsOf(bill).map(i => (i.name || '').trim().toLowerCase()).filter(Boolean))].sort().join(',')
  return `${bill.customerId}|${dates}|${jobs}`
}

/**
 * Normalized payment info for a bill. Falls back to the legacy `paid`
 * boolean (a paid bill with no payment record is treated as paid in full),
 * so older bills saved before payment tracking existed still work.
 * @param {object} bill
 * @returns {{method: string, checkNumber: string, amountPaid: number}}
 */
export function paymentOf(bill) {
  const p = bill.payment || {}
  const hasAmount = p.amountPaid != null && p.amountPaid !== ''
  const amountPaid = hasAmount
    ? Number(p.amountPaid) || 0
    : (bill.paid ? Number(bill.total) || 0 : 0)
  return { method: p.method || '', checkNumber: p.checkNumber || '', amountPaid }
}

/**
 * A bill is overdue when it isn't fully paid and its date is more than
 * `days` days in the past. Drafts are still being edited, so they're never
 * chased as overdue.
 * @param {object} bill
 * @param {number} [days=30]
 */
export function isOverdue(bill, days = 30) {
  if (bill.draft) return false
  if (paymentStatus(bill) === 'paid') return false
  const due = parseDate(billDate(bill))
  due.setDate(due.getDate() + (Number(days) || 30))
  return new Date() > due
}

/** @returns {'paid' | 'partial' | 'unpaid'} based on amount paid vs total. */
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

/** Display label for a PAYMENT_METHODS value, or '' if unrecognized. */
export function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || ''
}

export { DEFAULT_SERVICES }
