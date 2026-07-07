import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { pathToFileURL } from 'url'
import { autoUpdater } from 'electron-updater'
import * as XLSX from 'xlsx'

function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { return null }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// --- Customers ---
function customersPath() { return path.join(getDataDir(), 'customers.json') }
function readCustomers() { return readJSON(customersPath()) || [] }
function saveCustomer(customer) {
  const list = readCustomers()
  const idx = list.findIndex(c => c.id === customer.id)
  if (idx >= 0) list[idx] = customer; else list.push(customer)
  writeJSON(customersPath(), list)
  return customer
}
function deleteCustomer(id) {
  writeJSON(customersPath(), readCustomers().filter(c => c.id !== id))
}

// --- Customer spreadsheet import ---
const DAY_NORMAL = {
  mon: 'Monday', monday: 'Monday', tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday', thu: 'Thursday', thur: 'Thursday',
  thurs: 'Thursday', thursday: 'Thursday', fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday', sun: 'Sunday', sunday: 'Sunday',
}
function normalizeDay(s) {
  return DAY_NORMAL[String(s).toLowerCase().trim()] || ''
}
function parseCustomersFromSheet(filePath) {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '')
  return rows
    .map(row => {
      const get = (...keys) => {
        for (const k of Object.keys(row)) {
          const nk = norm(k)
          if (keys.some(key => nk === key || nk.includes(key))) return String(row[k]).trim()
        }
        return ''
      }
      return {
        name: get('name', 'customer', 'fullname'),
        address: get('address', 'street'),
        city: get('city'),
        state: get('state'),
        zip: get('zip', 'postal'),
        phone: get('phone', 'tel'),
        email: get('email'),
        serviceDay: normalizeDay(get('serviceday', 'day')),
      }
    })
    .filter(c => c.name)
}

// --- Bills ---
function billsPath() { return path.join(getDataDir(), 'bills.json') }
function readAllBills() { return readJSON(billsPath()) || [] }
// Sequential invoice numbers, starting at #1001.
function nextInvoiceNumber(list) {
  return list.reduce((m, b) => Math.max(m, Number(b.invoiceNumber) || 0), 1000) + 1
}
function saveBill(bill) {
  const list = readAllBills()
  const idx = list.findIndex(b => b.id === bill.id)
  if (idx >= 0) {
    // Updates keep their original invoice number.
    bill = { ...bill, invoiceNumber: bill.invoiceNumber ?? list[idx].invoiceNumber }
    list[idx] = bill
  } else {
    bill = { ...bill, invoiceNumber: bill.invoiceNumber ?? nextInvoiceNumber(list) }
    list.unshift(bill)
  }
  writeJSON(billsPath(), list)
  return bill
}
function deleteBill(id) {
  writeJSON(billsPath(), readAllBills().filter(b => b.id !== id))
}
function setBillPaid(id, paid) {
  const list = readAllBills()
  const idx = list.findIndex(b => b.id === id)
  if (idx < 0) return null
  list[idx] = { ...list[idx], paid: !!paid }
  writeJSON(billsPath(), list)
  return list[idx]
}
function setBillPayment(id, payment) {
  const list = readAllBills()
  const idx = list.findIndex(b => b.id === id)
  if (idx < 0) return null
  const total = Number(list[idx].total) || 0
  // Clamp to [0, total] — a payment can't exceed what was billed.
  const amountPaid = Math.min(Math.max(0, Number(payment.amountPaid) || 0), total)
  list[idx] = {
    ...list[idx],
    payment: {
      method: payment.method || '',
      checkNumber: payment.checkNumber || '',
      amountPaid,
    },
    paid: amountPaid > 0 && amountPaid >= total, // keep legacy flag in sync
  }
  writeJSON(billsPath(), list)
  return list[idx]
}

// --- Settings ---
function settingsPath() { return path.join(getDataDir(), 'settings.json') }
function readSettings() {
  const defaults = { businessName: '', phone: '', email: '', logo: null, overdueDays: 30 }
  return { ...defaults, ...(readJSON(settingsPath()) || {}) }
}
function saveSettings(settings) {
  writeJSON(settingsPath(), settings)
  return settings
}

// --- Automatic backups (weekly, kept in userData/backups, last 8 retained) ---
function backupsDir() {
  const dir = path.join(app.getPath('userData'), 'backups')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}
function maybeAutoBackup() {
  try {
    const dir = backupsDir()
    const files = fs.readdirSync(dir).filter(f => f.startsWith('auto-backup-')).sort()
    const today = new Date().toISOString().slice(0, 10)
    const last = files[files.length - 1]
    if (last) {
      const lastDate = last.slice('auto-backup-'.length, 'auto-backup-'.length + 10)
      const ageDays = (new Date(today) - new Date(lastDate)) / 86400000
      if (ageDays < 7) return
    }
    const payload = {
      app: 'lawnscape-billing',
      version: 1,
      exportedAt: new Date().toISOString(),
      auto: true,
      customers: readCustomers(),
      bills: readAllBills(),
      settings: readSettings(),
    }
    fs.writeFileSync(path.join(dir, `auto-backup-${today}.json`), JSON.stringify(payload))
    const all = fs.readdirSync(dir).filter(f => f.startsWith('auto-backup-')).sort()
    all.slice(0, Math.max(0, all.length - 8)).forEach(f => fs.unlinkSync(path.join(dir, f)))
  } catch { /* never block startup on a backup */ }
}

