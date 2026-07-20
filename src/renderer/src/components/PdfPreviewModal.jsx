import { useEffect, useState } from 'react'
import { X, FileDown } from 'lucide-react'
import { generateBillPDF } from '../utils/pdf'
import { billDate } from '../utils/bills'
import { useLang } from '../i18n'

/**
 * Renders a bill's PDF in-app (no download) using Chromium's PDF viewer, in
 * an object URL generated client-side and revoked on unmount.
 * @param {object} props
 * @param {object} props.bill
 * @param {object} props.settings business info stamped onto the invoice
 * @param {() => void} props.onClose
 * @param {() => void} [props.onDownload] overrides the default "save to disk" behavior when provided
 * @param {string} [props.downloadLabel='Download'] label for the download button (translated by the caller)
 */
export default function PdfPreviewModal({ bill, settings, onClose, onDownload, downloadLabel = 'Download' }) {
  const { t } = useLang()
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let objUrl
    let active = true
    generateBillPDF(bill, settings).then(buf => {
      if (!active) return
      const blob = new Blob([buf], { type: 'application/pdf' })
      objUrl = URL.createObjectURL(blob)
      setUrl(objUrl)
    })
    return () => { active = false; if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [bill, settings])

  async function handleDownload() {
    if (onDownload) { onDownload(); return }
    const buf = await generateBillPDF(bill, settings)
    const name = `invoice-${bill.customerName.replace(/\s+/g, '-')}-${billDate(bill)}.pdf`
    await window.api.pdf.save(buf, name)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800 truncate">{t('Preview')} — {bill.customerName}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleDownload} className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700">
              <FileDown size={14} /> {t(downloadLabel)}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 bg-gray-200 rounded-b-xl overflow-hidden">
          {url ? (
            <iframe title={t('Bill preview')} src={url} className="w-full h-full border-0" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">{t('Generating preview…')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
