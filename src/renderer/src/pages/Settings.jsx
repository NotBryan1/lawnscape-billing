import { useState, useEffect } from 'react'
import { Save, Upload, X, CheckCircle, Download, RotateCcw, AlertTriangle, ChevronDown } from 'lucide-react'
import { useSettings } from '../SettingsContext'
import { useLang } from '../i18n'

export default function Settings() {
  const { reloadSettings } = useSettings()
  const { lang, setLang, t } = useLang()
  const [form, setForm] = useState({ businessName: '', phone: '', email: '', logo: null })
  const [saved, setSaved] = useState(false)
  const [backupMsg, setBackupMsg] = useState(null)
  const [confirmRestore, setConfirmRestore] = useState(false)

  useEffect(() => {
    window.api.settings.get().then(s => { if (s) setForm(s) })
  }, [])

  async function pickLogo() {
    const data = await window.api.logo.select()
    if (data) setForm(f => ({ ...f, logo: data }))
  }

  async function handleSave() {
    await window.api.settings.save({ ...form, overdueDays: Number(form.overdueDays) || 30 })
    await reloadSettings()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function flashBackup(msg) {
    setBackupMsg(msg)
    setTimeout(() => setBackupMsg(null), 4000)
  }

  async function handleBackup() {
    const res = await window.api.data.export()
    if (res.ok) flashBackup({ type: 'ok', text: t('Backup saved! Keep it somewhere safe (iCloud, Dropbox, USB).') })
    else if (!res.canceled) flashBackup({ type: 'err', text: t('Backup failed.') })
  }

  async function doRestore() {
    setConfirmRestore(false)
    const res = await window.api.data.import()
    if (res.ok) {
      await reloadSettings()
      const s = await window.api.settings.get()
      if (s) setForm(s)
      flashBackup({ type: 'ok', text: t('Restored {customers} customers and {bills} bills. Revisit each tab to see them.', { customers: res.counts.customers, bills: res.counts.bills }) })
    } else if (!res.canceled) {
      flashBackup({ type: 'err', text: res.error || t('Restore failed.') })
    }
  }

  return (
    <div className="p-6 max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('Business Settings')}</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        {/* Logo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">{t('Business Logo')}</label>
          {form.logo ? (
            <div className="flex items-center gap-3">
              <img src={form.logo} alt="Logo" className="h-14 w-auto object-contain border border-gray-200 rounded-lg p-1.5 bg-gray-50" />
              <button
                onClick={() => setForm(f => ({ ...f, logo: null }))}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <X size={12} /> {t('Remove')}
              </button>
            </div>
          ) : (
            <button
              onClick={pickLogo}
              className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors w-full"
            >
              <Upload size={15} /> {t('Upload logo (PNG or JPG)')}
            </button>
          )}
        </div>

        <Field label={t('Business Name')} value={form.businessName} onChange={v => setForm(f => ({ ...f, businessName: v }))} placeholder="Green Valley Lawnscaping" />
        <Field label={t('Phone Number')} value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="555-555-5555" />
        <Field label={t('Email Address')} value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="info@yourbusiness.com" type="email" />
        <div>
          <Field label={t('Mark bills overdue after (days)')} value={String(form.overdueDays ?? 30)} onChange={v => setForm(f => ({ ...f, overdueDays: v }))} placeholder="30" type="number" />
          <p className="text-xs text-gray-400 mt-1">{t('Unpaid bills older than this show a red "Overdue" flag.')}</p>
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm mt-2"
        >
          {saved ? <><CheckCircle size={15} /> {t('Saved!')}</> : <><Save size={15} /> {t('Save Settings')}</>}
        </button>
      </div>

      {/* Language */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Language / Idioma</h2>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          {t('Changes the app only — invoices and emails sent to clients always stay in English.')}
        </p>
        <div className="relative">
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">{t('Data & Backup')}</h2>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          {t('Save a single file with all your customers, bills, and settings — or restore everything from one.')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleBackup}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
          >
            <Download size={15} /> {t('Back up data')}
          </button>
          <button
            onClick={() => setConfirmRestore(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <RotateCcw size={15} /> {t('Restore')}
          </button>
        </div>
        {backupMsg && (
          <p className={`text-xs mt-2.5 leading-relaxed ${backupMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {backupMsg.text}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          {t('A backup is also saved automatically once a week (the last 8 are kept).')}{' '}
          <button onClick={() => window.api.backups.openFolder()} className="text-green-600 underline hover:text-green-700">{t('Open backups folder')}</button>
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-400 leading-relaxed">
        {t('Your data (customers, bills, settings) is stored locally on this computer and is never uploaded anywhere.')}
      </p>

      {/* Restore confirmation */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmRestore(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="font-semibold text-gray-800">{t('Restore from backup?')}</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {t('This')} <span className="font-medium text-gray-700">{t('replaces')}</span> {t('your current customers, bills, and settings with the contents of the backup file. Consider backing up first.')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRestore(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">{t('Cancel')}</button>
              <button onClick={doRestore} className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">{t('Choose backup file…')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
      />
    </div>
  )
}
