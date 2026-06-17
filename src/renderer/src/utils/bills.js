// Helpers for working with bills. Bills now support multiple "work days"
// (a property visited several times in a month). Older bills stored a single
// top-level `date` + `items`; these helpers normalize both shapes so every
// view can treat a bill the same way.

const DEFAULT_SERVICES = ['Mowing', 'Mulch', 'Trimming']

// Returns an array of { id, date, items } for a bill, regardless of whether
// it uses the new `workDays` shape or the legacy single-day shape.
export function workDaysOf(bill) {
  if (Array.isArray(bill.workDays) && bill.workDays.length) return bill.workDays
  return [{ id: 'legacy', date: bill.date, items: bill.items || [] }]
}

// All line items across every work day, flattened.
export function itemsOf(bill) {
  return workDaysOf(bill).flatMap(d => d.items || [])
}

// The bill's primary date (the most recent work day) — used for sorting,
// list display, and month/year filtering. Dates are 'yyyy-MM-dd' strings.
export function billDate(bill) {
  if (bill.date) return bill.date
  const dates = workDaysOf(bill).map(d => d.date).filter(Boolean).sort()
  return dates[dates.length - 1] || ''
}

// Parse a 'yyyy-MM-dd' string into a local Date (avoids UTC off-by-one).
export function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

export { DEFAULT_SERVICES }
