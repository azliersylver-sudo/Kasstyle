import { Client, Invoice, InvoiceStatus, ProductItem } from '../types';

// TU URL DE GOOGLE APPS SCRIPT - ACTUALIZADA
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbySF0TpviuKK2snM2piFc1Zlu3nH6Cz8O4jaH4jajic3gOsLlbDtblAjNluW90E04jwQw/exec';

const DEFAULT_SETTINGS = { exchangeRate: 40.5, pricePerKg: 15.43 };

// --- Helper: Safe Float Parsing (Handles "15,50" and "15.50") ---
const safeParseFloat = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val === undefined || val === null || val === '') return 0;
  
  // Convert to string and handle Spanish/European comma format
  const str = String(val).replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// --- In-Memory State ---
let _clients: Client[] = [];
let _invoices: Invoice[] = [];
let _settings = { ...DEFAULT_SETTINGS };

// Observer Pattern
type Listener = () => void;
let listeners: Listener[] = [];

const notifyListeners = () => {
  listeners.forEach(l => l());
};

const pushToCloud = async () => {
  const payload = {
    clients: _clients,
    invoices: _invoices,
    settings: _settings
  };

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('☁️ Sincronizado con Google Sheet');
  } catch (error) {
    console.error('❌ Error guardando en nube:', error);
  }
};

export const StorageService = {
  subscribe: (listener: Listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  init: async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      
      _clients = Array.isArray(data.clients) ? data.clients : [];
      _invoices = Array.isArray(data.invoices) ? data.invoices : [];
      _settings = data.settings || DEFAULT_SETTINGS;
      
      notifyListeners();
      console.log('✅ Datos descargados del Sheet:', data);
    } catch (error) {
      console.error('❌ Fallo carga inicial:', error);
    }
  },

  getClients: (): Client[] => [..._clients],
  
  saveClient: async (client: Client) => {
    const index = _clients.findIndex(c => c.id === client.id);
    if (index >= 0) {
      _clients[index] = client;
    } else {
      _clients.push({ ...client, id: client.id || crypto.randomUUID() });
    }
    notifyListeners();
    await pushToCloud();
  },

  deleteClient: async (id: string) => {
    _clients = _clients.filter(c => c.id !== id);
    notifyListeners();
    await pushToCloud();
  },

  getInvoices: (): Invoice[] => {
     return _invoices.map(inv => {
         const items = (inv.items || []).map(item => ({
             ...item,
             weight: safeParseFloat(item.weight !== undefined ? item.weight : (item as any).weightLb),
             quantity: safeParseFloat(item.quantity),
             originalPrice: safeParseFloat(item.originalPrice),
             finalPrice: safeParseFloat(item.finalPrice),
             commission: safeParseFloat(item.commission),
             weightUnit: item.weightUnit || 'lb'
         }));

         // Usar safeParseFloat para recuperar el costo de logística correctamente
         const logisticsCost = safeParseFloat(inv.logisticsCost);
         const exchangeRate = safeParseFloat(inv.exchangeRate) || _settings.exchangeRate || 1;
         const amountPaid = safeParseFloat(inv.amountPaid); // Load amountPaid

         const totalProductCost = items.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
         const totalProductSale = items.reduce((acc, item) => acc + (item.finalPrice * item.quantity), 0);
         const totalCommissions = items.reduce((acc, item) => acc + (item.commission * item.quantity), 0);
         
         const grandTotalUsd = totalProductSale + logisticsCost + totalCommissions;

         return {
             ...inv,
             items,
             exchangeRate,
             totalProductCost,
             totalProductSale,
             totalCommissions,
             logisticsCost, 
             grandTotalUsd,
             amountPaid, // Return parsed amount
             status: inv.status || InvoiceStatus.DRAFT
         };
     });
  },

  saveInvoice: async (invoice: Invoice) => {
    const index = _invoices.findIndex(i => i.id === invoice.id);
    
    const items = invoice.items || [];
    const logisticsCost = safeParseFloat(invoice.logisticsCost);
    const amountPaid = safeParseFloat(invoice.amountPaid);
    
    const totalProductCost = items.reduce((acc, item) => acc + ((item.originalPrice || 0) * (item.quantity || 0)), 0);
    const totalProductSale = items.reduce((acc, item) => acc + ((item.finalPrice || 0) * (item.quantity || 0)), 0);
    const totalCommissions = items.reduce((acc, item) => acc + ((item.commission || 0) * (item.quantity || 0)), 0);

    const finalInvoice: Invoice = {
      ...invoice,
      logisticsCost, 
      amountPaid, // Persist amount
      updatedAt: new Date().toISOString(),
      totalProductCost,
      totalProductSale,
      totalCommissions,
      grandTotalUsd: totalProductSale + logisticsCost + totalCommissions
    };

    if (index >= 0) {
      _invoices[index] = finalInvoice;
    } else {
      _invoices.push({ ...finalInvoice, id: invoice.id || crypto.randomUUID(), createdAt: new Date().toISOString() });
    }
    
    notifyListeners();
    await pushToCloud();
  },

  updateInvoiceStatus: async (id: string, status: InvoiceStatus) => {
    const index = _invoices.findIndex(i => i.id === id);
    if (index >= 0) {
        _invoices[index] = { ..._invoices[index], status, updatedAt: new Date().toISOString() };
        notifyListeners();
        await pushToCloud();
    }
  },

  deleteInvoice: async (id: string) => {
    _invoices = _invoices.filter(i => i.id !== id);
    notifyListeners();
    await pushToCloud();
  },

  getExchangeRate: (): number => safeParseFloat(_settings.exchangeRate) || 40.5,

  setExchangeRate: async (rate: number) => {
    _settings.exchangeRate = rate;
    notifyListeners();
    await pushToCloud();
  },

  getPricePerKg: (): number => safeParseFloat(_settings.pricePerKg) || 15.43,

  setPricePerKg: async (price: number) => {
    _settings.pricePerKg = price;
    notifyListeners();
    await pushToCloud();
  }
};