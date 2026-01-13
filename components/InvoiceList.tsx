import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceStatus, Client } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Edit, Trash2 } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';

export const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Helper to get client name
  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente desconocido';

  const loadData = () => {
    setInvoices(StorageService.getInvoices().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setClients(StorageService.getClients());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar esta factura permanentemente?')) {
      StorageService.deleteInvoice(id);
      loadData();
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    loadData();
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus === 'all') return true;
    return inv.status === filterStatus;
  });

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID: return 'bg-green-100 text-green-800';
      case InvoiceStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
      case InvoiceStatus.PARTIAL: return 'bg-blue-100 text-blue-800';
      case InvoiceStatus.DRAFT: return 'bg-gray-100 text-gray-800';
      case InvoiceStatus.DELIVERED: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isFormOpen) {
    return <InvoiceForm invoiceId={editingId} onClose={handleCloseForm} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Facturas y Presupuestos</h2>
        <Button onClick={handleNew}>+ Nueva Factura</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button 
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
            Todos
        </button>
        {Object.values(InvoiceStatus).map(status => (
             <button 
             key={status}
             onClick={() => setFilterStatus(status)}
             className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
         >
             {status}
         </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total (USD)</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {filteredInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">{getClientName(inv.clientId)}</div>
                                <div className="text-xs text-slate-500">{inv.items?.length || 0} productos</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                {new Date(inv.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                                    {inv.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900 font-bold text-right">
                                ${(inv.grandTotalUsd || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleEdit(inv.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(inv.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                No se encontraron facturas con este filtro.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};