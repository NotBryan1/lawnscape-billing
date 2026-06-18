import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import { autoUpdater } from 'electron-updater'

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

// --- Bills ---
function billsPath() { return path.join(getDataDir(), 'bills.json') }
function readAllBills() { return readJSON(billsPath()) || [] }
function saveBill(bill) {
  const list = readAllBills()
  const idx = list.findIndex(b => b.id === bill.id)
  if (idx >= 0) list[idx] = bill; else list.unshift(bill)
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
  return readJSON(settingsPath()) || { businessName: '', phone: '', email: '', logo: null }
}
function saveSettings(settings) {
  writeJSON(settingsPath(), settings)
  return settings
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
