import React, { useState } from 'react';
import { Invoice, Client, InvoiceStatus } from '../types';
import { Button } from './Button';
import { StorageService } from '../services/storage';
import { X, Printer, ArrowRightLeft, ArrowLeftRight, FileText } from 'lucide-react';

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

  const handleOpenPdfTab = () => {
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
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 8px;">
            <div style="font-weight: 500; color: #1e293b;">${item.name}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                ${item.platform} 
                ${item.isElectronics ? ' • <span style="color:#ca8a04;">Electrónico (+20%)</span>' : ''}
            </div>
        </td>
        <td style="padding: 12px 8px; text-align: center; color: #475569;">${item.quantity}</td>
        <td style="padding: 12px 8px; text-align: right; color: #475569;">${formatBody(item.finalPrice)}</td>
        <td style="padding: 12px 8px; text-align: right; color: #94a3b8; font-size: 11px;">${formatBody(unitAddons)}</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #1e293b;">${formatBody(rowTotal)}</td>
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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
            
            /* Reset & Base */
            * { box-sizing: border-box; }
            body { 
                font-family: 'Inter', sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #f8fafc; /* Color de fondo web */
                color: #334155; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            
            /* Control Bar (Solo visible en pantalla) */
            .control-bar {
              background-color: #3e136b;
              color: white;
              padding: 16px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .brand-preview { font-weight: 800; font-size: 18px; letter-spacing: -0.5px; }
            .btn-action {
              background: white;
              color: #3e136b;
              border: none;
              padding: 10px 24px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 14px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              transition: transform 0.1s;
            }
            .btn-action:active { transform: scale(0.96); }

            /* Hoja de Papel */
            .page {
              width: 100%;
              max-width: 800px;
              margin: 40px auto;
              background: white;
              padding: 48px;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
              border-radius: 12px;
              position: relative;
            }

            /* Header Factura */
            .invoice-header { display: flex; justify-content: space-between; margin-bottom: 48px; border-bottom: 4px solid #3e136b; padding-bottom: 24px; }
            .logo-text { font-size: 32px; font-weight: 900; color: #3e136b; letter-spacing: -1px; line-height: 1; }
            .logo-sub { font-size: 13px; font-weight: 500; color: #64748b; margin-top: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
            
            .meta-info { text-align: right; font-size: 13px; line-height: 1.6; }
            .meta-label { color: #94a3b8; font-weight: 500; text-transform: uppercase; font-size: 11px; margin-right: 8px; }
            .meta-value { color: #0f172a; font-weight: 600; }
            .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; color: #475569; }

            /* Cliente */
            .client-section { background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 40px; border-left: 4px solid #cbd5e1; }
            .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.5px; }
            .client-name { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
            .client-detail { font-size: 14px; color: #475569; line-height: 1.5; }

            /* Tabla */
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { text-align: left; background: #f1f5f9; color: #64748b; padding: 12px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
            
            /* Totales */
            .totals-container { display: flex; justify-content: flex-end; }
            .totals-box { width: 320px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #475569; }
            .total-row.final { border-top: 2px solid #3e136b; margin-top: 12px; padding-top: 16px; font-size: 20px; font-weight: 800; color: #3e136b; }
            
            .payment-box { margin-top: 24px; background: #fefce8; border: 1px dashed #eab308; padding: 16px; border-radius: 8px; }
            .payment-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; }
            .payment-row:last-child { margin-bottom: 0; font-weight: 700; margin-top: 8px; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 8px; }

            .footer { margin-top: 80px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 24px; }

            /* Estilos de Impresión */
            @media print {
              .control-bar { display: none !important; }
              body { background: white; -webkit-print-color-adjust: exact; }
              .page { box-shadow: none; margin: 0; padding: 0; max-width: none; border-radius: 0; }
              .client-section, .payment-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="control-bar">
             <div class="brand-preview">Vista Previa Documento</div>
             <button class="btn-action" onclick="window.print()">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
               Imprimir / Guardar PDF
             </button>
          </div>

          <div class="page">
            <div class="invoice-header">
              <div>
                <div class="logo-text">KASSTYLE</div>
                <div class="logo-sub">Logística Internacional</div>
              </div>
              <div class="meta-info">
                <div><span class="meta-label">Factura</span> <span class="meta-value">#${invoice.id.slice(0, 8)}</span></div>
                <div style="margin-top:4px;"><span class="meta-label">Fecha</span> <span class="meta-value">${new Date(invoice.createdAt).toLocaleDateString()}</span></div>
                <div style="margin-top:8px;"><span class="status-badge">${invoice.status}</span></div>
              </div>
            </div>

            <div class="client-section">
              <div class="section-title">Información del Cliente</div>
              <div class="client-name">${client.name}</div>
              <div class="client-detail">${client.phone}</div>
              <div class="client-detail">${client.address || ''}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th width="45%">Descripción del Producto</th>
                  <th width="10%" style="text-align: center;">Cant.</th>
                  <th width="15%" style="text-align: right;">Precio Unit.</th>
                  <th width="10%" style="text-align: right;">Envío+</th>
                  <th width="20%" style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals-container">
              <div class="totals-box">
                <div class="total-row">
                   <span>Subtotal Productos</span>
                   <span>${formatBody(subTotalProducts)}</span>
                </div>
                <div class="total-row">
                   <span>Logística y Manejo</span>
                   <span>${formatBody(displayLogistics)}</span>
                </div>
                <div class="total-row final">
                   <span>TOTAL A PAGAR</span>
                   <span>${formatBody(grandTotal)}</span>
                </div>

                <div class="payment-box" style="background: ${remainingBalanceUSD <= 0 ? '#f0fdf4' : '#fffbeb'}; border-color: ${remainingBalanceUSD <= 0 ? '#22c55e' : '#eab308'};">
                    <div class="payment-row">
                        <span>Monto Abonado</span>
                        <span style="font-weight:600;">${paidStr}</span>
                    </div>
                    <div class="payment-row" style="color: ${remainingBalanceUSD <= 0 ? '#15803d' : '#b45309'};">
                        <span>Restante Pendiente</span>
                        <span>${remainingStr}</span>
                    </div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>Gracias por elegir KASSTYLE.</p>
              <p style="margin-top: 4px;">Este documento sirve como comprobante de gestión de encomienda.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Abrir en nueva pestaña (Solución universal móvil)
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        alert("Por favor, permite abrir ventanas emergentes para ver el PDF.");
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
                 <Button size="sm" onClick={handleOpenPdfTab} className="bg-brand hover:bg-brand-light text-white shadow-md shadow-brand/20">
                    <FileText className="w-4 h-4 mr-2" />
                    Ver / Descargar PDF
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