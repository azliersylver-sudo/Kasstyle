// --- CONFIGURACIÓN ---
// Versión: 4.3 (Corrección de Guardado de Gastos)
//
// --- LIBRERÍAS REQUERIDAS ---
// Por favor, agrega la siguiente biblioteca en el editor de Apps Script (Recursos > Bibliotecas):
// ID: 1ZpY_UxTyIHZMW2_Yu90Yoq9XPlks9iAdgKOUXgP46d2Ks4ZeFt-JSRe5
// Versión: 7

const CLIENT_HEADERS = ['id', 'name', 'phone', 'email', 'address', 'notes'];
const INVOICE_HEADERS = ['id', 'clientId', 'createdAt', 'updatedAt', 'status', 'exchangeRate', 'logisticsCost', 'amountPaid', 'grandTotalUsd', 'items'];
const EXPENSE_HEADERS = ['id', 'description', 'amount', 'category', 'date'];
const SETTINGS_HEADERS = ['key', 'value'];

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const clients = readSheetRows(ss, 'Clients', CLIENT_HEADERS);
    const invoices = readSheetRows(ss, 'Invoices', INVOICE_HEADERS);
    const expenses = readSheetRows(ss, 'Expenses', EXPENSE_HEADERS);
    const settings = readSettingsSheet(ss);

    // Sanitize Numbers
    const safeInvoices = invoices.map(inv => {
      return {
        ...inv,
        logisticsCost: safeNumber(inv.logisticsCost),
        amountPaid: safeNumber(inv.amountPaid), 
        grandTotalUsd: safeNumber(inv.grandTotalUsd),
        exchangeRate: safeNumber(inv.exchangeRate)
      };
    });

    const safeExpenses = expenses.map(exp => ({
        ...exp,
        amount: safeNumber(exp.amount)
    }));

    const result = {
      clients: clients,
      invoices: safeInvoices,
      expenses: safeExpenses,
      settings: settings
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  // Aumentamos el tiempo de espera del lock para evitar colisiones
  lock.waitLock(45000); 

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Parseo robusto del body
    const jsonString = e.postData.contents;
    const body = JSON.parse(jsonString);
    
    // 1. Clients
    if (body.clients) {
      try {
        writeSheetRows(ss, 'Clients', CLIENT_HEADERS, body.clients);
      } catch (err) { console.error("Error writing Clients", err); }
    }
    
    // 2. Invoices
    if (body.invoices) {
      try {
        const processedInvoices = body.invoices.map(inv => ({
          ...inv,
          items: JSON.stringify(inv.items || []),
          logisticsCost: safeNumber(inv.logisticsCost),
          amountPaid: safeNumber(inv.amountPaid),
          grandTotalUsd: safeNumber(inv.grandTotalUsd),
          exchangeRate: safeNumber(inv.exchangeRate)
        }));
        writeSheetRows(ss, 'Invoices', INVOICE_HEADERS, processedInvoices);
      } catch (err) { console.error("Error writing Invoices", err); }
    }

    // 3. Expenses - CRITICAL: Independent Block
    if (body.expenses) {
      try {
        const processedExpenses = body.expenses.map(exp => ({
            ...exp,
            amount: safeNumber(exp.amount),
            date: exp.date ? String(exp.date) : new Date().toISOString()
        }));
        writeSheetRows(ss, 'Expenses', EXPENSE_HEADERS, processedExpenses);
        // Force flush specifically after expenses to ensure persistence
        SpreadsheetApp.flush();
      } catch (err) { console.error("Error writing Expenses", err); }
    }
    
    // 4. Settings
    if (body.settings) {
       try {
        writeSettingsSheet(ss, body.settings);
       } catch (err) { console.error("Error writing Settings", err); }
    }
    
    // Force final flush
    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- UTILIDADES ---

function safeNumber(val) {
  if (typeof val === 'number') return val;
  if (!val && val !== 0) return 0;
  // Handle strings like "10,50" or "10.50"
  try {
    const str = String(val).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  } catch (e) {
    return 0;
  }
}

// --- FUNCIONES DE LECTURA ---

function readSheetRows(ss, sheetName, headers) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; 

  // Read all data
  // Get range based on header length to ensure we try to read all expected columns
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      let value = row[index];
      
      if (header === 'items') {
        if (typeof value === 'string' && value.trim().startsWith('[')) {
          try {
            value = JSON.parse(value);
          } catch (e) { value = []; }
        } else {
          value = []; 
        }
      }
      obj[header] = value;
    });
    return obj;
  });
}

function readSettingsSheet(ss) {
  const sheet = ss.getSheetByName('Settings');
  if (!sheet) return { exchangeRate: 40.5, pricePerKg: 15.43 };
  
  const data = sheet.getDataRange().getValues();
  const settings = { exchangeRate: 40.5, pricePerKg: 15.43 };
  
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const val = data[i][1];
    if (key) settings[key] = safeNumber(val);
  }
  return settings;
}

// --- FUNCIONES DE ESCRITURA ---

function writeSheetRows(ss, sheetName, headers, dataArray) {
  let sheet = ss.getSheetByName(sheetName);
  
  // Create sheet if not exists
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else {
    // Check if headers match. If the user has old columns, we update them.
    const lastCol = Math.max(sheet.getLastColumn(), headers.length);
    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Check if any header is different or missing
    let headersChanged = false;
    if (lastCol !== headers.length) headersChanged = true;
    else {
        headersChanged = currentHeaders.some((h, i) => h !== headers[i]);
    }
    
    if (headersChanged) {
       // Force update headers row
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
       // If sheet had more columns before, clear the extra ones on the right
       if (lastCol > headers.length) {
         sheet.getRange(1, headers.length + 1, sheet.getMaxRows(), lastCol - headers.length).clearContent();
       }
    }
  }

  // Clear old data to prevent ghosts
  // Start from row 2, and clear all subsequent rows
  const maxRows = sheet.getMaxRows();
  if (maxRows > 1) {
    sheet.getRange(2, 1, maxRows - 1, headers.length).clearContent();
  }

  if (!dataArray || dataArray.length === 0) return;

  // Transform objects to arrays based on header order
  const rows = dataArray.map(obj => {
    return headers.map(header => {
      const val = obj[header];
      return (val === undefined || val === null) ? '' : val;
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function writeSettingsSheet(ss, settingsObj) {
  let sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
    sheet.appendRow(['key', 'value']);
  } else {
    sheet.clearContents();
    sheet.appendRow(['key', 'value']);
  }
  
  const rows = Object.entries(settingsObj).map(([k, v]) => [k, v]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
}