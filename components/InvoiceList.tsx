import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceStatus, Client } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Edit, Trash2, AlertTriangle } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetailModal } from './InvoiceDetailModal';

export const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Delete Confirmation State
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

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

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent triggering row clicks
    setInvoiceToDelete(id);
  };

  const confirmDelete = async () => {
    if (invoiceToDelete) {
        await StorageService.deleteInvoice(invoiceToDelete);
        setInvoiceToDelete(null);
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
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'all' ? 'bg-brand text-white' : 'bg-white text-slate-600 border border-slate-200 hover:text-brand'}`}
        >
            Todos
        </button>
        {Object.values(InvoiceStatus).map(status => (
             <button 
             key={status}
             onClick={() => setFilterStatus(status)}
             className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-brand text-white' : 'bg-white text-slate-600 border border-slate-200 hover:text-brand'}`}
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
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Deuda</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {filteredInvoices.map(inv => {
                        const paid = inv.amountPaid || 0;
                        const total = inv.grandTotalUsd || 0;
                        const debt = Math.max(0, total - paid);

                        return (
                        <tr 
                            key={inv.id} 
                            onClick={() => handleRowClick(inv)}
                            className="hover:bg-purple-50/50 transition-colors cursor-pointer"
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
                                    className={`text-xs font-medium rounded-full px-2 py-1 border focus:ring-2 focus:ring-brand outline-none cursor-pointer ${getStatusColor(inv.status)}`}
                                >
                                    {Object.values(InvoiceStatus).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                                {debt > 0.01 ? (
                                    <span className="text-red-500">-${debt.toFixed(2)}</span>
                                ) : (
                                    <span className="text-green-500 font-medium">Pagado</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900 font-bold text-right">
                                ${(inv.grandTotalUsd || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={(e) => handleEdit(e, inv.id)} 
                                      className="p-2 text-brand hover:bg-purple-100 rounded-full transition-colors"
                                      title="Editar completo"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                      onClick={(e) => handleDeleteClick(e, inv.id)} 
                                      className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                      title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )})}
                    {filteredInvoices.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center">
                    <div className="bg-red-100 p-3 rounded-full mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar Factura</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        ¿Estás seguro de que quieres eliminar esta factura permanentemente? 
                        <br/><span className="font-semibold text-red-500 text-xs">Esta acción se sincronizará con Google Sheets.</span>
                    </p>
                    <div className="flex gap-3 w-full">
                        <Button variant="secondary" className="flex-1" onClick={() => setInvoiceToDelete(null)}>
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