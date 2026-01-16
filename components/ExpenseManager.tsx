import React, { useState, useEffect, useMemo } from 'react';
import { Expense } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Plus, Trash2, Calendar, DollarSign, Tag, PieChart as PieIcon, Edit2, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export const ExpenseManager: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // State to track if we are editing an existing expense
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // State for delete confirmation
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

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
            date: new Date(expenseToEdit.date).toISOString().split('T')[0],
            amount: expenseToEdit.amount
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    setIsSaving(true);
    
    // Parse amount strictly
    const numAmount = parseFloat(formData.amount.toString());

    const expense: Expense = {
        id: editingId || crypto.randomUUID(),
        date: new Date(formData.date).toISOString(),
        category: formData.category as any,
        description: formData.description,
        amount: isNaN(numAmount) ? 0 : numAmount
    };

    await StorageService.saveExpense(expense);
    setIsSaving(false);
    setIsModalOpen(false);
    refreshExpenses();
  };

  const handleDeleteClick = (id: string) => {
    setExpenseToDelete(id);
  };

  const confirmDelete = async () => {
    if (expenseToDelete) {
        await StorageService.deleteExpense(expenseToDelete);
        setExpenseToDelete(null);
        refreshExpenses();
    }
  };

  // --- Statistics ---
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  
  const chartData = useMemo(() => {
      const grouped = expenses.reduce((acc, curr) => {
          acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
          return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Control de Gastos</h2>
            <p className="text-slate-500 text-sm">Registra costos operativos, materiales y servicios</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Registrar Gasto
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Summary & Chart */}
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Total Gastos Acumulados</h3>
                  <div className="text-3xl font-bold text-slate-800 flex items-center">
                      <DollarSign className="w-6 h-6 text-slate-400 mr-1"/>
                      {totalExpenses.toFixed(2)}
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-4 flex items-center">
                      <PieIcon className="w-4 h-4 mr-2"/> Distribución
                  </h3>
                  <div className="h-64">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                      ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                              No hay datos suficientes
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Right: List */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                 <h3 className="font-bold text-slate-700">Historial de Transacciones</h3>
             </div>
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                         <tr>
                             <th className="px-6 py-3">Fecha</th>
                             <th className="px-6 py-3">Descripción</th>
                             <th className="px-6 py-3">Categoría</th>
                             <th className="px-6 py-3 text-right">Monto</th>
                             <th className="px-6 py-3 text-right">Acciones</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {expenses.map(exp => (
                             <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                     {new Date(exp.date).toLocaleDateString()}
                                 </td>
                                 <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                     {exp.description}
                                 </td>
                                 <td className="px-6 py-4">
                                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                         {exp.category}
                                     </span>
                                 </td>
                                 <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                                     ${exp.amount.toFixed(2)}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                     <div className="flex justify-end gap-2">
                                         <button 
                                            onClick={() => handleOpenModal(exp)}
                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                         >
                                             <Edit2 size={16} />
                                         </button>
                                         <button 
                                            onClick={() => handleDeleteClick(exp.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
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

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800">{editingId ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}</h3>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <input 
                        type="date"
                        required
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input 
                    type="text"
                    required
                    placeholder="Ej. Rollos de envoplast, Pago de flete..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <input 
                            type="number"
                            step="0.01"
                            required
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            value={formData.amount}
                            onChange={e => setFormData({...formData, amount: e.target.value})}
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                    <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <select 
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                            <option value="Material">Material</option>
                            <option value="Servicio">Servicio</option>
                            <option value="Transporte">Transporte</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" isLoading={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center">
                    <div className="bg-red-100 p-3 rounded-full mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar Gasto</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        ¿Estás seguro de que quieres eliminar este registro de gasto?
                        <br/><span className="font-semibold text-red-500 text-xs">Esta acción no se puede deshacer.</span>
                    </p>
                    <div className="flex gap-3 w-full">
                        <Button variant="secondary" className="flex-1" onClick={() => setExpenseToDelete(null)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={confirmDelete}>
                            Sí, Eliminar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};