import { Client, Invoice, InvoiceStatus, ProductItem, Platform } from '../types';

// Keys for LocalStorage
const CLIENTS_KEY = 'veneorders_clients';
const INVOICES_KEY = 'veneorders_invoices';
const SETTINGS_KEY = 'veneorders_settings';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVGUKUtZu-MSz1q2eBm5s0do8m6KtNsZy2v_TF3z5kZKz4EqkSxNjikn9Ckpn5x8e8EQ/exec';
const DEFAULT_SETTINGS = { exchangeRate: 40.5, scriptUrl: DEFAULT_SCRIPT_URL };

// Seed data to ensure the user sees something immediately
const seedClients: Client[] = [
  { id: '1', name: 'Maria Pérez', email: 'maria@gmail.com', phone: '0414-1234567', address: 'Caracas, Altamira' },
  { id: '2', name: 'Jose Rodriguez', email: 'jose@hotmail.com', phone: '0424-9876543', address: 'Valencia, Prebo' },
];

const seedInvoices: Invoice[] = [
  {
    id: 'inv_001',
    clientId: '1',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    status: InvoiceStatus.PAID,
    exchangeRate: 36.5,
    items: [
      {
        id: 'p1',
        name: 'Vestido Floral',
        quantity: 1,
        weightLb: 0.5,
        platform: Platform.SHEIN,
        originalPrice: 12.00,
        finalPrice: 15.00,
        commission: 2.00,
        trackingNumber: 'TRACK123'
      }
    ],
    logisticsCost: 5.00,
    totalProductCost: 12.00,
    totalProductSale: 15.00,
    totalCommissions: 2.00,
    grandTotalUsd: 20.00 // 15 + 5
  }
];

// Helper to simulate delay for "Async" feel if needed, but we keep it sync for speed
const getStorage = <T>(key: string, seed: T): T => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(data);
    // Merge with seed to ensure new fields exist if structure changed (e.g. adding scriptUrl)
    if (typeof seed === 'object' && seed !== null && !Array.isArray(seed)) {
        return { ...seed, ...parsed };
    }
    return parsed;
  } catch (e) {
    return seed;
  }
};

const setStorage = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const StorageService = {
  getClients: (): Client[] => getStorage(CLIENTS_KEY, seedClients),
  
  saveClient: (client: Client) => {
    const clients = getStorage(CLIENTS_KEY, seedClients);
    const index = clients.findIndex(c => c.id === client.id);
    if (index >= 0) {
      clients[index] = client;
    } else {
      clients.push({ ...client, id: crypto.randomUUID() });
    }
    setStorage(CLIENTS_KEY, clients);
  },

  deleteClient: (id: string) => {
    const clients = getStorage(CLIENTS_KEY, seedClients);
    setStorage(CLIENTS_KEY, clients.filter(c => c.id !== id));
  },

  getInvoices: (): Invoice[] => {
     const invoices = getStorage(INVOICES_KEY, seedInvoices);
     // Validate basic structure
     return invoices.map(inv => ({
         ...inv,
         items: inv.items || [],
         grandTotalUsd: typeof inv.grandTotalUsd === 'number' ? inv.grandTotalUsd : 0,
         status: inv.status || InvoiceStatus.DRAFT
     }));
  },

  saveInvoice: (invoice: Invoice) => {
    const invoices = getStorage(INVOICES_KEY, seedInvoices);
    const index = invoices.findIndex(i => i.id === invoice.id);
    
    // Auto calculate totals before saving to ensure consistency
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
    setStorage(INVOICES_KEY, invoices);
  },

  deleteInvoice: (id: string) => {
    const invoices = getStorage(INVOICES_KEY, seedInvoices);
    setStorage(INVOICES_KEY, invoices.filter(i => i.id !== id));
  },

  getExchangeRate: (): number => {
    const settings = getStorage(SETTINGS_KEY, DEFAULT_SETTINGS); 
    return (typeof settings.exchangeRate === 'number') ? settings.exchangeRate : 40.5;
  },

  setExchangeRate: (rate: number) => {
    const settings = getStorage(SETTINGS_KEY, DEFAULT_SETTINGS);
    setStorage(SETTINGS_KEY, { ...settings, exchangeRate: rate });
  },

  // --- Sync Methods ---
  
  getScriptUrl: (): string => {
    const settings = getStorage(SETTINGS_KEY, DEFAULT_SETTINGS);
    return settings.scriptUrl || DEFAULT_SCRIPT_URL;
  },

  setScriptUrl: (url: string) => {
    const settings = getStorage(SETTINGS_KEY, DEFAULT_SETTINGS);
    setStorage(SETTINGS_KEY, { ...settings, scriptUrl: url });
  },

  getAllData: () => {
    return {
      clients: getStorage(CLIENTS_KEY, seedClients),
      invoices: getStorage(INVOICES_KEY, seedInvoices)
    };
  },

  overwriteAllData: (clients: Client[], invoices: Invoice[]) => {
    setStorage(CLIENTS_KEY, clients);
    setStorage(INVOICES_KEY, invoices);
  }
};