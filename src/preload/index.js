import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  customers: {
    getAll: () => ipcRenderer.invoke('customers:get-all'),
    save: (c) => ipcRenderer.invoke('customers:save', c),
    delete: (id) => ipcRenderer.invoke('customers:delete', id),
  },
  bills: {
    getAll: () => ipcRenderer.invoke('bills:get-all'),
    getByCustomer: (cid) => ipcRenderer.invoke('bills:get-by-customer', cid),
    save: (b) => ipcRenderer.invoke('bills:save', b),
    delete: (id) => ipcRenderer.invoke('bills:delete', id),
    setPaid: (id, paid) => ipcRenderer.invoke('bills:set-paid', { id, paid }),
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
  },
})
