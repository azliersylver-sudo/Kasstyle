import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { InvoiceList } from './components/InvoiceList';
import { ClientManager } from './components/ClientManager';
import { ExpenseManager } from './components/ExpenseManager';
import { StorageService } from './services/storage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch data from Google Sheet on load
    const loadData = async () => {
        await StorageService.init();
        setIsLoading(false);
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-600">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <h2 className="text-xl font-bold text-slate-800">Cargando VeneOrders...</h2>
            <p className="text-sm">Sincronizando con Google Sheets</p>
        </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'invoices':
        return <InvoiceList />;
      case 'clients':
        return <ClientManager />;
      case 'expenses':
        return <ExpenseManager />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;