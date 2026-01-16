import React, { useState } from 'react';
import { Invoice, Client, InvoiceStatus } from '../types';
import { Button } from './Button';
import { StorageService } from '../services/storage';
import { X, ArrowRightLeft, ArrowLeftRight, Printer } from 'lucide-react';

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

  const handlePrint = () => {
    const safeItems = invoice.items || [];
    const pricePerKg = StorageService.getPricePerKg();

    // Construcción de filas con estilos inline robustos para impresión
    const itemsHtml = safeItems.map(item => {
      const weightKg = item.weightUnit === 'lb' ? (item.weight / 2.20462) : item.weight;
      const elecTax = item.isElectronics ? (item.originalPrice * 0.20) : 0;
      const baseLogistics = weightKg * pricePerKg;
      const unitAddons = baseLogistics + elecTax + item.commission;
      const unitFullPrice = item.finalPrice + unitAddons;
      const rowTotal = unitFullPrice * item.quantity;

      return `
      <tr style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">
        <td style="padding: 10px; vertical-align: top;">
            <div style="font-weight: bold; font-size: 13px; color: #1e293b;">${item.name}</div>
            <div style="font-size: 11px; color: #64748b;">
               ${item.platform} 
               ${item.isElectronics ? ' • Elec(+20%)' : ''}
               ${item.trackingNumber ? `• Tracking: ${item.trackingNumber}` : ''}
            </div>
        </td>
        <td style="padding: 10px; text-align: center; vertical-align: top; color: #334155;">${item.quantity}</td>
        <td style="padding: 10px; text-align: right; vertical-align: top; color: #334155;">${formatBody(item.finalPrice)}</td>
        <td style="padding: 10px; text-align: right; vertical-align: top; color: #64748b;">${formatBody(unitAddons)}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold; vertical-align: top; color: #0f172a;">${formatBody(rowTotal)}</td>
      </tr>
    `}).join('');

    const paidStr = formatBody(paidAmount);
    const remainingStr = formatRemaining(remainingBalanceUSD);

    // Template del cuerpo de la factura
    // NOTA: Usamos una clase 'invoice-container' en lugar de estilos inline fijos para el wrapper principal
    const invoiceBody = `
       <div class="invoice-container">
          
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #3e136b; padding-bottom: 20px; margin-bottom: 30px;">
            <div>
              <div style="font-size: 34px; font-weight: 900; color: #3e136b; letter-spacing: -1px; line-height: 1;">KASSTYLE</div>
              <div style="font-size: 13px; color: #64748b; font-weight: 500; margin-top: 4px;">Logística & Importación</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: bold; color: #1e293b;">FACTURA #${invoice.id.slice(0, 8).toUpperCase()}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Fecha: ${new Date(invoice.createdAt).toLocaleDateString()}</div>
              <div style="margin-top: 6px;">
                <span style="background: #f1f5f9; color: #334155; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; border: 1px solid #e2e8f0;">
                    ${invoice.status}
                </span>
              </div>
            </div>
          </div>

          <!-- Info Cliente -->
          <div style="margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3e136b; page-break-inside: avoid;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Cliente</div>
            <div style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 2px;">${client.name}</div>
            <div style="font-size: 14px; color: #475569;">${client.phone}</div>
            <div style="font-size: 14px; color: #475569;">${client.address || ''}</div>
          </div>

          <!-- Tabla -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Descripción</th>
                <th style="padding: 12px 10px; text-align: center; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Cant.</th>
                <th style="padding: 12px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Precio</th>
                <th style="padding: 12px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Envío/Imp</th>
                <th style="padding: 12px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Totales -->
          <div style="display: flex; justify-content: flex-end; page-break-inside: avoid;">
            <div style="width: 280px;">
              <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #3e136b; margin-top: 10px;">
                <span style="font-size: 16px; font-weight: 800; color: #3e136b;">TOTAL (${currencySymbolBody}):</span>
                <span style="font-size: 18px; font-weight: 800; color: #3e136b;">${formatBody(grandTotal)}</span>
              </div>
              
              <div style="border-top: 1px dashed #cbd5e1; margin-top: 5px; padding-top: 15px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #475569;">
                      <span>Abonado:</span>
                      <span style="font-weight: 600;">${paidStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: ${remainingBalanceUSD <= 0 ? '#10b981' : '#f59e0b'};">
                      <span>Restante:</span>
                      <span>${remainingStr}</span>
                  </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 25px; page-break-inside: avoid;">
            <p style="font-weight: 500;">Gracias por confiar en nuestros servicios.</p>
            <p style="margin-top: 5px;">KASSTYLE - Gestión de Logística e Importación</p>
          </div>
       </div>
    `;

    // --- LÓGICA DE VENTANA NUEVA ---
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Por favor permite las ventanas emergentes para ver la factura.");
        return;
    }

    const fullDocument = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Factura ${invoice.id.slice(0, 8)} - KASSTYLE</title>
          <style>
            /* Reset Global y Box Sizing para evitar cálculos erróneos de ancho */
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
            
            .invoice-container {
                background: white;
                margin: 0 auto;
            }

            /* Estilos para Pantalla (Vista Previa en la nueva pestaña) */
            @media screen {
               body { padding: 40px 0; display: flex; justify-content: center; }
               .invoice-container { 
                  width: 800px; 
                  padding: 40px;
                  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); 
                  border-radius: 4px;
               }
            }

            /* Estilos para Impresión / Guardar PDF */
            @media print {
              /* Configuramos la página y los márgenes seguros (12mm es estándar y seguro) */
              @page { size: A4; margin: 12mm; }
              
              body { 
                 background-color: white; 
                 -webkit-print-color-adjust: exact; 
                 print-color-adjust: exact;
              }
              
              /* El contenedor se adapta al ancho de la hoja restando los márgenes del @page */
              .invoice-container {
                 width: 100% !important;
                 max-width: none !important;
                 padding: 0 !important;
                 margin: 0 !important;
                 box-shadow: none !important;
                 border: none !important;
              }

              /* Aseguramos que las tablas no se salgan */
              table { width: 100% !important; }
            }
          </style>
        </head>
        <body>
          ${invoiceBody}
          <script>
             window.onload = function() {
                setTimeout(() => {
                    window.print();
                }, 500);
             }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(fullDocument);
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
                    {isBsContext ? 'Volver a USD' : 'Ver en Bolívares'}
                 </Button>
                 <Button 
                    size="sm" 
                    onClick={handlePrint} 
                    className="bg-brand hover:bg-brand-light text-white shadow-md shadow-brand/20 min-w-[140px]"
                 >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir / PDF
                 </Button>
             </div>
          </div>

          {/* Products Table (On Screen View) */}
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