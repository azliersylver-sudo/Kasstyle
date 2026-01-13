import React, { useState } from 'react';
import { Menu, X, LayoutDashboard, FileText, Users, CloudOff, Settings, UploadCloud, DownloadCloud, Save } from 'lucide-react';
import { StorageService } from '../services/storage';
import { SheetService } from '../services/sheetService';
import { Button } from './Button';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scriptUrl, setScriptUrl] = useState(StorageService.getScriptUrl());
  const [syncStatus, setSyncStatus] = useState<{loading: boolean; msg: string; type: 'success' | 'error' | 'neutral'}>({
    loading: false, msg: '', type: 'neutral'
  });
  
  const isOnline = navigator.onLine;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Facturas', icon: FileText },
    { id: 'clients', label: 'Clientes', icon: Users },
  ];

  const handleSaveUrl = () => {
    StorageService.setScriptUrl(scriptUrl);
    setSyncStatus({ loading: false, msg: 'URL Guardada', type: 'success' });
    setTimeout(() => setSyncStatus({ loading: false, msg: '', type: 'neutral' }), 2000);
  };

  const handleBackup = async () => {
    setSyncStatus({ loading: true, msg: 'Subiendo datos...', type: 'neutral' });
    const res = await SheetService.backupData();
    setSyncStatus({ loading: false, msg: res.message, type: res.success ? 'success' : 'error' });
  };

  const handleRestore = async () => {
    if (!confirm("Esto sobrescribirá los datos locales con los de Google Sheets. ¿Continuar?")) return;
    setSyncStatus({ loading: true, msg: 'Descargando datos...', type: 'neutral' });
    const res = await SheetService.restoreData();
    setSyncStatus({ loading: false, msg: res.message, type: res.success ? 'success' : 'error' });
    if (res.success) {
      setTimeout(() => window.location.reload(), 1500); // Reload to reflect changes
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed w-full bg-indigo-700 text-white z-20 flex items-center justify-between px-4 py-3 shadow-md">
        <span className="font-bold text-lg">VeneOrders</span>
        <button onClick={() => setSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        pt-16 lg:pt-0 flex flex-col
      `}>
        <div className="p-6 hidden lg:block">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">VeneOrders</h1>
          <p className="text-xs text-slate-400 mt-1">Gestión de Encomiendas</p>
        </div>

        <nav className="mt-4 px-2 space-y-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setSidebarOpen(false);
              }}
              className={`
                w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors
                ${activeTab === item.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-2 mb-2">
            <button 
                onClick={() => { setIsSettingsOpen(true); setSidebarOpen(false); }}
                className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
                <Settings className="mr-3 h-5 w-5" />
                Configuración / Sync
            </button>
        </div>

        <div className="p-4 bg-slate-800/50">
           <div className={`flex items-center text-xs ${isOnline ? 'text-green-400' : 'text-orange-400'}`}>
             {isOnline ? (
               <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
             ) : (
               <CloudOff className="h-3 w-3 mr-2" />
             )}
             {isOnline ? 'Online - Sincronizado' : 'Modo Offline Activo'}
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
      
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-0 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="h-5 w-5" /> Configuración de Respaldo
                    </h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            URL del Google Apps Script
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                className="flex-1 rounded-md border-slate-300 border p-2 text-sm focus:ring-indigo-500"
                                placeholder="https://script.google.com/macros/s/..."
                                value={scriptUrl}
                                onChange={(e) => setScriptUrl(e.target.value)}
                            />
                            <Button size="sm" onClick={handleSaveUrl} disabled={syncStatus.loading}>
                                <Save size={16} />
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Implementa el script en Google Sheets y pega la URL aquí.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors">
                            <UploadCloud className="mx-auto h-8 w-8 text-indigo-500 mb-2" />
                            <h4 className="font-semibold text-slate-700">Respaldar</h4>
                            <p className="text-xs text-slate-500 mb-3">Subir datos locales a Google Sheets</p>
                            <Button 
                                className="w-full" 
                                onClick={handleBackup} 
                                isLoading={syncStatus.loading && syncStatus.msg.includes('Subiendo')}
                            >
                                Subir Datos
                            </Button>
                        </div>

                        <div className="border border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors">
                            <DownloadCloud className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                            <h4 className="font-semibold text-slate-700">Restaurar</h4>
                            <p className="text-xs text-slate-500 mb-3">Descargar datos de Sheets (Sobrescribe)</p>
                            <Button 
                                className="w-full" 
                                variant="secondary" 
                                onClick={handleRestore}
                                isLoading={syncStatus.loading && syncStatus.msg.includes('Descargando')}
                            >
                                Bajar Datos
                            </Button>
                        </div>
                    </div>

                    {syncStatus.msg && (
                        <div className={`p-3 rounded-md text-sm text-center ${
                            syncStatus.type === 'success' ? 'bg-green-100 text-green-800' : 
                            syncStatus.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'
                        }`}>
                            {syncStatus.msg}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};