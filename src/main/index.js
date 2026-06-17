import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'

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
