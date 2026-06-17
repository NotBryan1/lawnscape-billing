import { useState, useEffect } from 'react'
import { Save, Upload, X, CheckCircle, Download, RotateCcw, AlertTriangle } from 'lucide-react'
import { useSettings } from '../SettingsContext'

export default function Settings() {
  const { reloadSettings } = useSettings()
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
    await window.api.settings.save(form)
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
    if (res.ok) flashBackup({ type: 'ok', text: 'Backup saved! Keep it somewhere safe (iCloud, Dropbox, USB).' })
    else if (!res.canceled) flashBackup({ type: 'err', text: 'Backup failed.' })
  }

  async function doRestore() {
    setConfirmRestore(false)
    const res = await window.api.data.import()
    if (res.ok) {
      await reloadSettings()
      const s = await window.api.settings.get()
      if (s) setForm(s)
      flashBackup({ type: 'ok', text: `Restored ${res.counts.customers} customers and ${res.counts.bills} bills. Revisit each tab to see them.` })
    } else if (!res.canceled) {
      flashBackup({ type: 'err', text: res.error || 'Restore failed.' })
    }
  }

  return (
    <div className="p-6 max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Business Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        {/* Logo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Business Logo</label>
          {form.logo ? (
            <div className="flex items-center gap-3">
              <img src={form.logo} alt="Logo" className="h-14 w-auto object-contain border border-gray-200 rounded-lg p-1.5 bg-gray-50" />
              <button
                onClick={() => setForm(f => ({ ...f, logo: null }))}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <X size={12} /> Remove
              </button>
            </div>
          ) : (
            <button
              onClick={pickLogo}
              className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors w-full"
            >
              <Upload size={15} /> Upload logo (PNG or JPG)
            </button>
          )}
        </div>

        <Field label="Business Name" value={form.businessName} onChange={v => setForm(f => ({ ...f, businessName: v }))} placeholder="Green Valley Lawnscaping" />
        <Field label="Phone Number" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="555-555-5555" />
        <Field label="Email Address" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="info@yourbusiness.com" type="email" />

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm mt-2"
        >
          {saved ? <><CheckCircle size={15} /> Saved!</> : <><Save size={15} /> Save Settings</>}
        </button>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Data &amp; Backup</h2>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          Save a single file with all your customers, bills, and settings — or restore everything from one.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleBackup}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
          >
            <Download size={15} /> Back up data
          </button>
          <button
            onClick={() => setConfirmRestore(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <RotateCcw size={15} /> Restore
          </button>
        </div>
        {backupMsg && (
          <p className={`text-xs mt-2.5 leading-relaxed ${backupMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {backupMsg.text}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400 leading-relaxed">
        Your data (customers, bills, settings) is stored locally on this computer and is never uploaded anywhere.
      </p>

      {/* Restore confirmation */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmRestore(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="font-semibold text-gray-800">Restore from backup?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              This <span className="font-medium text-gray-700">replaces</span> your current customers, bills, and settings with the contents of the backup file. Consider backing up first.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRestore(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={doRestore} className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">Choose backup file…</button>
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
