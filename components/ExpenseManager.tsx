import React, { useState, useEffect, useMemo } from 'react';
import { Expense } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Plus, Trash2, Calendar, DollarSign, Tag, PieChart as PieIcon, Edit2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export const ExpenseManager: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // State to track if we are editing an existing expense
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State - Using 'any' for amount to allow string manipulation during input
  const [formData, setFormData] = useState<{
    date: string;
    category: string;
    description: string;
    amount: string | number;
  }>({
    date: new Date().toISOString().split('T')[0],
    category: 'Material',
    description: '',
    amount: ''
  });

  useEffect(() => {
    refreshExpenses();
    const unsubscribe = StorageService.subscribe(refreshExpenses);
    return () => unsubscribe();
  }, []);

  const refreshExpenses = () => {
    setExpenses(StorageService.getExpenses());
  };

  const handleOpenModal = (expenseToEdit?: Expense) => {
    if (expenseToEdit) {
        // Edit Mode
        setEditingId(expenseToEdit.id);
        setFormData({
            ...expenseToEdit,
            // Ensure date format matches input type="date" (YYYY-MM-DD)
            date: new Date(expenseToEdit.date).toISOString().split('T')[0]
        });
    } else {
        // Create Mode
        setEditingId(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            category: 'Material',
            description: '',
            amount: ''
        });
    }
    setIsModalOpen(true);
  };

  // Helper to generate IDs safely
  const generateSafeId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse amount manually to handle string input
    const amountValue = parseFloat(formData.amount.toString().replace(',', '.'));
    
    if (!formData.description || isNaN(amountValue) || amountValue <= 0) {
        alert("Por favor ingrese una descripción y un monto válido.");
        return;
    }
    
    setIsSaving(true);

    const expenseToSave: Expense = {
      // Use existing ID if editing, otherwise generate new explicitly here
      id: editingId || generateSafeId(),
      description: formData.description,
      amount: amountValue,
      category: formData.category as any,
      date: formData.date || new Date().toISOString()
    };

    await StorageService.saveExpense(expenseToSave);
    
    setIsSaving(false);
    refreshExpenses();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    // Usamos window.confirm para asegurar que el diálogo sea visible
    if (window.confirm('¿Estás seguro de que deseas eliminar este gasto permanentemente?')) {
      await StorageService.deleteExpense(id);
      refreshExpenses();
    }
  };

  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Chart Data Preparation
  const chartData = useMemo(() => {
      const categories = ['Material', 'Servicio', 'Transporte', 'Otro'];
      return categories.map(cat => ({
          name: cat,
          value: expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0)
      })).filter(item => item.value > 0);
  }, [expenses]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Control de Gastos</h2>
            <p className="text-sm text-slate-500">Registra materiales, servicios y costos operativos</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Registrar Gasto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Analytics Card */}
        <div className="md:col-span-1 space-y-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-red-600">
                    <PieIcon size={20} />
                    <h3 className="font-bold">Total Egresos</h3>
                </div>
                <p className="text-3xl font-bold text-slate-900">${totalExpenses.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-2">Impacto directo en tu utilidad neta.</p>
                
                <div className="h-48 mt-4">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => `$${value.toFixed(2)}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }}/>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-300 text-xs">
                            Sin datos para graficar
                        </div>
                    )}
                </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-700 mb-3 text-xs uppercase tracking-wide">Desglose por Categoría</h4>
                <div className="space-y-2">
                    {['Material', 'Servicio', 'Transporte', 'Otro'].map((cat, idx) => {
                        const sum = expenses.filter(e => e.category === cat).reduce((a, b) => a + b.amount, 0);
                        return (
                            <div key={cat} className="flex justify-between text-sm items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }}></div>
                                    <span className="text-slate-500">{cat}</span>
                                </div>
                                <span className="font-medium text-slate-800">${sum.toFixed(2)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Expenses List */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[600px]">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Historial de Gastos</h3>
            </div>
            <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Descripción</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Categoría</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Monto</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {expenses.map(exp => (
                            <tr key={exp.id} className="hover:bg-slate-50/50">
                                <td className="px-6 py-3 text-sm text-slate-600 font-mono">
                                    {new Date(exp.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-slate-800 font-medium">
                                    {exp.description}
                                </td>
                                <td className="px-6 py-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                        <Tag size={10} className="mr-1" />
                                        {exp.category}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-red-600 font-bold text-right">
                                    -${exp.amount.toFixed(2)}
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenModal(exp);
                                            }}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                                            title="Editar Gasto"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDelete(exp.id);
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                            title="Eliminar Gasto"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {expenses.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    No hay gastos registrados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
            <h3 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <DollarSign size={20} />
                </div>
                {editingId ? 'Editar Gasto' : 'Nuevo Gasto'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input 
                  required
                  placeholder="Ej. Cinta de embalaje"
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                  value={formData.description || ''}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                    <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                        required
                        type="number"
                        step="0.01"
                        className="w-full pl-8 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 font-mono"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                    <input 
                        required
                        type="date"
                        className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        />
                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select 
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value as any})}
                >
                    <option value="Material">Material</option>
                    <option value="Servicio">Servicio</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Otro">Otro</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" isLoading={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                    {editingId ? 'Actualizar' : 'Guardar Gasto'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};