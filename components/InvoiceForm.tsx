import React, { useState, useEffect, useRef } from 'react';
import { Invoice, InvoiceStatus, ProductItem, Platform, Client } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Trash2, Plus, ArrowLeft, Wand2, Calculator, Percent, Settings, Zap } from 'lucide-react';
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
  const [amountPaid, setAmountPaid] = useState(0); 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [configPricePerKg, setConfigPricePerKg] = useState(15.43);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showRateInput, setShowRateInput] = useState(false); 
  
  const isLoadedRef = useRef(false);

  // Load Data
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
        setAmountPaid(inv.amountPaid || 0); 
        
        const loadedItems = inv.items || [];
        setItems(loadedItems);
        
        let loadedCost = inv.logisticsCost !== undefined ? inv.logisticsCost : 0;
        
        if (loadedCost === 0 && loadedItems.length > 0) {
            const result = calculateSuggestedLogistics(loadedItems, currentPricePerKg);
            if (result.cost > 0) loadedCost = result.cost;
        }
        setLogisticsCost(loadedCost);
        
        try {
            setDate(new Date(inv.createdAt).toISOString().split('T')[0]);
        } catch(e) {
            setDate(new Date().toISOString().split('T')[0]);
        }
      }
    } else {
      setExchangeRate(currentRate);
      setLogisticsCost(0);
      setAmountPaid(0);
    }
    
    setTimeout(() => {
        isLoadedRef.current = true;
    }, 100);
  }, [invoiceId]);

  const calculateSuggestedLogistics = (currentItems: ProductItem[], priceKg: number) => {
    const totalKg = currentItems.reduce((acc, item) => {
        const itemWeight = item.weight || 0;
        const itemQty = item.quantity || 0;
        const weightInKg = item.weightUnit === 'lb' ? (itemWeight / 2.20462) : itemWeight;
        return acc + (weightInKg * itemQty);
    }, 0);

    const weightCost = totalKg * priceKg;

    const electronicsTax = currentItems.reduce((acc, item) => {
        if (item.isElectronics) {
            // Updated Formula: (Costo Orig - Impuesto - Descuento) * 0.20
            const taxableBase = (item.originalPrice || 0) - (item.taxes || 0) - (item.discounts || 0);
            return acc + (taxableBase * (item.quantity || 0) * 0.20);
        }
        return acc;
    }, 0);

    const totalCost = weightCost + electronicsTax;

    return {
        cost: parseFloat(totalCost.toFixed(2)),
        totalWeight: parseFloat(totalKg.toFixed(2)),
        weightCost: parseFloat(weightCost.toFixed(2)),
        electronicsTax: parseFloat(electronicsTax.toFixed(2))
    };
  };

  useEffect(() => {
     if (!isLoadedRef.current && invoiceId) return;
     const result = calculateSuggestedLogistics(items, configPricePerKg);
     setLogisticsCost(result.cost);
  }, [items, configPricePerKg]);

  const addItem = () => {
    const newItem: ProductItem = {
      id: crypto.randomUUID(),
      name: '',
      quantity: 1,
      weight: 0,
      weightUnit: 'kg', 
      platform: Platform.SHEIN,
      originalPrice: 0,
      taxes: 3.99, // Default tax
      discounts: 0,
      finalPrice: -3.99, // 0 - 3.99 + 0
      commission: 0,
      isElectronics: false
    };
    const newItems = [...items, newItem];
    setItems(newItems);
  };

  const updateItem = (id: string, field: keyof ProductItem, value: any) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // AUTO-CALC FINAL PRICE: Costo Orig - Impuesto + Descuento
        if (['originalPrice', 'taxes', 'discounts'].includes(field)) {
          const op = parseFloat(updated.originalPrice?.toString() || '0');
          const tx = parseFloat(updated.taxes?.toString() || '0');
          const ds = parseFloat(updated.discounts?.toString() || '0');
          updated.finalPrice = parseFloat((op - tx + ds).toFixed(2));
        }
        
        return updated;
      }
      return item;
    });
    setItems(newItems);
  };

  const removeItem = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    setItems(newItems);
  };

  const handleAiDescription = async (id: string, name: string) => {
    if (!name) return;
    const desc = await GeminiService.suggestProductDescription(name);
    if (desc) updateItem(id, 'name', desc);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as InvoiceStatus;
    setStatus(newStatus);

    const currentTotalProducts = items.reduce((acc, i) => acc + ((i.finalPrice || 0) * (i.quantity || 0)), 0);
    const currentTotalCommissions = items.reduce((acc, i) => acc + ((i.commission || 0) * (i.quantity || 0)), 0);
    const currentGrandTotal = currentTotalProducts + (logisticsCost || 0) + currentTotalCommissions;

    if (newStatus === InvoiceStatus.PAID || newStatus === InvoiceStatus.DELIVERED) {
        setAmountPaid(parseFloat(currentGrandTotal.toFixed(2)));
    } else if (newStatus === InvoiceStatus.PENDING) {
        setAmountPaid(0);
    }
  };

  const handleAmountInput = (val: string) => {
    const num = parseFloat(val);
    const newAmount = isNaN(num) ? 0 : num;
    setAmountPaid(newAmount);

    const currentTotalProducts = items.reduce((acc, i) => acc + ((i.finalPrice || 0) * (i.quantity || 0)), 0);
    const currentTotalCommissions = items.reduce((acc, i) => acc + ((i.commission || 0) * (i.quantity || 0)), 0);
    const currentGrandTotal = parseFloat((currentTotalProducts + (logisticsCost || 0) + currentTotalCommissions).toFixed(2));
    
    if (status !== InvoiceStatus.DRAFT) {
        if (currentGrandTotal > 0) {
            if (newAmount > 0 && newAmount < currentGrandTotal) {
                setStatus(InvoiceStatus.PARTIAL);
            } 
            else if (newAmount === 0) {
                setStatus(InvoiceStatus.PENDING);
            }
            else if (newAmount >= currentGrandTotal && status !== InvoiceStatus.DELIVERED) {
                setStatus(InvoiceStatus.PAID);
            }
        }
    }
  };

  const handleSave = async () => {
    if (!clientId) {
      alert("Seleccione un cliente");
      return;
    }
    
    setIsSaving(true);

    const invoice: Invoice = {
      id: invoiceId || crypto.randomUUID(),
      clientId,
      createdAt: new Date(date).toISOString(),
      updatedAt: new Date().toISOString(),
      status,
      exchangeRate,
      items,
      logisticsCost: logisticsCost,
      amountPaid: amountPaid, 
      totalProductCost: 0, 
      totalProductSale: 0, 
      totalCommissions: 0, 
      grandTotalUsd: 0     
    };

    await StorageService.saveInvoice(invoice);
    setIsSaving(false);
    onClose();
  };

  const totalProductsUSD = items.reduce((acc, i) => acc + ((i.finalPrice || 0) * (i.quantity || 0)), 0);
  const totalCommissions = items.reduce((acc, i) => acc + ((i.commission || 0) * (i.quantity || 0)), 0);
  const grandTotalUSD = totalProductsUSD + (logisticsCost || 0) + totalCommissions;
  const grandTotalBs = grandTotalUSD * (exchangeRate || 0);
  
  // PROFIT FORMULA: Venta + Comisión - (Costo - Impuesto)
  const estimatedProfit = items.reduce((acc, i) => {
      const itemProfitPerUnit = (i.finalPrice || 0) + (i.commission || 0) - ((i.originalPrice || 0) - (i.taxes || 0));
      return acc + (itemProfitPerUnit * (i.quantity || 0));
  }, 0);
  
  const logisticsBreakdown = calculateSuggestedLogistics(items, configPricePerKg);
  const remainingBalance = Math.max(0, grandTotalUSD - amountPaid);
  const percentPaid = grandTotalUSD > 0 ? (amountPaid / grandTotalUSD) * 100 : 0;

  const handleSetSeventyPercent = () => {
    const seventyPercent = parseFloat((grandTotalUSD * 0.70).toFixed(2));
    setAmountPaid(seventyPercent);
    if (status !== InvoiceStatus.DRAFT && status !== InvoiceStatus.DELIVERED) {
        setStatus(InvoiceStatus.PARTIAL);
    }
  };

  return (
    <div className="bg-white min-h-screen sm:min-h-0 sm:rounded-lg shadow-xl flex flex-col h-full">
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
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} isLoading={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select 
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-brand focus:border-brand"
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
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-brand focus:border-brand"
                    value={status}
                    onChange={handleStatusChange}
                >
                    {Object.values(InvoiceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
        </div>

        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Productos</h3>
                <Button size="sm" onClick={addItem}><Plus size={16} className="mr-1" /> Agregar Producto</Button>
            </div>
            
            <div className="space-y-4">
                {items.map((item, index) => {
                    const itemGain = ((item.finalPrice || 0) + (item.commission || 0) - ((item.originalPrice || 0) - (item.taxes || 0))) * (item.quantity || 0);

                    return (
                        <div key={item.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative group transition-all hover:shadow-md hover:border-purple-200">
                            <button 
                                onClick={() => removeItem(item.id)} 
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={18} />
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-4">
                                    <label className="text-xs text-slate-500">Producto / URL</label>
                                    <div className="flex">
                                        <input 
                                            type="text" 
                                            className="w-full text-sm border-slate-300 rounded-l-md border p-1 focus:ring-brand focus:border-brand" 
                                            value={item.name}
                                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                                            placeholder="Nombre del producto"
                                        />
                                        <button 
                                            onClick={() => handleAiDescription(item.id, item.name)}
                                            className="bg-purple-100 text-purple-600 px-2 rounded-r-md border border-l-0 border-purple-200 hover:bg-purple-200"
                                            title="Mejorar descripción con IA"
                                        >
                                            <Wand2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500">Plataforma</label>
                                    <select 
                                        className="w-full text-sm border-slate-300 rounded-md border p-1 focus:ring-brand focus:border-brand"
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
                                        className="w-full text-sm border-slate-300 rounded-md border p-1 focus:ring-brand focus:border-brand" 
                                        value={item.trackingNumber || ''}
                                        onChange={e => updateItem(item.id, 'trackingNumber', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="text-xs text-slate-500">Cant.</label>
                                    <input 
                                        type="number" min="1"
                                        className="w-full text-sm border-slate-300 rounded-md border p-1 focus:ring-brand focus:border-brand" 
                                        value={item.quantity}
                                        onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value))}
                                    />
                                </div>
                                
                                <div className="md:col-span-3 flex items-end">
                                    <label className={`flex items-center space-x-2 text-sm cursor-pointer p-1 rounded-md border w-full justify-center transition-colors ${item.isElectronics ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="rounded text-brand focus:ring-brand h-4 w-4"
                                            checked={item.isElectronics || false}
                                            onChange={e => updateItem(item.id, 'isElectronics', e.target.checked)}
                                        />
                                        <div className="flex items-center">
                                            <Zap size={14} className={`mr-1 ${item.isElectronics ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                                            <span>Electrónico (+20%)</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500 font-medium text-orange-600">Costo Orig. ($)</label>
                                    <input 
                                        type="number" step="0.01"
                                        className="w-full text-sm border-orange-200 bg-orange-50 rounded-md border p-1 focus:ring-brand focus:border-brand" 
                                        value={item.originalPrice}
                                        onChange={e => updateItem(item.id, 'originalPrice', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500 font-medium text-red-500">Impuesto ($)</label>
                                    <input 
                                        type="number" step="0.01"
                                        className="w-full text-sm border-red-200 bg-red-50 rounded-md border p-1 focus:ring-brand focus:border-brand" 
                                        value={item.taxes}
                                        onChange={e => updateItem(item.id, 'taxes', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500 font-medium text-blue-500">Descuentos ($)</label>
                                    <input 
                                        type="number" step="0.01"
                                        className="w-full text-sm border-blue-200 bg-blue-50 rounded-md border p-1 focus:ring-brand focus:border-brand" 
                                        value={item.discounts}
                                        onChange={e => updateItem(item.id, 'discounts', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500 font-medium text-green-600">Precio Venta ($)</label>
                                    <input 
                                        type="number" step="0.01"
                                        className="w-full text-sm border-green-200 bg-green-200 rounded-md border p-1 focus:ring-brand focus:border-brand font-bold text-slate-800" 
                                        value={item.finalPrice}
                                        readOnly
                                        title="Calculado automáticamente: Costo - Impuesto + Descuento"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500 font-medium text-purple-600">Comisión ($)</label>
                                    <input 
                                        type="number" step="0.01"
                                        className="w-full text-sm border-purple-200 bg-purple-50 rounded-md border p-1 focus:ring-brand focus:border-brand" 
                                        value={item.commission}
                                        onChange={e => updateItem(item.id, 'commission', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500">Peso</label>
                                    <div className="flex">
                                        <input 
                                            type="number" step="0.1"
                                            className="w-full text-sm border-slate-300 rounded-l-md border p-1 focus:ring-brand focus:border-brand" 
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
                                <div className="md:col-span-12 flex items-end justify-end pt-1">
                                    <span className="text-xs text-slate-400 mr-2">Ganancia Item:</span>
                                    <span className="text-sm font-bold text-emerald-600">
                                        ${itemGain.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {items.length === 0 && (
                    <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                        No hay productos agregados.
                    </div>
                )}
            </div>
        </div>

        <div className="bg-slate-100 p-6 rounded-lg">
            <h4 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">Resumen de Totales y Pagos</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 text-sm border-r border-slate-200 pr-4">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Subtotal Productos:</span>
                        <span className="font-medium">${totalProductsUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-start">
                         <div className="text-slate-500 flex flex-col">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                                Costo Logística Total
                            </span>
                            <span className="text-xs text-slate-400">Peso: {logisticsBreakdown.totalWeight}kg x ${configPricePerKg} = ${logisticsBreakdown.weightCost}</span>
                            {logisticsBreakdown.electronicsTax > 0 && (
                                <span className="text-xs text-yellow-600 flex items-center mt-0.5">
                                    <Zap size={10} className="mr-1"/> Arancel Electrónica: ${logisticsBreakdown.electronicsTax}
                                </span>
                            )}
                         </div>
                         <div className="flex items-center">
                            <input 
                                type="number" 
                                className="w-24 text-right p-1 border rounded text-xs bg-slate-200 text-slate-700 font-bold" 
                                value={logisticsCost}
                                readOnly 
                            />
                         </div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>Comisiones Internas:</span>
                        <span>${totalCommissions.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-lg text-brand">
                        <span>Total General (USD):</span>
                        <span>${grandTotalUSD.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex flex-col gap-2 pt-2">
                         <div className="flex justify-between font-bold text-emerald-700 items-center">
                            <span>Total en Bolívares:</span>
                            <div className="flex items-center gap-2">
                                <span>Bs {(!isNaN(grandTotalBs) ? grandTotalBs : 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <button 
                                    onClick={() => setShowRateInput(!showRateInput)}
                                    className="text-slate-400 hover:text-emerald-600 transition-colors"
                                    title="Modificar Tasa de Cambio"
                                >
                                    <Settings size={14} />
                                </button>
                            </div>
                        </div>
                        
                        {showRateInput && (
                             <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 animate-in fade-in slide-in-from-top-1">
                                 <span className="text-xs text-slate-500">Tasa de Cambio (Bs/USD):</span>
                                 <input 
                                    type="number"
                                    step="0.01"
                                    className="w-24 text-right p-1 border border-slate-300 rounded text-xs focus:ring-brand"
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                                 />
                             </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-4 rounded border border-blue-100 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center">
                                <Calculator className="w-4 h-4 mr-1 text-brand"/> 
                                Control de Pagos
                            </label>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${percentPaid >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {percentPaid.toFixed(0)}% Pagado
                            </span>
                        </div>
                        
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs text-slate-500">Monto Abonado (USD)</label>
                                <Button 
                                    size="sm" 
                                    type="button"
                                    onClick={handleSetSeventyPercent}
                                    className="text-xs px-2 py-0.5 h-auto bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200"
                                >
                                    <Percent size={10} className="mr-1"/> 70%
                                </Button>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-brand focus:border-brand border p-2"
                                    placeholder="0.00"
                                    value={amountPaid}
                                    onChange={e => handleAmountInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2">
                            <div 
                                className={`h-2.5 rounded-full ${percentPaid >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} 
                                style={{ width: `${Math.min(100, percentPaid)}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                             <div>
                                <p className="text-xs text-slate-400">Restante por Cobrar</p>
                                <p className={`font-bold text-lg ${remainingBalance <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    ${remainingBalance.toFixed(2)}
                                </p>
                             </div>
                             {remainingBalance <= 0 && (
                                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">¡Pagado!</span>
                             )}
                        </div>
                    </div>
                    
                    <div className="text-right">
                         <p className="text-xs text-slate-400">Ganancia Estimada</p>
                         <p className="text-sm font-bold text-slate-700">${estimatedProfit.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};