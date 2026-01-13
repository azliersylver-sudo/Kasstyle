import React, { useState } from 'react';
import { Invoice, Client, InvoiceStatus } from '../types';
import { Button } from './Button';
import { X, Printer, RefreshCw, ArrowRightLeft } from 'lucide-react';

interface InvoiceDetailModalProps {
  invoice: Invoice;
  client: Client;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, client, onClose }) => {
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('USD');

  // Logic: Logistics = Shipping Cost (from DB or calc) + Commissions
  // Note: The prompt asks for logistics to be "sum of shipping price + commission"
  // The 'logisticsCost' field in DB represents the Shipping Cost.
  // The 'totalCommissions' field is calculated from items.
  const shippingCost = invoice.logisticsCost || 0;
  const totalCommissions = invoice.totalCommissions || 0;
  const displayLogistics = shippingCost + totalCommissions;

  // Toggle Display Logic
  const rate = invoice.exchangeRate || 1;
  const isBs = currency === 'Bs';
  const symbol = isBs ? 'Bs' : '$';
  
  const formatPrice = (amountUSD?: number) => {
    const safeAmount = amountUSD || 0;
    const val = isBs ? safeAmount * rate : safeAmount;
    return `${symbol} ${(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toggleCurrency = () => {
    setCurrency(prev => prev === 'USD' ? 'Bs' : 'USD');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = invoice.items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px;">${item.name}</td>
        <td style="padding: 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right;">${formatPrice(item.finalPrice)}</td>
        <td style="padding: 8px; text-align: right;">${formatPrice((item.finalPrice || 0) * (item.quantity || 0))}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Factura #${invoice.id.slice(0, 8)}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; text-transform: uppercase; color: #4f46e5; }
            .meta { text-align: right; font-size: 14px; }
            .client-info { margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; background: #f8fafc; padding: 10px; border-bottom: 2px solid #ddd; font-size: 12px; text-transform: uppercase; }
            .totals { float: right; width: 300px; }
            .row { display: flex; justify-content: space-between; padding: 5px 0; }
            .grand-total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
            .footer { margin-top: 60px; font-size: 12px; text-align: center; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">VeneOrders</div>
              <div style="font-size: 12px; margin-top: 5px;">Servicio de Importación Internacional</div>
            </div>
            <div class="meta">
              <div><strong>Factura:</strong> #${invoice.id.slice(0, 8)}</div>
              <div><strong>Fecha:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</div>
              <div><strong>Estado:</strong> ${invoice.status}</div>
            </div>
          </div>

          <div class="client-info">
            <strong>Cliente:</strong><br/>
            ${client.name}<br/>
            ${client.phone}<br/>
            ${client.address || ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th style="text-align: center;">Cant.</th>
                <th style="text-align: right;">Precio Unit.</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="row">
              <span>Subtotal Productos:</span>
              <span>${formatPrice(invoice.totalProductSale)}</span>
            </div>
            <div class="row">
              <span>Logística y Manejo:</span>
              <span>${formatPrice(displayLogistics)}</span>
            </div>
            <div class="row grand-total">
              <span>TOTAL ${currency}:</span>
              <span>${formatPrice(invoice.totalProductSale + displayLogistics)}</span>
            </div>
            ${!isBs ? `<div class="row" style="color: #666; font-size: 12px; margin-top:5px;">Ref. Bs: ${formatPrice(invoice.totalProductSale + displayLogistics).replace('$', 'Bs ')} (Tasa: ${rate})</div>` : ''}
          </div>

          <div style="clear: both;"></div>

          <div class="footer">
            <p>Gracias por su preferencia.</p>
          </div>
        </body>
        <script>window.print();</script>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Factura #{invoice.id.slice(0, 6)}...</h2>
            <p className="text-sm text-slate-500">{new Date(invoice.createdAt).toLocaleDateString()} &bull; {client.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 bg-slate-50/50">
          
          {/* Action Bar */}
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                    ${invoice.status === InvoiceStatus.PAID ? 'bg-green-100 text-green-700' : 
                      invoice.status === InvoiceStatus.PENDING ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}
                `}>
                    {invoice.status}
                </span>
             </div>
             <div className="flex gap-2">
                 <Button variant="secondary" size="sm" onClick={toggleCurrency}>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Ver en {isBs ? 'USD' : 'Bs'}
                 </Button>
                 <Button size="sm" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    Descargar PDF
                 </Button>
             </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-6">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">Producto</th>
                        <th className="px-4 py-3 text-center font-medium text-slate-500">Cant.</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">Precio Unit.</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {invoice.items.map(item => (
                        <tr key={item.id}>
                            <td className="px-4 py-3 text-slate-700 font-medium">
                                {item.name}
                                <div className="text-xs text-slate-400 font-normal">{item.platform}</div>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatPrice(item.finalPrice)}</td>
                            <td className="px-4 py-3 text-right text-slate-800 font-medium">
                                {formatPrice((item.finalPrice || 0) * (item.quantity || 0))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
             <div className="w-full sm:w-1/2 bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3 cursor-pointer hover:border-indigo-300 transition-colors" onClick={toggleCurrency} title="Clic para cambiar moneda">
                <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal Productos</span>
                    <span>{formatPrice(invoice.totalProductSale)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                    <span>Logística y Manejo</span>
                    <span>{formatPrice(displayLogistics)}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                    <div>
                        <span className="block text-xs text-slate-400">Total General</span>
                        <span className="font-bold text-xl text-indigo-700">{formatPrice(invoice.totalProductSale + displayLogistics)}</span>
                    </div>
                    {isBs && (
                         <div className="text-right">
                             <span className="block text-xs text-slate-400">Tasa de Cambio</span>
                             <span className="text-sm font-medium">{rate} Bs/$</span>
                         </div>
                    )}
                </div>
                <p className="text-center text-xs text-slate-300 mt-2 italic">Toca aquí para cambiar moneda</p>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};