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
  weight: number; 
  weightUnit: 'lb' | 'kg'; 
  platform: Platform;
  trackingNumber?: string;
  originalPrice: number; 
  taxes: number; // New field
  discounts: number; // New field
  finalPrice: number; 
  commission: number; 
  isElectronics?: boolean;
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
  createdAt: string; 
  updatedAt: string;
  status: InvoiceStatus;
  exchangeRate: number; 
  items: ProductItem[];
  logisticsCost: number; 
  amountPaid: number; 
  totalProductCost: number; 
  totalProductSale: number; 
  totalCommissions: number; 
  grandTotalUsd: number; 
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'Material' | 'Servicio' | 'Transporte' | 'Otro';
  date: string; 
}

export interface FinancialStats {
  revenue: number;
  netProfit: number;
  pendingPayment: number;
  ordersCount: number;
}