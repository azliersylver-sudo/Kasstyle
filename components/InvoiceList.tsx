import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceStatus, Client } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Edit, Trash2 } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetailModal } from './InvoiceDetailModal';

export const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Helper to get client name
  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente desconocido';
  const getClient = (id: string) => clients.find(c => c.id === id);

  const loadData = () => {
    setInvoices(StorageService.getInvoices().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setClients(StorageService.getClients());
  };

  useEffect(() => {
    loadData();
    // Subscribe to changes (e.g. from cloud load or other components)
    const unsubscribe = StorageService.subscribe(loadData);
    return () => unsubscribe();
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent triggering row clicks
    if (confirm('¿Estás seguro de que quieres eliminar esta factura permanentemente? Esta acción se sincronizará con la hoja de cálculo.')) {
      StorageService.deleteInvoice(id);
    }
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingId(id);
    setIsFormOpen(true);
  };

  const handleRowClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
  };

  const handleNew = () => {
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };
  
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, id: string) => {
    e.stopPropagation();
    const newStatus = e.target.value as InvoiceStatus;
    StorageService.updateInvoiceStatus(id, newStatus);
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus === 'all') return true;
    return inv.status === filterStatus;
  });

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID: return 'bg-green-100 text-green-800 border-green-200';
      case InvoiceStatus.PENDING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case InvoiceStatus.PARTIAL: return 'bg-blue-100 text-blue-800 border-blue-200';
      case InvoiceStatus.DRAFT: return 'bg-gray-100 text-gray-800 border-gray-200';
      case InvoiceStatus.DELIVERED: return 'bg-purple-100 text-purple-800 border-purple-200';
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
                        <tr 
                            key={inv.id} 
                            onClick={() => handleRowClick(inv)}
                            className="hover:bg-indigo-50/50 transition-colors cursor-pointer"
                        >
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">{getClientName(inv.clientId)}</div>
                                <div className="text-xs text-slate-500">{inv.items?.length || 0} productos</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                {new Date(inv.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                <select
                                    value={inv.status}
                                    onChange={(e) => handleStatusChange(e, inv.id)}
                                    className={`text-xs font-medium rounded-full px-2 py-1 border focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer ${getStatusColor(inv.status)}`}
                                >
                                    {Object.values(InvoiceStatus).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900 font-bold text-right">
                                ${(inv.grandTotalUsd || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={(e) => handleEdit(e, inv.id)} 
                                      className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                                      title="Editar completo"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                      onClick={(e) => handleDelete(e, inv.id)} 
                                      className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                      title="Eliminar"
                                    >
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

      {/* Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal 
            invoice={selectedInvoice} 
            client={getClient(selectedInvoice.clientId) || { id: '0', name: 'Desconocido', phone: '', address: '', email: '' }}
            onClose={() => setSelectedInvoice(null)} 
        />
      )}
    </div>
  );
};