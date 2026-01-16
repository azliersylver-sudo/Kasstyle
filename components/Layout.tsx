import React, { useState, useEffect } from 'react';
import { Menu, X, LayoutDashboard, FileText, Users, CloudOff, Cloud, RefreshCw, Receipt } from 'lucide-react';
import { StorageService } from '../services/storage';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = navigator.onLine;

  useEffect(() => {
    // Initial fetch from cloud
    setIsSyncing(true);
    StorageService.init().finally(() => setIsSyncing(false));

    // Optional: Subscribe to know when data changes happen (often implies a sync started)
    const unsubscribe = StorageService.subscribe(() => {
        // Just a visual flash could go here, but sync is handled in background
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Facturas', icon: FileText },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'expenses', label: 'Gastos', icon: Receipt },
  ];

  const handleManualSync = () => {
    setIsSyncing(true);
    StorageService.init().finally(() => {
        setIsSyncing(false);
        alert("Datos sincronizados con Google Sheets");
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed w-full bg-brand text-white z-20 flex items-center justify-between px-4 py-3 shadow-md">
        <span className="font-bold text-lg">KASSTYLE</span>
        <button onClick={() => setSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-[#1e0a3c] text-white transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        pt-16 lg:pt-0 flex flex-col border-r border-brand-dark
      `}>
        <div className="p-6 hidden lg:block bg-brand-dark/30">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-300 bg-clip-text text-transparent">KASSTYLE</h1>
          <p className="text-xs text-purple-200 mt-1">Gestión de Encomiendas</p>
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
                  ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'}
              `}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-black/20">
           <div className={`flex items-center text-xs mb-2 ${isOnline ? 'text-green-400' : 'text-orange-400'}`}>
             {isOnline ? (
               <Cloud className="h-3 w-3 mr-2" />
             ) : (
               <CloudOff className="h-3 w-3 mr-2" />
             )}
             {isOnline ? 'Conectado a Sheet' : 'Modo Offline'}
           </div>
           
           <button 
             onClick={handleManualSync}
             disabled={isSyncing || !isOnline}
             className="w-full flex items-center justify-center px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-xs text-slate-200 transition-colors disabled:opacity-50"
           >
             <RefreshCw className={`h-3 w-3 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
             {isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}
           </button>
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
    </div>
  );
};