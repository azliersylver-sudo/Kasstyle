import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Invoice, InvoiceStatus } from '../types';
import { StorageService } from '../services/storage';
import { GeminiService } from '../services/geminiService';
import { DollarSign, TrendingUp, Package, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from './Button';

export const Dashboard: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    setInvoices(StorageService.getInvoices());
    setExchangeRate(StorageService.getExchangeRate());
  }, []);

  const stats = useMemo(() => {
    let revenue = 0;
    let netProfit = 0;
    let pending = 0;
    let count = 0;

    invoices.forEach(inv => {
      // Per prompt requirement: "Cálculo de ganancia neta: (precio con descuento - precio original + comisión)"
      // This implies: (Selling Price - Sourcing Price) + Commissions
      // Note: Excluding logistics from this specific calculation as per "Excluir precio logística"
      
      const invItems = inv.items || [];
      const profitFromItems = invItems.reduce((acc, item) => {
        return acc + (((item.finalPrice || 0) - (item.originalPrice || 0)) + (item.commission || 0)) * (item.quantity || 0);
      }, 0);

      netProfit += profitFromItems;
      const total = inv.grandTotalUsd || 0;
      revenue += total;
      count += 1;

      if (inv.status === InvoiceStatus.PENDING || inv.status === InvoiceStatus.DRAFT) {
        pending += total;
      } else if (inv.status === InvoiceStatus.PARTIAL) {
        pending += (total * 0.3); // Assuming 30% pending
      }
    });

    return { revenue, netProfit, pending, count };
  }, [invoices]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.DELIVERED) {
         // Group by month
         const date = new Date(inv.createdAt);
         const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
         data[key] = (data[key] || 0) + (inv.grandTotalUsd || 0);
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

  const handleRateUpdate = () => {
    const newRate = prompt("Ingrese nueva tasa USD/Bs:", exchangeRate.toString());
    if (newRate && !isNaN(parseFloat(newRate))) {
        StorageService.setExchangeRate(parseFloat(newRate));
        setExchangeRate(parseFloat(newRate));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Resumen Financiero</h2>
           <p className="text-slate-500 text-sm">Visión general del negocio</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
           <span className="text-sm font-medium text-slate-600">Tasa BCV/Paralelo:</span>
           <span className="text-lg font-bold text-emerald-600">{(exchangeRate || 0).toFixed(2)} Bs</span>
           <Button size="sm" variant="ghost" onClick={handleRateUpdate}>Editar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ingresos Totales (USD)" value={`$${(stats.revenue || 0).toFixed(2)}`} icon={DollarSign} color="indigo" />
        <StatCard title="Ganancia Neta (USD)" value={`$${(stats.netProfit || 0).toFixed(2)}`} icon={TrendingUp} color="emerald" subtext="Sin logística" />
        <StatCard title="Por Cobrar" value={`$${(stats.pending || 0).toFixed(2)}`} icon={AlertCircle} color="orange" />
        <StatCard title="Pedidos Totales" value={stats.count} icon={Package} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Ingresos Mensuales</h3>
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