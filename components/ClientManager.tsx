import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { StorageService } from '../services/storage';
import { Button } from './Button';
import { Search, Plus, Trash2, Edit2, MapPin, Phone } from 'lucide-react';

export const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Client>>({});

  useEffect(() => {
    refreshClients();
    // Subscribe to storage updates (e.g. from background fetch)
    const unsubscribe = StorageService.subscribe(refreshClients);
    return () => unsubscribe();
  }, []);

  const refreshClients = () => {
    setClients(StorageService.getClients());
  };

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData(client);
    } else {
      setEditingClient(null);
      setFormData({});
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    
    setIsSaving(true);

    const clientToSave = {
      id: editingClient?.id || crypto.randomUUID(),
      name: formData.name,
      email: formData.email || '',
      phone: formData.phone,
      address: formData.address || '',
      notes: formData.notes || ''
    } as Client;

    await StorageService.saveClient(clientToSave);
    setIsSaving(false);
    refreshClients();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      await StorageService.deleteClient(id);
      refreshClients();
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Clientes</h2>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o teléfono..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{client.name}</h3>
                <p className="text-slate-500 text-sm mt-1 flex items-center">
                  <Phone className="h-3 w-3 mr-1" /> {client.phone}
                </p>
                <p className="text-slate-500 text-sm mt-1 flex items-center">
                  <MapPin className="h-3 w-3 mr-1" /> {client.address || 'Sin dirección'}
                </p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleOpenModal(client)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(client.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nombre Completo</label>
                <input 
                  required
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Teléfono</label>
                <input 
                  required
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                  value={formData.phone || ''}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email (Opcional)</label>
                <input 
                  type="email"
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                  value={formData.email || ''}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Dirección de Entrega</label>
                <textarea 
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                  rows={3}
                  value={formData.address || ''}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" isLoading={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};