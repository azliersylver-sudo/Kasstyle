import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Invoice, InvoiceStatus, Expense, Client } from '../types';
import { StorageService } from '../services/storage';
import { GeminiService } from '../services/geminiService';
import { DollarSign, TrendingUp, Package, AlertCircle, Sparkles, Settings, X, Calendar, FileDown, TrendingDown, Percent } from 'lucide-react';
import { Button } from './Button';

type TimeRange = 'week' | 'month' | 'year' | 'all';

export const Dashboard: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [pricePerKg, setPricePerKg] = useState<number>(0);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Time Filter State
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  // State for Settings Modal
  const [editModal, setEditModal] = useState<{ type: 'rate' | 'price'; value: string } | null>(null);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  // Helper to load all data from storage
  const loadData = () => {
      setInvoices(StorageService.getInvoices());
      setExpenses(StorageService.getExpenses());
      setExchangeRate(StorageService.getExchangeRate());
      setPricePerKg(StorageService.getPricePerKg());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = StorageService.subscribe(loadData);
    return () => unsubscribe();
  }, []);

  // --- Date Filtering Logic ---
  const { filteredInvoices, filteredExpenses } = useMemo(() => {
    const now = new Date();
    let startDate = new Date(0); // Epoch for 'all'

    if (timeRange === 'week') {
        startDate = new Date();
        startDate.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    const fInvoices = invoices.filter(inv => new Date(inv.createdAt) >= startDate);
    const fExpenses = expenses.filter(exp => new Date(exp.date) >= startDate);

    return { filteredInvoices: fInvoices, filteredExpenses: fExpenses };
  }, [invoices, expenses, timeRange]);

  const stats = useMemo(() => {
    let revenue = 0; // Dinero Recibido (Only from Allowed Statuses)
    let grossProfit = 0; // Ganancia Operativa (Ventas)
    let pending = 0; // Deuda por Cobrar
    let count = 0; // Pedidos Activos

    const FINANCIALLY_ACTIVE_STATUSES = [InvoiceStatus.PARTIAL, InvoiceStatus.PAID, InvoiceStatus.DELIVERED];

    // 1. Calculate Income & Gross Profit
    filteredInvoices.forEach(inv => {
      if (inv.status === InvoiceStatus.DRAFT) return;

      const grandTotal = inv.grandTotalUsd || 0;
      const amountPaid = inv.amountPaid || 0;
      const remaining = Math.max(0, grandTotal - amountPaid);
      
      count += 1;
      pending += remaining;

      if (FINANCIALLY_ACTIVE_STATUSES.includes(inv.status)) {
         revenue += amountPaid;

         const invItems = inv.items || [];
         const theoreticalProfit = invItems.reduce((acc, item) => {
            // NEW FORMULA: Venta + Comisión - (Costo - Impuesto)
            const unitGain = (item.finalPrice || 0) + (item.commission || 0) - ((item.originalPrice || 0) - (item.taxes || 0));
            return acc + (unitGain * (item.quantity || 0));
         }, 0);

         // Calculate realized profit based on % paid
         const percentPaid = grandTotal > 0 ? (amountPaid / grandTotal) : 0;
         grossProfit += (theoreticalProfit * Math.min(1, percentPaid));
      }
    });

    // 2. Calculate Expenses
    const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);

    // 3. Real Net Profit
    const netProfit = grossProfit - totalExpenses;
    
    // 4. Profit Margin (Net Profit / Revenue)
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return { revenue, grossProfit, netProfit, pending, count, totalExpenses, profitMargin };
  }, [filteredInvoices, filteredExpenses]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    const FINANCIALLY_ACTIVE_STATUSES = [InvoiceStatus.PARTIAL, InvoiceStatus.PAID, InvoiceStatus.DELIVERED];

    filteredInvoices.forEach(inv => {
        if (inv.status === InvoiceStatus.DRAFT) return;

        if (FINANCIALLY_ACTIVE_STATUSES.includes(inv.status) && inv.amountPaid > 0) {
            const date = new Date(inv.createdAt);
            let key = '';

            if (timeRange === 'week') {
                key = date.toLocaleDateString('es-ES', { weekday: 'short' });
            } else if (timeRange === 'month') {
                key = date.getDate().toString();
            } else if (timeRange === 'year') {
                key = date.toLocaleDateString('es-ES', { month: 'short' });
            } else {
                key = `${date.getMonth() + 1}/${date.getFullYear()}`;
            }
            
            data[key] = (data[key] || 0) + (inv.amountPaid || 0);
        }
    });

    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices, timeRange]);

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const clients = StorageService.getClients();
    const validInvoices = filteredInvoices.filter(i => i.status !== InvoiceStatus.DRAFT);
    const text = await GeminiService.analyzeFinancials(validInvoices, clients);
    setGeminiAnalysis(text);
    setLoadingAi(false);
  };

  // --- PDF Export Logic ---
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const clients = StorageService.getClients();
    const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente Desconocido';

    const rangeLabels: Record<TimeRange, string> = {
        week: 'Últimos 7 Días',
        month: 'Mes Actual',
        year: 'Año Actual',
        all: 'Histórico Completo'
    };

    // Generate Invoices Rows
    const invoiceRows = filteredInvoices
        .filter(inv => inv.status !== InvoiceStatus.DRAFT)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(inv => `
            <tr>
                <td>${new Date(inv.createdAt).toLocaleDateString()}</td>
                <td>${getClientName(inv.clientId)}</td>
                <td style="text-align: center;"><span class="badge">${inv.status}</span></td>
                <td style="text-align: right;">$${(inv.amountPaid || 0).toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold;">$${(inv.grandTotalUsd || 0).toFixed(2)}</td>
            </tr>
        `).join('');

    // Generate Expense Rows
    const expenseRows = filteredExpenses
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(exp => `
            <tr>
                <td>${new Date(exp.date).toLocaleDateString()}</td>
                <td>${exp.description}</td>
                <td>${exp.category}</td>
                <td style="text-align: right; font-weight: bold; color: #dc2626;">$${(exp.amount || 0).toFixed(2)}</td>
            </tr>
        `).join('');

    const html = `
      <html>
        <head>
          <title>Reporte Financiero - KASSTYLE</title>
          <style>
             body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.5; }
             .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #3e136b; padding-bottom: 20px; }
             .title { font-size: 28px; font-weight: bold; color: #3e136b; }
             .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
             .period { background: #f3f4f6; padding: 10px; text-align: center; font-weight: bold; border-radius: 8px; margin-bottom: 30px; }
             .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
             .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; text-align: center; }
             .card-title { font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; }
             .card-value { font-size: 24px; font-weight: bold; margin-top: 5px; color: #111; }
             
             h3 { border-bottom: 1px solid #3e136b; padding-bottom: 8px; margin-top: 40px; color: #3e136b; font-size: 18px; }
             
             table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
             th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; color: #64748b; text-transform: uppercase; }
             td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
             
             .badge { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1px solid #e2e8f0; }
             
             .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
             
             @media print {
                h3 { page-break-after: avoid; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
             }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">KASSTYLE Manager</div>
            <div class="subtitle">Reporte Consolidado de Desempeño Financiero</div>
          </div>

          <div class="period">
             Periodo: ${rangeLabels[timeRange]}
             <br/>
             <span style="font-size: 11px; font-weight: normal; color: #666">Generado el: ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}</span>
          </div>

          <div class="grid">
             <div class="card">
                <div class="card-title">Dinero Recibido</div>
                <div class="card-value">$${stats.revenue.toFixed(2)}</div>
             </div>
             <div class="card">
                <div class="card-title">Gastos Operativos</div>
                <div class="card-value" style="color: #dc2626;">-$${stats.totalExpenses.toFixed(2)}</div>
             </div>
             <div class="card">
                <div class="card-title">Utilidad Neta Real</div>
                <div class="card-value" style="color: ${stats.netProfit >= 0 ? '#10b981' : '#dc2626'};">$${stats.netProfit.toFixed(2)}</div>
             </div>
             <div class="card">
                <div class="card-title">Margen de Ganancia</div>
                <div class="card-value" style="color: ${stats.profitMargin > 15 ? '#10b981' : '#f59e0b'};">${stats.profitMargin.toFixed(1)}%</div>
             </div>
          </div>

          <h3 style="margin-top: 20px;">Análisis de Resultados</h3>
          <p style="font-size: 13px;">
            Durante el periodo <strong>${rangeLabels[timeRange]}</strong>, la operación generó ingresos reales por cobranza de <strong>$${stats.revenue.toFixed(2)}</strong>. 
            Se registraron gastos operativos por <strong>$${stats.totalExpenses.toFixed(2)}</strong>, dejando una <strong>Utilidad Neta de $${stats.netProfit.toFixed(2)}</strong>. 
            El rendimiento sobre ingresos es del <strong>${stats.profitMargin.toFixed(1)}%</strong>. Actualmente existe una cartera pendiente por cobrar de <strong>$${stats.pending.toFixed(2)}</strong>.
          </p>

          <h3>Detalle de Ingresos (Facturación)</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th style="text-align: center;">Estado</th>
                <th style="text-align: right;">Abonado</th>
                <th style="text-align: right;">Total Factura</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceRows || '<tr><td colspan="5" style="text-align: center; color: #999;">No hay facturas registradas en este periodo.</td></tr>'}
            </tbody>
          </table>

          <h3>Detalle de Egresos (Gastos Operativos)</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción / Concepto</th>
                <th>Categoría</th>
                <th style="text-align: right;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows || '<tr><td colspan="4" style="text-align: center; color: #999;">No hay gastos registrados en este periodo.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
             Documento oficial generado por KASSTYLE Manager. Prohibida su alteración sin autorización.
          </div>
        </body>
        <script>window.print();</script>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // --- Modal Handlers --- (Same as before)
  const openRateModal = () => setEditModal({ type: 'rate', value: (exchangeRate || 0).toString() });
  const openPriceModal = () => setEditModal({ type: 'price', value: (pricePerKg || 0).toString() });
  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    const cleanVal = editModal.value.replace(',', '.');
    const num = parseFloat(cleanVal);
    if (isNaN(num) || num < 0) { alert("Número inválido"); return; }
    setIsSavingSetting(true);
    try {
        if (editModal.type === 'rate') await StorageService.setExchangeRate(num);
        else await StorageService.setPricePerKg(num);
        loadData(); 
        setEditModal(null);
    } catch (error) { console.error(error); alert("Error guardando"); } 
    finally { setIsSavingSetting(false); }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Resumen Financiero</h2>
           <p className="text-slate-500 text-sm">Monitor de utilidad en tiempo real</p>
        </div>
        
        {/* Actions Bar */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
             {/* Time Filters */}
             <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm overflow-x-auto w-full lg:w-auto">
                {(['week', 'month', 'year', 'all'] as TimeRange[]).map(r => (
                    <button 
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${timeRange === r ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        {r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : r === 'year' ? 'Año' : 'Todo'}
                    </button>
                ))}
             </div>

             <div className="h-6 w-px bg-slate-300 hidden lg:block"></div>
             {/* Settings Indicators */}
             <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Tasa</span>
                    <span className="text-xs font-bold text-emerald-600">{(exchangeRate || 0).toFixed(2)} Bs</span>
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-brand" onClick={openRateModal}>
                    <Settings size={14} />
                </Button>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Envío</span>
                    <span className="text-xs font-bold text-brand">${(pricePerKg || 0).toFixed(2)}</span>
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-brand" onClick={openPriceModal}>
                    <Settings size={14} />
                </Button>
            </div>
            <div className="h-6 w-px bg-slate-300 hidden lg:block"></div>
            <Button onClick={handlePrintReport} className="flex items-center gap-2">
                <FileDown size={16} />
                <span className="hidden sm:inline">Reporte PDF</span>
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Dinero Recibido" value={`$${(stats.revenue || 0).toFixed(2)}`} icon={DollarSign} color="purple" subtext="Ingresos Brutos" />
        <StatCard title="Egresos / Gastos" value={`-$${(stats.totalExpenses || 0).toFixed(2)}`} icon={TrendingDown} color="red" subtext="Materiales y Servicios" />
        <StatCard title="Utilidad Neta Real" value={`$${(stats.netProfit || 0).toFixed(2)}`} icon={TrendingUp} color="emerald" subtext={`Margen: ${stats.profitMargin.toFixed(1)}%`} />
        <StatCard title="Deuda por Cobrar" value={`$${(stats.pending || 0).toFixed(2)}`} icon={AlertCircle} color="orange" subtext="Pendiente global" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
            <Calendar size={18} className="text-slate-400"/>
            Flujo de Ingresos (Bruto)
            <span className="text-xs font-normal text-slate-500 ml-2 bg-slate-100 px-2 py-1 rounded-full capitalize">
                {timeRange}
            </span>
          </h3>
          <div className="h-64">
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} tick={{fontSize: 12}} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="value" fill="#3e136b" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No hay ingresos registrados en este periodo.
                </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold text-slate-800">Asistente Gemini</h3>
             <Sparkles className="text-purple-500 h-5 w-5" />
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

      {/* Settings Modal (Same as before) */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Actualizar Valor</h3>
                    <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveSetting} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nuevo Valor</label>
                        <input type="text" inputMode="decimal" className="w-full rounded-lg border-slate-300 shadow-sm border p-3 text-lg text-center focus:ring-brand focus:border-brand" value={editModal.value} onChange={(e) => setEditModal({ ...editModal, value: e.target.value })} autoFocus />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => setEditModal(null)} disabled={isSavingSetting}>Cancelar</Button>
                        <Button type="submit" isLoading={isSavingSetting}>Guardar</Button>
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
        purple: 'bg-purple-100 text-purple-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        orange: 'bg-orange-100 text-orange-600',
        blue: 'bg-blue-100 text-blue-600',
        red: 'bg-red-100 text-red-600',
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