// --- Window ---
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true, // enables Chromium's built-in PDF viewer for in-app bill previews
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  maybeAutoBackup()

  // Check for updates on Windows only. Mac auto-update needs a paid signing
  // certificate, so Mac stays on the manual "drag to replace" flow.
  if (app.isPackaged && process.platform === 'win32') {
    autoUpdater.checkForUpdatesAndNotify()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// --- IPC Handlers ---
ipcMain.handle('customers:get-all', () => readCustomers())
ipcMain.handle('customers:save', (_, c) => saveCustomer(c))
ipcMain.handle('customers:delete', (_, id) => deleteCustomer(id))

ipcMain.handle('customers:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Customers',
    filters: [{ name: 'Spreadsheet', extensions: ['xlsx', 'xls', 'csv'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return { canceled: true }
  try {
    return { ok: true, customers: parseCustomersFromSheet(filePaths[0]) }
  } catch {
    return { ok: false, error: 'That file could not be read as a spreadsheet.' }
  }
})

ipcMain.handle('customers:bulk-add', (_, list) => {
  const existing = readCustomers()
  const now = new Date().toISOString()
  const added = (list || []).map(c => ({ ...c, id: randomUUID(), active: true, createdAt: now }))
  writeJSON(customersPath(), [...existing, ...added])
  return added.length
})

ipcMain.handle('bills:get-all', () => readAllBills())
ipcMain.handle('bills:get-by-customer', (_, cid) => readAllBills().filter(b => b.customerId === cid))
ipcMain.handle('bills:save', (_, b) => saveBill(b))
ipcMain.handle('bills:delete', (_, id) => deleteBill(id))
ipcMain.handle('bills:set-paid', (_, { id, paid }) => setBillPaid(id, paid))
ipcMain.handle('bills:set-payment', (_, { id, payment }) => setBillPayment(id, payment))

ipcMain.handle('settings:get', () => readSettings())
ipcMain.handle('settings:save', (_, s) => saveSettings(s))

ipcMain.handle('logo:select', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Business Logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return null
  const ext = path.extname(filePaths[0]).slice(1).toLowerCase()
  const data = fs.readFileSync(filePaths[0])
  return `data:image/${ext};base64,${data.toString('base64')}`
})

// --- Backup / Restore ---
ipcMain.handle('data:export', async () => {
  const payload = {
    app: 'lawnscape-billing',
    version: 1,
    exportedAt: new Date().toISOString(),
    customers: readCustomers(),
    bills: readAllBills(),
    settings: readSettings(),
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Back Up Data',
    defaultPath: `lawnscape-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'Backup File', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false, canceled: true }
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  shell.showItemInFolder(filePath)
  return { ok: true, path: filePath }
})

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restore From Backup',
    filters: [{ name: 'Backup File', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return { ok: false, canceled: true }

  let data
  try {
    data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
  } catch {
    return { ok: false, error: 'That file could not be read.' }
  }
  if (!data || (!Array.isArray(data.customers) && !Array.isArray(data.bills))) {
    return { ok: false, error: "That doesn't look like a Lawnscape backup file." }
  }

  if (Array.isArray(data.customers)) writeJSON(customersPath(), data.customers)
  if (Array.isArray(data.bills)) writeJSON(billsPath(), data.bills)
  if (data.settings) writeJSON(settingsPath(), data.settings)
  return {
    ok: true,
    counts: { customers: data.customers?.length || 0, bills: data.bills?.length || 0 },
  }
})

// Open a bill PDF in a print-ready window (Chromium's PDF viewer).
ipcMain.handle('pdf:print', async (_, { buffer, filename }) => {
  const file = path.join(app.getPath('temp'), filename || 'invoice.pdf')
  fs.writeFileSync(file, Buffer.from(buffer))
  const win = new BrowserWindow({
    width: 900,
    height: 720,
    title: 'Print Invoice',
    webPreferences: { plugins: true },
  })
  await win.loadURL(pathToFileURL(file).toString())
  return true
})

// Start an email draft to the customer and reveal the invoice PDF so it can
// be dragged into the message (mailto: can't attach files directly).
ipcMain.handle('email:compose', async (_, { to, subject, body, buffer, filename }) => {
  const file = path.join(app.getPath('temp'), filename || 'invoice.pdf')
  fs.writeFileSync(file, Buffer.from(buffer))
  shell.showItemInFolder(file)
  const mailto = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`
  await shell.openExternal(mailto)
  return true
})

// Generic "save this buffer as a file" with a save dialog (used by report exports).
ipcMain.handle('file:save', async (_, { buffer, filename, filterName, extensions }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save File',
    defaultPath: filename,
    filters: [{ name: filterName || 'File', extensions: extensions || ['*'] }],
  })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, Buffer.from(buffer))
  shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('backups:open-folder', () => shell.openPath(backupsDir()))

ipcMain.handle('app:version', () => app.getVersion())

ipcMain.handle('pdf:save', async (_, { buffer, filename }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Invoice',
    defaultPath: filename,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, Buffer.from(buffer))
  shell.showItemInFolder(filePath)
  return true
})
