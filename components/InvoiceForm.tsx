import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceStatus, ProductItem, Platform, Client } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Trash2, Plus, ArrowLeft, Wand2, Calculator } from 'lucide-react';
import { GeminiService } from '../services/geminiService';

interface InvoiceFormProps {
  invoiceId?: string | null;
  onClose: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoiceId, onClose }) => {
  const [clients, setClients] = useState<Client[]>([]);
  
  // Invoice State
  const [status, setStatus] = useState<InvoiceStatus>(InvoiceStatus.DRAFT);
  const [clientId, setClientId] = useState('');
  const [exchangeRate, setExchangeRate] = useState(0);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [logisticsCost, setLogisticsCost] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [configPricePerKg, setConfigPricePerKg] = useState(15.43);

  useEffect(() => {
    setClients(StorageService.getClients());
    const currentRate = StorageService.getExchangeRate();
    const currentPricePerKg = StorageService.getPricePerKg();
    setConfigPricePerKg(currentPricePerKg);

    if (invoiceId) {
      const inv = StorageService.getInvoices().find(i => i.id === invoiceId);
      if (inv) {
        setClientId(inv.clientId || '');
        setStatus(inv.status || InvoiceStatus.DRAFT);
        setExchangeRate(typeof inv.exchangeRate === 'number' ? inv.exchangeRate : currentRate);
        setItems(inv.items || []);
        setLogisticsCost(inv.logisticsCost || 0);
        try {
            setDate(new Date(inv.createdAt).toISOString().split('T')[0]);
        } catch(e) {
            setDate(new Date().toISOString().split('T')[0]);
        }
      }
    } else {
      setExchangeRate(currentRate);
    }
  }, [invoiceId]);

  // Effect to auto-calculate logistics when weight/items change
  // Rule: Convert everything to KG first. 1 KG = 2.20462 LB.
  const calculateSuggestedLogistics = (currentItems: ProductItem[]) => {
    const totalKg = currentItems.reduce((acc, item) => {
        const itemWeight = item.weight || 0;
        const itemQty = item.quantity || 0;
        // Convert to KG if LB, otherwise use as is
        const weightInKg = item.weightUnit === 'lb' ? (itemWeight / 2.20462) : itemWeight;
        return acc + (weightInKg * itemQty);
    }, 0);

    const pricePerKg = configPricePerKg;
    return parseFloat((totalKg * pricePerKg).toFixed(2));
  };

  const addItem = () => {
    const newItem: ProductItem = {
      id: crypto.randomUUID(),
      name: '',
      quantity: 1,
      weight: 0,
      weightUnit: 'lb', // Default unit
      platform: Platform.SHEIN,
      originalPrice: 0,
      finalPrice: 0,
      commission: 0,
    };
    const newItems = [...items, newItem];
    setItems(newItems);
  };

  const updateItem = (id: string, field: keyof ProductItem, value: any) => {
    const newItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    setItems(newItems);
    
    // Auto-update logistics if weight, unit or quantity changes
    if (field === 'weight' || field === 'quantity' || field === 'weightUnit') {
        setLogisticsCost(calculateSuggestedLogistics(newItems));
    }
  };

  const removeItem = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    setItems(newItems);
    setLogisticsCost(calculateSuggestedLogistics(newItems));
  };

  const handleAiDescription = async (id: string, name: string) => {
    if (!name) return;
    const desc = await GeminiService.suggestProductDescription(name);
    if (desc) updateItem(id, 'name', desc);
  };

  const handleSave = () => {
    if (!clientId) {
      alert("Seleccione un cliente");
      return;
    }
    
    // Calculations performed in StorageService, but we pass raw data
    const invoice: Invoice = {
      id: invoiceId || crypto.randomUUID(),
      clientId,
      createdAt: new Date(date).toISOString(),
      updatedAt: new Date().toISOString(),
      status,
      exchangeRate,
      items,
      logisticsCost,
      totalProductCost: 0, // Calculated in service
      totalProductSale: 0, // Calculated in service
      totalCommissions: 0, // Calculated in service
      grandTotalUsd: 0     // Calculated in service
    };

    StorageService.saveInvoice(invoice);
    onClose();
  };

  // Calculations for display
  const totalProductsUSD = items.reduce((acc, i) => acc + ((i.finalPrice || 0) * (i.quantity || 0)), 0);
  const totalCommissions = items.reduce((acc, i) => acc + ((i.commission || 0) * (i.quantity || 0)), 0);
  const grandTotalUSD = totalProductsUSD + (logisticsCost || 0);
  const grandTotalBs = grandTotalUSD * (exchangeRate || 0);
  
  // Per prompt: Net Profit = (Discounted Price - Original Price) + Commission
  const estimatedProfit = items.reduce((acc, i) => acc + (((i.finalPrice || 0) - (i.originalPrice || 0)) + (i.commission || 0)) * (i.quantity || 0), 0);

  return (
    <div className="bg-white min-h-screen sm:min-h-0 sm:rounded-lg shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
        <div className="flex items-center">
            <button onClick={onClose} className="mr-4 text-slate-500 hover:text-slate-800">
                <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-slate-800">
                {invoiceId ? 'Editar Factura' : 'Nueva Factura'}
            </h2>
        </div>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {/* Main Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select 
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-indigo-500"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                >
                    <option value="">Seleccione un cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select 
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-indigo-500"
                    value={status}
                    onChange={e => setStatus(e.target.value as InvoiceStatus)}
                >
                    {Object.values(InvoiceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tasa (Bs/USD)</label>
                <input 
                    type="number" 
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-indigo-500"
                    value={exchangeRate}
                    onChange={e => setExchangeRate(parseFloat(e.target.value))}
                />
            </div>
        </div>

        {/* Products Table */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Productos</h3>
                <Button size="sm" onClick={addItem}><Plus size={16} className="mr-1" /> Agregar Producto</Button>
            </div>
            
            <div className="space-y-4">
                {items.map((item, index) => (
                    <div key={item.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative group">
                        <button 
                            onClick={() => removeItem(item.id)} 
                            className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={18} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Product Basic Info */}
                            <div className="md:col-span-4">
                                <label className="text-xs text-slate-500">Producto / URL</label>
                                <div className="flex">
                                    <input 
                                        type="text" 
                                        className="w-full text-sm border-slate-300 rounded-l-md border p-1" 
                                        value={item.name}
                                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                                        placeholder="Nombre del producto"
                                    />
                                    <button 
                                        onClick={() => handleAiDescription(item.id, item.name)}
                                        className="bg-indigo-100 text-indigo-600 px-2 rounded-r-md border border-l-0 border-indigo-200 hover:bg-indigo-200"
                                        title="Mejorar descripción con IA"
                                    >
                                        <Wand2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500">Plataforma</label>
                                <select 
                                    className="w-full text-sm border-slate-300 rounded-md border p-1"
                                    value={item.platform}
                                    onChange={e => updateItem(item.id, 'platform', e.target.value)}
                                >
                                    {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500">Tracking (Opcional)</label>
                                <input 
                                    type="text" 
                                    className="w-full text-sm border-slate-300 rounded-md border p-1" 
                                    value={item.trackingNumber || ''}
                                    onChange={e => updateItem(item.id, 'trackingNumber', e.target.value)}
                                />
                            </div>
                             <div className="md:col-span-1">
                                <label className="text-xs text-slate-500">Cant.</label>
                                <input 
                                    type="number" min="1"
                                    className="w-full text-sm border-slate-300 rounded-md border p-1" 
                                    value={item.quantity}
                                    onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="md:col-span-3"></div> {/* Spacer row break */}

                            {/* Financials (Row 2) */}
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500 font-medium text-orange-600">Costo Orig. ($)</label>
                                <input 
                                    type="number" step="0.01"
                                    className="w-full text-sm border-orange-200 bg-orange-50 rounded-md border p-1" 
                                    value={item.originalPrice}
                                    onChange={e => updateItem(item.id, 'originalPrice', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500 font-medium text-green-600">Precio Venta ($)</label>
                                <input 
                                    type="number" step="0.01"
                                    className="w-full text-sm border-green-200 bg-green-50 rounded-md border p-1" 
                                    value={item.finalPrice}
                                    onChange={e => updateItem(item.id, 'finalPrice', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500 font-medium text-purple-600">Comisión ($)</label>
                                <input 
                                    type="number" step="0.01"
                                    className="w-full text-sm border-purple-200 bg-purple-50 rounded-md border p-1" 
                                    value={item.commission}
                                    onChange={e => updateItem(item.id, 'commission', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500">Peso</label>
                                <div className="flex">
                                    <input 
                                        type="number" step="0.1"
                                        className="w-full text-sm border-slate-300 rounded-l-md border p-1" 
                                        value={item.weight}
                                        onChange={e => updateItem(item.id, 'weight', parseFloat(e.target.value))}
                                    />
                                    <select 
                                        className="bg-slate-100 text-xs border border-l-0 border-slate-300 rounded-r-md px-1 focus:ring-0"
                                        value={item.weightUnit}
                                        onChange={e => updateItem(item.id, 'weightUnit', e.target.value)}
                                    >
                                        <option value="lb">Lb</option>
                                        <option value="kg">Kg</option>
                                    </select>
                                </div>
                            </div>
                            <div className="md:col-span-4 flex items-end justify-end">
                                <span className="text-xs text-slate-400 mr-2">Ganancia Item:</span>
                                <span className="text-sm font-bold text-emerald-600">
                                    ${((((item.finalPrice || 0) - (item.originalPrice || 0)) + (item.commission || 0)) * (item.quantity || 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                        No hay productos agregados.
                    </div>
                )}
            </div>
        </div>

        {/* Totals Footer */}
        <div className="bg-slate-100 p-6 rounded-lg">
            <h4 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">Resumen de Totales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Admin/Internal View */}
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Subtotal Productos (Venta):</span>
                        <span className="font-medium">${totalProductsUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                         <span className="text-slate-500 flex items-center gap-2">
                            Costo Logística (Auto Calc. ${configPricePerKg}/kg)
                            <input 
                                type="number" 
                                className="w-20 text-right p-1 border rounded text-xs bg-white" 
                                value={logisticsCost}
                                onChange={e => setLogisticsCost(parseFloat(e.target.value) || 0)}
                            />
                         </span>
                         <span className="font-medium">${logisticsCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>Comisiones Internas (Oculto al cliente):</span>
                        <span>${totalCommissions.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-lg text-indigo-700">
                        <span>Total General (USD):</span>
                        <span>${grandTotalUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-700">
                        <span>Total en Bolívares:</span>
                        <span>Bs {(!isNaN(grandTotalBs) ? grandTotalBs : 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Profit Analysis (Only for Admin) */}
                <div className="bg-white p-4 rounded border border-slate-200">
                    <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wide mb-2">Análisis de Ganancia</h5>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-3xl font-bold text-emerald-500">${estimatedProfit.toFixed(2)}</p>
                            <p className="text-xs text-slate-400">Ganancia Neta Estimada</p>
                        </div>
                        <div className="text-right">
                             <p className="text-xs text-slate-400">Margen</p>
                             <p className="font-bold text-slate-700">
                                {grandTotalUSD > 0 ? ((estimatedProfit / grandTotalUSD) * 100).toFixed(1) : 0}%
                             </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};