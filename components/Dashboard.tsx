import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Invoice, InvoiceStatus } from '../types';
import { StorageService } from '../services/storage';
import { GeminiService } from '../services/geminiService';
import { DollarSign, TrendingUp, Package, AlertCircle, Sparkles, Settings, X } from 'lucide-react';
import { Button } from './Button';

export const Dashboard: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [pricePerKg, setPricePerKg] = useState<number>(0);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // State for Settings Modal
  const [editModal, setEditModal] = useState<{ type: 'rate' | 'price'; value: string } | null>(null);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  // Helper to load all data from storage
  const loadSettings = () => {
      setInvoices(StorageService.getInvoices());
      setExchangeRate(StorageService.getExchangeRate());
      setPricePerKg(StorageService.getPricePerKg());
  };

  useEffect(() => {
    loadSettings();
    const unsubscribe = StorageService.subscribe(loadSettings);
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    let revenue = 0; // Total CASH collected (Abonos)
    let netProfit = 0; // Realized Profit based on % paid
    let pending = 0; // Total Remaining Balance
    let count = 0;

    invoices.forEach(inv => {
      const grandTotal = inv.grandTotalUsd || 0;
      const amountPaid = inv.amountPaid || 0;
      const remaining = Math.max(0, grandTotal - amountPaid);
      
      // Revenue is strictly what has been paid
      revenue += amountPaid;
      pending += remaining;
      count += 1;

      // Profit Calculation (Realized)
      // 1. Calculate Theoretical Total Profit for this invoice
      const invItems = inv.items || [];
      const theoreticalProfit = invItems.reduce((acc, item) => {
        return acc + (((item.finalPrice || 0) - (item.originalPrice || 0)) + (item.commission || 0)) * (item.quantity || 0);
      }, 0);

      // 2. Calculate percentage of invoice paid
      const percentPaid = grandTotal > 0 ? (amountPaid / grandTotal) : 0;
      
      // 3. Add proportional profit to Net Profit
      // Example: If profit is $100 but they only paid 50%, realized profit is $50
      netProfit += (theoreticalProfit * Math.min(1, percentPaid));
    });

    return { revenue, netProfit, pending, count };
  }, [invoices]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    invoices.forEach(inv => {
        // Chart now shows ACTUAL CASH FLOW (amountPaid) over time
        // We use createdAt for simplicity, though ideally we'd track payment dates.
        if (inv.amountPaid > 0) {
            const date = new Date(inv.createdAt);
            const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
            data[key] = (data[key] || 0) + (inv.amountPaid || 0);
        }
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const clients = StorageService.getClients();
    const text = await GeminiService.analyzeFinancials(invoices, clients);
    setGeminiAnalysis(text);
    setLoadingAi(false);
  };

  // --- Modal Handlers ---

  const openRateModal = () => {
    setEditModal({ type: 'rate', value: (exchangeRate || 0).toString() });
  };

  const openPriceModal = () => {
    setEditModal({ type: 'price', value: (pricePerKg || 0).toString() });
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;

    // Flexible parsing for commas or dots
    const cleanVal = editModal.value.replace(',', '.');
    const num = parseFloat(cleanVal);

    if (isNaN(num) || num < 0) {
        alert("Por favor ingrese un número válido.");
        return;
    }

    setIsSavingSetting(true);
    
    try {
        if (editModal.type === 'rate') {
            await StorageService.setExchangeRate(num);
        } else {
            await StorageService.setPricePerKg(num);
        }
        loadSettings(); // Refresh UI immediately
        setEditModal(null);
    } catch (error) {
        console.error("Error saving setting:", error);
        alert("No se pudo guardar la configuración. Intente nuevamente.");
    } finally {
        setIsSavingSetting(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Resumen Financiero</h2>
           <p className="text-slate-500 text-sm">Basado en flujo de caja real (Abonos)</p>
        </div>
        
        {/* Settings Bar */}
        <div className="flex flex-wrap gap-3">
             <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Tasa Cambio</span>
                    <span className="text-sm font-bold text-emerald-600">{(exchangeRate || 0).toFixed(2)} Bs</span>
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600" onClick={openRateModal}>
                    <Settings size={16} />
                </Button>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Envío / Kg</span>
                    <span className="text-sm font-bold text-indigo-600">${(pricePerKg || 0).toFixed(2)}</span>
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600" onClick={openPriceModal}>
                    <Settings size={16} />
                </Button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Dinero Recibido (USD)" value={`$${(stats.revenue || 0).toFixed(2)}`} icon={DollarSign} color="indigo" subtext="Suma de abonos reales" />
        <StatCard title="Ganancia Realizada (USD)" value={`$${(stats.netProfit || 0).toFixed(2)}`} icon={TrendingUp} color="emerald" subtext="Proporcional al pagado" />
        <StatCard title="Deuda por Cobrar" value={`$${(stats.pending || 0).toFixed(2)}`} icon={AlertCircle} color="orange" subtext="Dinero en la calle" />
        <StatCard title="Pedidos Totales" value={stats.count} icon={Package} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Flujo de Ingresos (Mensual)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                   {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#4f46e5" />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold text-slate-800">Asistente Gemini</h3>
             <Sparkles className="text-indigo-500 h-5 w-5" />
          </div>
          <div className="flex-1 bg-slate-50 rounded-lg p-4 text-sm text-slate-600 overflow-y-auto max-h-64">
            {geminiAnalysis ? (
                <div dangerouslySetInnerHTML={{ __html: geminiAnalysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
            ) : (
                <p className="text-center text-slate-400 italic">Solicita un análisis para obtener insights sobre tu flujo de caja.</p>
            )}
          </div>
          <div className="mt-4">
            <Button onClick={handleAiAnalysis} isLoading={loadingAi} className="w-full">
                Analizar Negocio con IA
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">
                        {editModal.type === 'rate' ? 'Actualizar Tasa (Bs/USD)' : 'Actualizar Precio Envío ($/Kg)'}
                    </h3>
                    <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSaveSetting} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {editModal.type === 'rate' ? 'Nueva Tasa del Día' : 'Nuevo Costo por Kg'}
                        </label>
                        <div className="relative">
                            <input 
                                type="text"
                                inputMode="decimal" 
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3 text-lg font-mono text-center"
                                value={editModal.value}
                                onChange={(e) => setEditModal({ ...editModal, value: e.target.value })}
                                placeholder="0.00"
                                autoFocus
                            />
                            <div className="absolute right-3 top-3 text-slate-400 text-sm font-medium pointer-events-none">
                                {editModal.type === 'rate' ? 'Bs' : 'USD'}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">
                            Puede usar punto (.) o coma (,) para decimales.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => setEditModal(null)} disabled={isSavingSetting}>
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={isSavingSetting}>
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => {
    const colors: any = {
        indigo: 'bg-indigo-100 text-indigo-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        orange: 'bg-orange-100 text-orange-600',
        blue: 'bg-blue-100 text-blue-600',
    };

    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <h4 className="text-2xl font-bold text-slate-800 mt-1">{value}</h4>
                    {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-lg ${colors[color]}`}>
                    <Icon size={24} />
                </div>
            </div>
        </div>
    );
};