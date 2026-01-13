import { Client, Invoice, InvoiceStatus, ProductItem, Platform } from '../types';

// Keys for LocalStorage (Still used for cache/offline)
const CLIENTS_KEY = 'veneorders_clients';
const INVOICES_KEY = 'veneorders_invoices';
const SETTINGS_KEY = 'veneorders_settings';

// TU URL DE GOOGLE APPS SCRIPT
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVGUKUtZu-MSz1q2eBm5s0do8m6KtNsZy2v_TF3z5kZKz4EqkSxNjikn9Ckpn5x8e8EQ/exec';

const DEFAULT_SETTINGS = { exchangeRate: 40.5, pricePerKg: 15.43 };

// Observer Pattern for real-time UI updates
type Listener = () => void;
let listeners: Listener[] = [];

const notifyListeners = () => {
  listeners.forEach(l => l());
};

// Internal Helper: Local Storage (Cache)
const getLocal = <T>(key: string, seed: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return seed;
  try {
    const parsed = JSON.parse(data);
    // Merge objects but not arrays
    if (typeof seed === 'object' && seed !== null && !Array.isArray(seed)) {
        return { ...seed, ...parsed };
    }
    return parsed;
  } catch (e) {
    return seed;
  }
};

const setLocal = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Internal Helper: Cloud Sync
const syncToCloud = async () => {
  const data = {
    clients: getLocal(CLIENTS_KEY, []),
    invoices: getLocal(INVOICES_KEY, [])
  };

  try {
    // We use text/plain to avoid CORS preflight OPTIONS request which GAS fails to handle
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    console.log('✅ Datos sincronizados con Google Sheet');
  } catch (error) {
    console.error('❌ Error sincronizando con Google Sheet:', error);
  }
};

export const StorageService = {
  // Suscribe components to data changes
  subscribe: (listener: Listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  // Initialize: Load from Cloud
  init: async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      
      if (data.clients && Array.isArray(data.clients)) {
        setLocal(CLIENTS_KEY, data.clients);
      }
      if (data.invoices && Array.isArray(data.invoices)) {
        setLocal(INVOICES_KEY, data.invoices);
      }
      notifyListeners();
      console.log('☁️ Datos cargados desde la nube');
    } catch (error) {
      console.error('⚠️ No se pudo cargar desde la nube, usando caché local', error);
    }
  },

  // --- Clients ---
  getClients: (): Client[] => getLocal(CLIENTS_KEY, []),
  
  saveClient: (client: Client) => {
    const clients = getLocal(CLIENTS_KEY, [] as Client[]);
    const index = clients.findIndex(c => c.id === client.id);
    if (index >= 0) {
      clients[index] = client;
    } else {
      clients.push({ ...client, id: client.id || crypto.randomUUID() });
    }
    setLocal(CLIENTS_KEY, clients);
    notifyListeners();
    syncToCloud(); // Auto-save to Sheet
  },

  deleteClient: (id: string) => {
    const clients = getLocal(CLIENTS_KEY, [] as Client[]);
    const newClients = clients.filter(c => c.id !== id);
    setLocal(CLIENTS_KEY, newClients);
    notifyListeners();
    syncToCloud(); // Auto-save to Sheet
  },

  // --- Invoices ---
  getInvoices: (): Invoice[] => {
     const invoices = getLocal(INVOICES_KEY, [] as Invoice[]);
     return invoices.map(inv => ({
         ...inv,
         // Migration logic: Handle items that might still have old structure
         items: (inv.items || []).map(item => ({
             ...item,
             weight: item.weight !== undefined ? item.weight : (item as any).weightLb || 0,
             weightUnit: item.weightUnit || 'lb'
         })),
         grandTotalUsd: typeof inv.grandTotalUsd === 'number' ? inv.grandTotalUsd : 0,
         status: inv.status || InvoiceStatus.DRAFT
     }));
  },

  saveInvoice: (invoice: Invoice) => {
    const invoices = getLocal(INVOICES_KEY, [] as Invoice[]);
    const index = invoices.findIndex(i => i.id === invoice.id);
    
    // Recalculate totals ensuring no NaN
    const totalProductCost = (invoice.items || []).reduce((acc, item) => acc + ((item.originalPrice || 0) * (item.quantity || 0)), 0);
    const totalProductSale = (invoice.items || []).reduce((acc, item) => acc + ((item.finalPrice || 0) * (item.quantity || 0)), 0);
    const totalCommissions = (invoice.items || []).reduce((acc, item) => acc + ((item.commission || 0) * (item.quantity || 0)), 0);
    
    const finalInvoice: Invoice = {
      ...invoice,
      updatedAt: new Date().toISOString(),
      totalProductCost,
      totalProductSale,
      totalCommissions,
      grandTotalUsd: totalProductSale + (invoice.logisticsCost || 0)
    };

    if (index >= 0) {
      invoices[index] = finalInvoice;
    } else {
      invoices.push({ ...finalInvoice, id: invoice.id || crypto.randomUUID(), createdAt: new Date().toISOString() });
    }
    setLocal(INVOICES_KEY, invoices);
    notifyListeners();
    syncToCloud(); // Auto-save to Sheet
  },

  updateInvoiceStatus: (id: string, status: InvoiceStatus) => {
    const invoices = getLocal(INVOICES_KEY, [] as Invoice[]);
    const index = invoices.findIndex(i => i.id === id);
    if (index >= 0) {
        invoices[index] = { ...invoices[index], status, updatedAt: new Date().toISOString() };
        setLocal(INVOICES_KEY, invoices);
        notifyListeners();
        syncToCloud();
    }
  },

  deleteInvoice: (id: string) => {
    const invoices = getLocal(INVOICES_KEY, [] as Invoice[]);
    const newInvoices = invoices.filter(i => i.id !== id);
    setLocal(INVOICES_KEY, newInvoices);
    notifyListeners();
    syncToCloud(); // Auto-save to Sheet
  },

  // --- Settings ---
  getExchangeRate: (): number => {
    const settings = getLocal(SETTINGS_KEY, DEFAULT_SETTINGS); 
    return (typeof settings.exchangeRate === 'number') ? settings.exchangeRate : 40.5;
  },

  setExchangeRate: (rate: number) => {
    const settings = getLocal(SETTINGS_KEY, DEFAULT_SETTINGS);
    setLocal(SETTINGS_KEY, { ...settings, exchangeRate: rate });
    notifyListeners();
  },

  getPricePerKg: (): number => {
    const settings = getLocal(SETTINGS_KEY, DEFAULT_SETTINGS);
    return (typeof settings.pricePerKg === 'number') ? settings.pricePerKg : 15.43;
  },

  setPricePerKg: (price: number) => {
    const settings = getLocal(SETTINGS_KEY, DEFAULT_SETTINGS);
    setLocal(SETTINGS_KEY, { ...settings, pricePerKg: price });
    notifyListeners();
  },

  // Expose URL for other services if needed
  getScriptUrl: () => SCRIPT_URL
};