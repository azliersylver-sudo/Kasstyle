import React, { useState } from 'react';
import { Invoice, Client, InvoiceStatus } from '../types';
import { Button } from './Button';
import { StorageService } from '../services/storage';
import { X, Printer, ArrowRightLeft, ArrowLeftRight, Download, Loader2 } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface InvoiceDetailModalProps {
  invoice: Invoice;
  client: Client;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, client, onClose }) => {
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('USD');
  const [isSwapped, setIsSwapped] = useState(false); 
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    
    // Safety check for items
    const safeItems = invoice.items || [];
    
    // Obtener precio por Kg actual para el desglose (fallback)
    const pricePerKg = StorageService.getPricePerKg();

    const itemsHtml = safeItems.map(item => {
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
            <div style="font-weight: bold; font-size: 13px;">${item.name}</div>
            <div style="font-size: 10px; color: #666;">
               ${item.platform} 
               ${item.isElectronics ? ' • Elec(+20%)' : ''}
            </div>
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

    // Contenido HTML optimizado para html2pdf
    // Usamos estilos inline estrictos para asegurar que el canvas capture todo correctamente
    const content = `
       <div id="invoice-pdf-template" style="width: 800px; padding: 40px; background: white; font-family: 'Helvetica', sans-serif; color: #333;">
          
          <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #3e136b; padding-bottom: 20px; margin-bottom: 30px;">
            <div>
              <div style="font-size: 32px; font-weight: 900; color: #3e136b; letter-spacing: -1px;">KASSTYLE</div>
              <div style="font-size: 14px; color: #64748b; margin-top: 5px;">Logística & Importación</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: bold; color: #333;">FACTURA #${invoice.id.slice(0, 8).toUpperCase()}</div>
              <div style="font-size: 14px; color: #666; margin-top: 5px;">${new Date(invoice.createdAt).toLocaleDateString()}</div>
              <div style="margin-top: 5px;">
                <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase;">${invoice.status}</span>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3e136b;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: bold;">Cliente</div>
            <div style="font-size: 16px; font-weight: bold; color: #333;">${client.name}</div>
            <div style="font-size: 14px; color: #555;">${client.phone}</div>
            <div style="font-size: 14px; color: #555;">${client.address || ''}</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Item</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Cant.</th>
                <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Precio</th>
                <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Envío+</th>
                <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 300px;">
              <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #3e136b; margin-top: 10px;">
                <span style="font-size: 16px; font-weight: bold; color: #3e136b;">TOTAL (${currencySymbolBody}):</span>
                <span style="font-size: 18px; font-weight: bold; color: #3e136b;">${formatBody(grandTotal)}</span>
              </div>
              
              <div style="border-top: 1px dashed #cbd5e1; margin-top: 10px; padding-top: 10px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px;">
                      <span>Abonado:</span>
                      <span>${paidStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: ${remainingBalanceUSD <= 0 ? '#10b981' : '#f59e0b'};">
                      <span>Restante:</span>
                      <span>${remainingStr}</span>
                  </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <p>Gracias por su confianza.</p>
            <p style="margin-top: 5px;">KASSTYLE - Gestión de Logística e Importación</p>
          </div>
       </div>
    `;

    // Crear un contenedor temporal fuera de la vista
    const element = document.createElement('div');
    element.innerHTML = content;
    // IMPORTANTE: Para que html2canvas funcione, el elemento debe estar en el DOM pero no visible.
    // Usamos fixed y fuera de pantalla para no afectar el layout.
    element.style.position = 'fixed';
    element.style.left = '-9999px';
    element.style.top = '0';
    document.body.appendChild(element);

    const opt = {
      margin:       10,
      filename:     `Factura_${invoice.id.slice(0, 6)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true }, // Escala 2 para mejor calidad
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(element).save();
    } catch (error) {
        console.error("Error generando PDF", error);
        alert("Hubo un error al generar el PDF. Por favor intente de nuevo.");
    } finally {
        document.body.removeChild(element);
        setIsGeneratingPdf(false);
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
                 <Button 
                    size="sm" 
                    onClick={handleDownloadPDF} 
                    disabled={isGeneratingPdf}
                    className="bg-brand hover:bg-brand-light text-white shadow-md shadow-brand/20 min-w-[140px]"
                 >
                    {isGeneratingPdf ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generando...
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 mr-2" />
                            Descargar PDF
                        </>
                    )}
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