import React, { useState } from 'react';
import { Invoice, Client, InvoiceStatus } from '../types';
import { Button } from './Button';
import { StorageService } from '../services/storage';
import { X, Printer, ArrowRightLeft, ArrowLeftRight, FileSearch } from 'lucide-react';

interface InvoiceDetailModalProps {
  invoice: Invoice;
  client: Client;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, client, onClose }) => {
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('USD');
  const [isSwapped, setIsSwapped] = useState(false); 

  // Calculate logic locally
  const subTotalProducts = (invoice.items || []).reduce((acc, item) => acc + ((item.finalPrice || 0) * (item.quantity || 0)), 0);
  const totalCommissions = (invoice.items || []).reduce((acc, item) => acc + ((item.commission || 0) * (item.quantity || 0)), 0);
  
  const shippingCost = invoice.logisticsCost || 0;
  const displayLogistics = shippingCost + totalCommissions;
  
  const grandTotal = subTotalProducts + displayLogistics;
  const paidAmount = invoice.amountPaid || 0;
  const remainingBalanceUSD = Math.max(0, grandTotal - paidAmount);

  const rate = invoice.exchangeRate || 1;
  const isBsContext = currency === 'Bs';

  // --- Formatters ---
  const formatUSD = (amount: number) => `$ ${(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBs = (amountUSD: number) => `Bs ${(amountUSD * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- VIEW LOGIC ---
  const showBodyInBs = isBsContext && !isSwapped;
  const showRemainingInBs = isBsContext && isSwapped;

  const formatBody = showBodyInBs ? formatBs : formatUSD;
  const currencySymbolBody = showBodyInBs ? 'Bs' : '$';

  const formatRemaining = showRemainingInBs ? formatBs : formatUSD;

  const toggleCurrency = () => {
    setCurrency(prev => prev === 'USD' ? 'Bs' : 'USD');
    setIsSwapped(false); 
  };

  const toggleSwap = () => {
      setIsSwapped(!isSwapped);
  };

  const handlePreview = () => {
    // Obtener precio por Kg actual para el desglose (fallback)
    const pricePerKg = StorageService.getPricePerKg();

    const itemsHtml = invoice.items.map(item => {
      // Cálculo de logística unitaria para visualización en tabla
      const weightKg = item.weightUnit === 'lb' ? (item.weight / 2.20462) : item.weight;
      const elecTax = item.isElectronics ? (item.originalPrice * 0.20) : 0;
      const baseLogistics = weightKg * pricePerKg;
      
      // Logística + Comisión Unitaria (Calculo interno mantenido)
      const unitAddons = baseLogistics + elecTax + item.commission;
      
      // Total de la línea (Precio Venta + Logística Completa) * Cantidad
      const unitFullPrice = item.finalPrice + unitAddons;
      const rowTotal = unitFullPrice * item.quantity;

      return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px;">
            ${item.name}
            ${item.isElectronics ? '<br/><span style="font-size:10px; color:#666;">(Electrónico +20%)</span>' : ''}
        </td>
        <td style="padding: 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right;">${formatBody(item.finalPrice)}</td>
        <td style="padding: 8px; text-align: right; color: #666;">${formatBody(unitAddons)}</td>
        <td style="padding: 8px; text-align: right; font-weight: bold;">${formatBody(rowTotal)}</td>
      </tr>
    `}).join('');

    // Payment Section for Print
    const paidStr = formatBody(paidAmount);
    const remainingStr = formatRemaining(remainingBalanceUSD);

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Factura #${invoice.id.slice(0, 8)} - KASSTYLE</title>
          <style>
            /* Reset & Base */
            * { box-sizing: border-box; }
            body { 
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #f1f5f9; 
                color: #333; 
                -webkit-print-color-adjust: exact;
            }
            
            /* Control Bar (Not Printed) */
            .control-bar {
              background-color: #3e136b;
              color: white;
              padding: 12px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .brand-preview { font-weight: bold; font-size: 18px; letter-spacing: 0.5px; }
            
            .btn-group { display: flex; gap: 10px; }
            .btn {
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: transform 0.1s;
            }
            .btn:active { transform: scale(0.98); }
            .btn-primary { background: white; color: #3e136b; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
            .btn-secondary { background: rgba(255,255,255,0.15); color: white; }
            .btn-secondary:hover { background: rgba(255,255,255,0.25); }

            /* Paper Sheet */
            .page-container {
              max-width: 800px;
              margin: 30px auto;
              background: white;
              padding: 40px;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
              border-radius: 8px;
            }

            /* Invoice Styles */
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 3px solid #3e136b; padding-bottom: 20px; }
            .title { font-size: 28px; font-weight: 800; text-transform: uppercase; color: #3e136b; letter-spacing: -0.5px; }
            .subtitle { font-size: 12px; margin-top: 5px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            
            .meta { text-align: right; font-size: 14px; line-height: 1.6; }
            .meta strong { color: #334155; }
            
            .client-box { background: #f8fafc; padding: 20px; border-radius: 6px; border-left: 4px solid #cbd5e1; margin-bottom: 30px; }
            .client-info { font-size: 14px; line-height: 1.6; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; background: #f1f5f9; color: #475569; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; }
            
            .totals { float: right; width: 300px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .grand-total { font-weight: 800; font-size: 18px; border-top: 2px solid #3e136b; margin-top: 10px; padding-top: 15px; color: #3e136b; }
            
            .payment-info { border-top: 1px dashed #cbd5e1; margin-top: 15px; padding-top: 15px; }
            
            .footer { margin-top: 80px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }

            /* Print Overrides */
            @media print {
              .control-bar { display: none !important; }
              body { background: white; margin: 0; }
              .page-container { 
                box-shadow: none; 
                margin: 0; 
                width: 100%; 
                max-width: none; 
                padding: 0; /* Remove padding to fit paper better */
              }
            }
          </style>
        </head>
        <body>
          <div class="control-bar">
             <div class="brand-preview">KASSTYLE <span style="font-weight:400; font-size:14px; opacity:0.8;">| Vista Previa</span></div>
             <div class="btn-group">
                <button class="btn btn-secondary" onclick="window.close()">Cerrar</button>
                <button class="btn btn-primary" onclick="window.print()">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                   Imprimir / Descargar
                </button>
             </div>
          </div>

          <div class="page-container">
            <div class="header">
              <div>
                <div class="title">KASSTYLE</div>
                <div class="subtitle">Servicio de Importación Internacional</div>
              </div>
              <div class="meta">
                <div><strong>Factura:</strong> #${invoice.id.slice(0, 8)}</div>
                <div><strong>Fecha:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</div>
                <div><strong>Estado:</strong> ${invoice.status}</div>
              </div>
            </div>

            <div class="client-box">
              <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px;">Cliente</div>
              <div class="client-info">
                <strong>${client.name}</strong><br/>
                ${client.phone}<br/>
                ${client.address || ''}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th width="40%">Descripción</th>
                  <th width="10%" style="text-align: center;">Cant.</th>
                  <th width="15%" style="text-align: right;">Precio Unit.</th>
                  <th width="15%" style="text-align: right;">Envío</th>
                  <th width="20%" style="text-align: right;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <!-- Nota: Al desglosar logística en las filas, la suma de las filas es el Total General -->
              <div class="row grand-total">
                <span>TOTAL GENERAL (${currencySymbolBody}):</span>
                <span>${formatBody(grandTotal)}</span>
              </div>
              
              <div class="payment-info">
                  <div class="row">
                      <span>Abonado:</span>
                      <span>${paidStr}</span>
                  </div>
                  <div class="row" style="color: ${remainingBalanceUSD <= 0 ? '#10b981' : '#d97706'}; font-weight: bold;">
                      <span>Restante:</span>
                      <span>${remainingStr}</span>
                  </div>
              </div>
            </div>

            <div style="clear: both;"></div>

            <div class="footer">
              <p>Gracias por su preferencia.</p>
              <p style="margin-top: 5px;">KASSTYLE Manager</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Open in New Window/Tab (Mobile Friendly)
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        // Focus for desktop usability
        win.focus();
    } else {
        alert("Por favor, permite las ventanas emergentes (pop-ups) para ver la factura.");
    }
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
                    {isBsContext ? 'Volver a USD' : 'Ver en Bolívares'}
                 </Button>
                 <Button size="sm" onClick={handlePreview} className="bg-brand hover:bg-brand-light text-white">
                    <FileSearch className="w-4 h-4 mr-2" />
                    Vista Previa PDF
                 </Button>
             </div>
          </div>

          {/* Products Table (On Screen - Keeping original simplified view for UI) */}
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
                            <td className="px-4 py-3 text-right text-slate-600">{formatBody(item.finalPrice)}</td>
                            <td className="px-4 py-3 text-right text-slate-800 font-medium">
                                {formatBody((item.finalPrice || 0) * (item.quantity || 0))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
             <div className="w-full sm:w-1/2 bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3">
                
                <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal Productos</span>
                    <span>{formatBody(subTotalProducts)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                    <span>Logística y Manejo</span>
                    <span>{formatBody(displayLogistics)}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                    <div>
                        <span className="block text-xs text-slate-400">Total General</span>
                        <span className="font-bold text-xl text-brand">{formatBody(grandTotal)}</span>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex justify-between items-center text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                            <span>Abonado</span>
                        </div>
                        <span>{formatBody(paidAmount)}</span>
                    </div>
                    <div className={`flex justify-between items-start text-sm font-bold ${remainingBalanceUSD <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        <div className="flex items-center gap-2">
                            <span>Restante por Pagar</span>
                            {isBsContext && remainingBalanceUSD > 0 && (
                                <button 
                                    onClick={toggleSwap}
                                    className={`p-1 rounded-full transition-colors ${isSwapped ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    title="Intercambiar: Restante en Bs / Resto en $"
                                >
                                    <ArrowLeftRight size={14} />
                                </button>
                            )}
                        </div>
                        <div className="text-right">
                             <span>{formatRemaining(remainingBalanceUSD)}</span>
                        </div>
                    </div>
                </div>
                
                {isBsContext && (
                    <div 
                        className="mt-2 text-center text-xs text-slate-400 italic cursor-pointer hover:text-brand transition-colors"
                        onClick={toggleSwap}
                    >
                        {isSwapped 
                            ? 'Viendo: Todo en USD, Restante en Bs' 
                            : 'Viendo: Todo en Bs, Restante en USD'}
                    </div>
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};