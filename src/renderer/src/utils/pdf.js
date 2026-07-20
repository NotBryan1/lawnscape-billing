import { jsPDF } from 'jspdf'
import { workDaysOf, billPeriod } from './bills'

// Add a new page if there isn't room for `needed` mm of content; returns the y to use.
function ensureSpace(doc, y, needed) {
  if (y + needed > doc.internal.pageSize.getHeight() - 18) {
    doc.addPage()
    return 18
  }
  return y
}

// Render one invoice onto the current page of `doc`, starting at the top.
function renderBill(doc, bill, settings) {
  const W = doc.internal.pageSize.getWidth()
  let y = 15
  doc.setTextColor(0, 0, 0)

  // Logo + business header — drawn in a fixed square box (equal width & height).
  if (settings.logo) {
    try {
      const fmt = settings.logo.includes('image/png') ? 'PNG' : 'JPEG'
      const LOGO = 24
      doc.addImage(settings.logo, fmt, 14, y, LOGO, LOGO)
    } catch (_) { /* skip broken logo */ }
  }

  const biz = settings.businessName || 'Your Business'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(biz, W - 14, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (settings.phone) { y += 3; doc.text(settings.phone, W - 14, y + 8, { align: 'right' }) }
  if (settings.email) { doc.text(settings.email, W - 14, y + 13, { align: 'right' }) }

  y = 42
  doc.setDrawColor(180)
  doc.setLineWidth(0.4)
  doc.line(14, y, W - 14, y)
  y += 8

  // Work days (one or many visits in the billing period)
  const days = workDaysOf(bill)
  const multiDay = days.length > 1

  // Invoice label + date(s)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(bill.invoiceNumber ? `INVOICE #${bill.invoiceNumber}` : 'INVOICE', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const period = billPeriod(bill)
  const dateLabel = period
    ? `Service period: ${formatDate(period.start)} – ${formatDate(period.end)}`
    : multiDay
      ? `Dates: ${formatDate(days[0].date)} – ${formatDate(days[days.length - 1].date)}`
      : `Date: ${formatDate(days[0].date)}`
  doc.text(dateLabel, W - 14, y, { align: 'right' })
  y += 12

  // Bill to
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('BILL TO', 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(bill.customerName, 14, y); y += 5
  if (bill.customerAddress) { doc.text(bill.customerAddress, 14, y); y += 5 }
  const cityLine = [bill.customerCity, bill.customerState, bill.customerZip].filter(Boolean).join(', ')
  if (cityLine) { doc.text(cityLine, 14, y); y += 5 }
  if (bill.customerPhone) { doc.text(bill.customerPhone, 14, y); y += 5 }
  if (bill.customerEmail) { doc.text(bill.customerEmail, 14, y); y += 5 }
  y += 6

  // Table header
  doc.setFillColor(34, 139, 34)
  doc.rect(14, y, W - 28, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Service', 19, y + 5.5)
  doc.text('Amount', W - 19, y + 5.5, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y += 8

  // Table rows — grouped by work day when there's more than one
  doc.setFont('helvetica', 'normal')
  let rowIdx = 0
  days.forEach(day => {
    if (multiDay) {
      y = ensureSpace(doc, y, 13)
      doc.setFillColor(225, 236, 225)
      doc.rect(14, y, W - 28, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(formatDate(day.date), 19, y + 4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      y += 6
    }
    ;(day.items || []).forEach(item => {
      y = ensureSpace(doc, y, 7)
      if (rowIdx % 2 === 0) {
        doc.setFillColor(245, 248, 245)
        doc.rect(14, y, W - 28, 7, 'F')
      }
      doc.text(item.name, multiDay ? 24 : 19, y + 5)
      doc.text(`$${Number(item.price).toFixed(2)}`, W - 19, y + 5, { align: 'right' })
      y += 7
      rowIdx++
    })
    // Optional note for this specific day
    if (day.note && String(day.note).trim()) {
      y = ensureSpace(doc, y, 10)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(120, 120, 120)
      const noteLines = doc.splitTextToSize(`Note: ${String(day.note).trim()}`, W - 48)
      doc.text(noteLines, multiDay ? 24 : 19, y + 4)
      y += noteLines.length * 4 + 3
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
    }
  })

  // Total row
  y = ensureSpace(doc, y, 20)
  doc.setLineWidth(0.4)
  doc.line(14, y, W - 14, y)
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL', 19, y)
  doc.text(`$${Number(bill.total).toFixed(2)}`, W - 19, y, { align: 'right' })
  y += 12

  // Notes
  if (bill.notes && bill.notes.trim()) {
    y = ensureSpace(doc, y, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Notes:', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(bill.notes, W - 28)
    doc.text(lines, 14, y)
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 12
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text('Thank you for your business!', W / 2, footerY, { align: 'center' })
}

// One bill → a PDF buffer. `autoPrint` embeds a print request so viewers
// that support it pop the print dialog on open.
export async function generateBillPDF(bill, settings, opts = {}) {
  const doc = new jsPDF()
  renderBill(doc, bill, settings)
  if (opts.autoPrint && typeof doc.autoPrint === 'function') doc.autoPrint()
  return doc.output('arraybuffer')
}

// Many bills → a single PDF buffer, one invoice per page.
export async function generateBillsPDF(bills, settings) {
  const doc = new jsPDF()
  bills.forEach((bill, i) => {
    if (i > 0) doc.addPage()
    renderBill(doc, bill, settings)
  })
  return doc.output('arraybuffer')
}

// Owner-facing printable client directory. Labels arrive already translated
// (this report follows the app language; invoices always stay English).
export async function generateDirectoryPDF(rows, labels, opts = {}) {
  const doc = new jsPDF()
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const X = { name: 14, address: 62, contact: 126, avg: W - 14 }
  const WIDTHS = { name: 44, address: 60, contact: 46 }

  let y = 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(labels.title, 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(130, 130, 130)
  doc.text(labels.subtitle, 14, y + 6)
  doc.setTextColor(0, 0, 0)
  y += 13

  const drawHeader = () => {
    doc.setFillColor(34, 139, 34)
    doc.rect(14, y, W - 28, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(labels.name, X.name + 2, y + 5.5)
    doc.text(labels.address, X.address, y + 5.5)
    doc.text(labels.contact, X.contact, y + 5.5)
    doc.text(labels.avg, X.avg - 2, y + 5.5, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    y += 8
  }
  drawHeader()

  rows.forEach((r, i) => {
    const nameLines = doc.splitTextToSize(r.name, WIDTHS.name)
    const addrLines = r.address ? doc.splitTextToSize(r.address, WIDTHS.address) : ['—']
    const contactLines = r.contact.length
      ? r.contact.flatMap(cLine => doc.splitTextToSize(cLine, WIDTHS.contact))
      : ['—']
    const lineCount = Math.max(nameLines.length, addrLines.length, contactLines.length)
    const rowH = lineCount * 3.8 + 3
    if (y + rowH > H - 16) {
      doc.addPage()
      y = 16
      drawHeader()
    }
    if (i % 2 === 0) {
      doc.setFillColor(245, 248, 245)
      doc.rect(14, y, W - 28, rowH, 'F')
    }
    doc.text(nameLines, X.name + 2, y + 4.5)
    doc.text(addrLines, X.address, y + 4.5)
    doc.text(contactLines, X.contact, y + 4.5)
    doc.text(r.avg, X.avg - 2, y + 4.5, { align: 'right' })
    y += rowH
  })

  if (opts.autoPrint && typeof doc.autoPrint === 'function') doc.autoPrint()
  return doc.output('arraybuffer')
}

// Printable field form: every active client on one compact row, with a
// blank Date/Work grid for a worker to fill in by hand — one row per client
// rather than a whole block, so a long client list still fits in a handful
// of pages. Landscape + no billing data involved, so it stays
// language-neutral like generateDirectoryPDF.
export async function generateMonthlySheetPDF(rows, labels, opts = {}) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const visits = opts.visits || 5
  const MIN_ROW_H = 11
  const HEAD_H = 9
  const NAME_W = 38
  const ADDR_W = 52
  const VISIT_W = (W - 28 - NAME_W - ADDR_W) / visits
  const DATE_W = VISIT_W * 0.35
  const X = { name: 14, address: 14 + NAME_W, visits: 14 + NAME_W + ADDR_W }

  let y = 16

  function drawTitle() {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(labels.title, W / 2, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(130, 130, 130)
    doc.text(labels.subtitle, W / 2, y + 6, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    y += 13
  }

  function drawHeader() {
    doc.setFillColor(34, 139, 34)
    doc.rect(14, y, W - 28, HEAD_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(labels.name, X.name + 2, y + 6)
    doc.text(labels.address, X.address + 2, y + 6)
    for (let i = 0; i < visits; i++) {
      const vx = X.visits + i * VISIT_W
      doc.text(labels.date, vx + 2, y + 6)
      doc.text(labels.work, vx + DATE_W + 2, y + 6)
    }
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    y += HEAD_H
  }

  drawTitle()
  drawHeader()

  rows.forEach((r, i) => {
    const nameLines = doc.splitTextToSize(r.name, NAME_W - 3)
    const addrLines = r.address ? doc.splitTextToSize(r.address, ADDR_W - 3) : []
    const rowH = Math.max(MIN_ROW_H, Math.max(nameLines.length, addrLines.length) * 3.8 + 3)

    if (y + rowH > H - 14) {
      doc.addPage()
      y = 16
      drawHeader()
    }

    if (i % 2 === 0) {
      doc.setFillColor(245, 248, 245)
      doc.rect(14, y, W - 28, rowH, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(nameLines, X.name + 2, y + 4.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 90, 90)
    doc.text(addrLines, X.address + 2, y + 4.5)
    doc.setTextColor(0, 0, 0)

    doc.setDrawColor(200)
    doc.setLineWidth(0.25)
    doc.line(14, y, 14, y + rowH)
    doc.line(X.address, y, X.address, y + rowH)
    for (let v = 0; v < visits; v++) {
      const vx = X.visits + v * VISIT_W
      doc.line(vx, y, vx, y + rowH)
      doc.line(vx + DATE_W, y, vx + DATE_W, y + rowH)
    }
    doc.line(W - 14, y, W - 14, y + rowH)
    doc.line(14, y + rowH, W - 14, y + rowH)

    y += rowH
  })

  if (opts.autoPrint && typeof doc.autoPrint === 'function') doc.autoPrint()
  return doc.output('arraybuffer')
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
