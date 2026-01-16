import { Client, Invoice, InvoiceStatus, ProductItem, Expense } from '../types';

// TU URL DE GOOGLE APPS SCRIPT
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

// --- Helper: Safe ID Generation (Works on non-secure contexts) ---
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// --- In-Memory State ---
let _clients: Client[] = [];
let _invoices: Invoice[] = [];
let _expenses: Expense[] = [];
let _settings = { ...DEFAULT_SETTINGS };

// Observer Pattern
type Listener = () => void;
let listeners: Listener[] = [];

const notifyListeners = () => {
  listeners.forEach(l => l());
};

const pushToCloud = async () => {
  // Sanitize data before sending
  const payload = {
    clients: _clients,
    invoices: _invoices,
    expenses: _expenses.map(e => ({
        ...e,
        amount: safeParseFloat(e.amount), // Force number
        date: e.date || new Date().toISOString()
    })),
    settings: _settings
  };

  try {
    // Usamos 'text/plain' para evitar problemas de CORS y asegurarnos de que Apps Script reciba el string completo.
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    console.log(`☁️ Sincronizado con Sheet. Gastos enviados: ${payload.expenses.length}`);
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
      
      // Ensure expenses are parsed correctly
      if (Array.isArray(data.expenses)) {
        _expenses = data.expenses.map((e: any) => ({
            ...e,
            amount: safeParseFloat(e.amount)
        }));
      } else {
        _expenses = [];
      }

      _settings = data.settings || DEFAULT_SETTINGS;
      
      notifyListeners();
      console.log('✅ Datos descargados del Sheet:', data);
    } catch (error) {
      console.error('❌ Fallo carga inicial:', error);
    }
  },

  // --- CLIENTS ---
  getClients: (): Client[] => [..._clients],
  
  saveClient: async (client: Client) => {
    const index = _clients.findIndex(c => c.id === client.id);
    if (index >= 0) {
      _clients[index] = client;
    } else {
      _clients.push({ ...client, id: client.id || generateId() });
    }
    notifyListeners();
    await pushToCloud();
  },

  deleteClient: async (id: string) => {
    _clients = _clients.filter(c => c.id !== id);
    notifyListeners();
    await pushToCloud();
  },

  // --- INVOICES ---
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

         const logisticsCost = safeParseFloat(inv.logisticsCost);
         const exchangeRate = safeParseFloat(inv.exchangeRate) || _settings.exchangeRate || 1;
         const amountPaid = safeParseFloat(inv.amountPaid); 

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
             amountPaid, 
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
      amountPaid, 
      updatedAt: new Date().toISOString(),
      totalProductCost,
      totalProductSale,
      totalCommissions,
      grandTotalUsd: totalProductSale + logisticsCost + totalCommissions
    };

    if (index >= 0) {
      _invoices[index] = finalInvoice;
    } else {
      _invoices.push({ ...finalInvoice, id: invoice.id || generateId(), createdAt: new Date().toISOString() });
    }
    
    notifyListeners();
    await pushToCloud();
  },

  updateInvoiceStatus: async (id: string, status: InvoiceStatus) => {
    const index = _invoices.findIndex(i => i.id === id);
    if (index >= 0) {
        const inv = _invoices[index];
        let newAmountPaid = inv.amountPaid;

        if (status === InvoiceStatus.PAID || status === InvoiceStatus.DELIVERED) {
            newAmountPaid = inv.grandTotalUsd;
        } else if (status === InvoiceStatus.PENDING) {
            newAmountPaid = 0;
        }
        
        _invoices[index] = { 
            ...inv, 
            status, 
            amountPaid: newAmountPaid,
            updatedAt: new Date().toISOString() 
        };
        
        notifyListeners();
        await pushToCloud();
    }
  },

  deleteInvoice: async (id: string) => {
    _invoices = _invoices.filter(i => i.id !== id);
    notifyListeners();
    await pushToCloud();
  },

  // --- EXPENSES ---
  getExpenses: (): Expense[] => {
    return _expenses.map(e => ({
        ...e,
        amount: safeParseFloat(e.amount)
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  saveExpense: async (expense: Expense) => {
    const index = _expenses.findIndex(e => e.id === expense.id);
    if (index >= 0) {
        _expenses[index] = expense;
    } else {
        // Ensure ID exists - use the one passed or generate
        const newExpense = { ...expense, id: expense.id || generateId() };
        _expenses.push(newExpense);
    }
    notifyListeners();
    await pushToCloud();
  },

  deleteExpense: async (id: string) => {
    _expenses = _expenses.filter(e => e.id !== id);
    notifyListeners();
    await pushToCloud();
  },

  // --- SETTINGS ---
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