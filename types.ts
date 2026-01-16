export enum InvoiceStatus {
  DRAFT = 'Borrador',
  PENDING = 'Pendiente',
  PARTIAL = 'Abonado', // 70%
  PAID = 'Pagado', // 100%
  DELIVERED = 'Entregado'
}

export enum Platform {
  SHEIN = 'Shein',
  AMAZON = 'Amazon',
  TEMU = 'Temu',
  ALIEXPRESS = 'AliExpress',
  ALIBABA = 'Alibaba',
  OTHER = 'Otro'
}

export interface ProductItem {
  id: string;
  name: string;
  quantity: number;
  weight: number; // Numeric value
  weightUnit: 'lb' | 'kg'; // Unit selector
  platform: Platform;
  trackingNumber?: string;
  originalPrice: number; // Cost from platform
  finalPrice: number; // Price sold to client (with/without discount)
  commission: number; // Hidden fee
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  createdAt: string; // ISO Date
  updatedAt: string;
  status: InvoiceStatus;
  exchangeRate: number; // Bs per USD
  items: ProductItem[];
  logisticsCost: number; // Shipping fee
  
  // Payment tracking
  amountPaid: number; // New field for partial payments
  
  // Calculated fields (persisted for ease of history)
  totalProductCost: number; // Sum of original prices
  totalProductSale: number; // Sum of final prices
  totalCommissions: number; // Sum of commissions
  grandTotalUsd: number; // totalProductSale + logisticsCost (Commission is usually inside logistics or price)
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'Material' | 'Servicio' | 'Transporte' | 'Otro';
  date: string; // ISO Date
}

// Helper interface for Dashboard data
export interface FinancialStats {
  revenue: number;
  netProfit: number;
  pendingPayment: number;
  ordersCount: number;
}