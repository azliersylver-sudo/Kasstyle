// --- CONFIGURACIÓN ---
// Versión: 3.0 (Fix Amount Paid Persistence & Headers)

const CLIENT_HEADERS = ['id', 'name', 'phone', 'email', 'address', 'notes'];
// Added amountPaid explicitly. If your sheet doesn't have it, the script will now force-update headers.
const INVOICE_HEADERS = ['id', 'clientId', 'createdAt', 'updatedAt', 'status', 'exchangeRate', 'logisticsCost', 'amountPaid', 'grandTotalUsd', 'items'];
const SETTINGS_HEADERS = ['key', 'value'];

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const clients = readSheetRows(ss, 'Clients', CLIENT_HEADERS);
    const invoices = readSheetRows(ss, 'Invoices', INVOICE_HEADERS);
    const settings = readSettingsSheet(ss);

    // Sanitize Numbers
    const safeInvoices = invoices.map(inv => {
      return {
        ...inv,
        logisticsCost: safeNumber(inv.logisticsCost),
        amountPaid: safeNumber(inv.amountPaid), // Critical read
        grandTotalUsd: safeNumber(inv.grandTotalUsd),
        exchangeRate: safeNumber(inv.exchangeRate)
      };
    });

    const result = {
      clients: clients,
      invoices: safeInvoices,
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
  lock.waitLock(30000); 

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    
    if (body.clients) {
      writeSheetRows(ss, 'Clients', CLIENT_HEADERS, body.clients);
    }
    
    if (body.invoices) {
      const processedInvoices = body.invoices.map(inv => {
        return {
          ...inv,
          items: JSON.stringify(inv.items || []),
          logisticsCost: safeNumber(inv.logisticsCost),
          amountPaid: safeNumber(inv.amountPaid), // Critical write
          grandTotalUsd: safeNumber(inv.grandTotalUsd),
          exchangeRate: safeNumber(inv.exchangeRate)
        };
      });
      writeSheetRows(ss, 'Invoices', INVOICE_HEADERS, processedInvoices);
    }
    
    if (body.settings) {
      writeSettingsSheet(ss, body.settings);
    }

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
  if (!val) return 0;
  // Handle strings like "10,50" or "10.50"
  const str = String(val).replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
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

  const lastRow = Math.max(sheet.getLastRow(), 2);
  // Clear old data to prevent ghosts
  sheet.getRange(2, 1, lastRow, headers.length).clearContent();

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