import { StorageService } from './storage';
import { Client, Invoice } from '../types';

export const SheetService = {
  backupData: async (): Promise<{ success: boolean; message: string }> => {
    const url = StorageService.getScriptUrl();
    if (!url) return { success: false, message: 'Falta configurar la URL del Script' };

    const data = StorageService.getAllData();

    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Important for GAS Web Apps simple requests
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      // With mode: 'no-cors', we get an opaque response, so we can't read the body.
      // We assume success if no network error occurred.
      return { success: true, message: 'Datos enviados a Google Sheets correctamente.' };
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Error de conexión con Google Sheets.' };
    }
  },

  restoreData: async (): Promise<{ success: boolean; message: string }> => {
    const url = StorageService.getScriptUrl();
    if (!url) return { success: false, message: 'Falta configurar la URL del Script' };

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network error');
      
      const data = await response.json();
      
      if (data.clients && Array.isArray(data.clients) && data.invoices && Array.isArray(data.invoices)) {
        StorageService.overwriteAllData(data.clients, data.invoices);
        return { success: true, message: 'Datos restaurados desde Google Sheets.' };
      }
      
      return { success: false, message: 'Formato de datos inválido desde Sheets.' };
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Error al descargar datos. Verifique su conexión.' };
    }
  }
};