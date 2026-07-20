import { contextBridge, ipcRenderer } from 'electron'

// Runs in an isolated context with access to Node APIs, bridging them to the
// sandboxed renderer as `window.api`. Every method here is a thin wrapper
// around one `ipcMain.handle` in src/main/index.js — this file is the
// complete contract of what the renderer is allowed to ask the main
// process to do; nothing else crosses that boundary.
contextBridge.exposeInMainWorld('api', {
  customers: {
    getAll: () => ipcRenderer.invoke('customers:get-all'),
    save: (c) => ipcRenderer.invoke('customers:save', c),
    delete: (id) => ipcRenderer.invoke('customers:delete', id),
    import: () => ipcRenderer.invoke('customers:import'),
    bulkAdd: (list) => ipcRenderer.invoke('customers:bulk-add', list),
  },
  bills: {
    getAll: () => ipcRenderer.invoke('bills:get-all'),
    getByCustomer: (cid) => ipcRenderer.invoke('bills:get-by-customer', cid),
    save: (b) => ipcRenderer.invoke('bills:save', b),
    delete: (id) => ipcRenderer.invoke('bills:delete', id),
    setPaid: (id, paid) => ipcRenderer.invoke('bills:set-paid', { id, paid }),
    setPayment: (id, payment) => ipcRenderer.invoke('bills:set-payment', { id, payment }),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (s) => ipcRenderer.invoke('settings:save', s),
  },
  logo: {
    select: () => ipcRenderer.invoke('logo:select'),
  },
  pdf: {
    save: (buffer, filename) => ipcRenderer.invoke('pdf:save', { buffer, filename }),
    print: (buffer, filename) => ipcRenderer.invoke('pdf:print', { buffer, filename }),
  },
  email: {
    compose: (payload) => ipcRenderer.invoke('email:compose', payload),
  },
  files: {
    save: (payload) => ipcRenderer.invoke('file:save', payload),
  },
  backups: {
    openFolder: () => ipcRenderer.invoke('backups:open-folder'),
  },
  appInfo: {
    version: () => ipcRenderer.invoke('app:version'),
  },
  data: {
    export: () => ipcRenderer.invoke('data:export'),
    import: () => ipcRenderer.invoke('data:import'),
  },
})
