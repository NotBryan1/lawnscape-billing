import { jsPDF } from 'jspdf'

export async function generateBillPDF(bill, settings) {
  const doc = new jsPDF()
  const W = doc.internal.pageSize.getWidth()
  let y = 15

  // Logo + business header
  if (settings.logo) {
    try {
      const fmt = settings.logo.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(settings.logo, fmt, 14, y, 35, 18)
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

  // Invoice label + date
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('INVOICE', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Date: ${formatDate(bill.date)}`, W - 14, y, { align: 'right' })
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

  // Table rows
  doc.setFont('helvetica', 'normal')
  bill.items.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(245, 248, 245)
      doc.rect(14, y, W - 28, 7, 'F')
    }
    doc.text(item.name, 19, y + 5)
    doc.text(`$${Number(item.price).toFixed(2)}`, W - 19, y + 5, { align: 'right' })
    y += 7
  })

  // Total row
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

  return doc.output('arraybuffer')
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
