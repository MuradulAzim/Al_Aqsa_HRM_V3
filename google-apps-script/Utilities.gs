/**
 * WARNING — ONE-TIME INITIALIZATION ONLY
 *
 * setupDatabase() is a ONE-TIME initialization function.
 *
 * It creates the v3 database spreadsheet and Drive folder and stores
 * their IDs in PropertiesService (APP_CONFIG).
 *
 * After successful execution:
 * - Configuration is loaded dynamically at runtime
 * - Hardcoded IDs in Code.gs are NOT used
 *
 * DO NOT rerun this function in production.
 * DO NOT hardcode Spreadsheet or Drive IDs in Code.gs.
 * DO NOT call this function from frontend or scheduled triggers.
 */
function setupDatabase() {
  // Check if config already exists in PropertiesService
  const scriptProps = PropertiesService.getScriptProperties();
  const existingConfig = scriptProps.getProperty('APP_CONFIG');
  
  if (existingConfig) {
    const config = JSON.parse(existingConfig);
    
    // Verify existing spreadsheet still exists
    try {
      const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
      if (ss) {
        Logger.log('Database already exists!');
        Logger.log('Spreadsheet ID: ' + config.SPREADSHEET_ID);
        Logger.log('Drive Folder ID: ' + config.DRIVE_FOLDER_ID);
        Logger.log('To reconfigure, first clear APP_CONFIG in PropertiesService');
        return {
          spreadsheetId: config.SPREADSHEET_ID,
          driveFolderId: config.DRIVE_FOLDER_ID,
          alreadyExists: true
        };
      }
    } catch (e) {
      // Spreadsheet no longer exists, need to recreate
      Logger.log('Existing spreadsheet not found, creating new one...');
    }
  }
  
  // Create the spreadsheet
  const ss = SpreadsheetApp.create('Al-Aqsa-App-Database');
  const spreadsheetId = ss.getId();
  
  // Create all sheets with headers
  createSheet(ss, SHEETS.USERS, ['id', 'username', 'passwordHash', 'role', 'status', 'createdAt']);
  createSheet(ss, SHEETS.EMPLOYEES, ['id', 'name', 'phone', 'nid', 'role', 'salary', 'deployedAt', 'joinDate', 'guardianName', 'guardianPhone', 'address', 'status']);
  createSheet(ss, SHEETS.CLIENTS, ['id', 'name', 'contactPerson', 'phone', 'contactRate', 'address', 'serviceStartDate', 'lastBillSubmitted', 'billStatus', 'dueAmount', 'assignedEmployeeSalary', 'status', 'createdAt']);
  createSheet(ss, SHEETS.GUARD_DUTY, ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'shift', 'status', 'checkIn', 'checkOut', 'notes']);
  createSheet(ss, SHEETS.ESCORT_DUTY, ['id', 'employeeId', 'employeeName', 'clientId', 'clientName', 'vesselName', 'lighterName', 'startDate', 'startShift', 'endDate', 'endShift', 'releasePoint', 'totalDays', 'conveyance', 'status', 'notes']);
  createSheet(ss, SHEETS.DAY_LABOR, ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName', 'hoursWorked', 'rate', 'amount', 'notes']);
  createSheet(ss, SHEETS.LOAN_ADVANCE, ['id', 'employeeId', 'employeeName', 'type', 'amount', 'issueDate', 'paymentMethod', 'remarks', 'repaymentType', 'monthlyDeduct', 'status', 'createdAt']);
  createSheet(ss, SHEETS.SALARY_LEDGER, ['id', 'employeeId', 'employeeName', 'sourceModule', 'sourceId', 'date', 'shiftOrHours', 'earnedAmount', 'deductedAmount', 'netChange', 'runningBalance', 'month', 'createdAt']);
  createSheet(ss, SHEETS.PROCESSED_EVENTS, ['eventKey', 'processedAt']);
  createSheet(ss, SHEETS.INVOICES, ['id', 'invoiceNumber', 'clientId', 'clientName', 'periodStart', 'periodEnd', 'totalEscortDays', 'escortAmount', 'totalGuardDays', 'guardAmount', 'totalLaborHours', 'laborAmount', 'subtotal', 'vatPercent', 'vatAmount', 'totalAmount', 'status', 'createdAt']);
  createSheet(ss, SHEETS.FILE_UPLOADS, ['id', 'module', 'recordId', 'fileName', 'fileType', 'fileSize', 'driveFileId', 'driveUrl', 'uploadedAt', 'uploadedBy']);
  createSheet(ss, SHEETS.JOB_POSTS, ['id', 'title', 'description', 'requirements', 'location', 'salary', 'status', 'openDate', 'closeDate', 'createdAt']);
  createSheet(ss, SHEETS.JOB_APPLICATIONS, ['id', 'jobId', 'applicantName', 'phone', 'email', 'experience', 'education', 'skills', 'resumeUrl', 'status', 'appliedAt', 'notes']);
  createSheet(ss, SHEETS.PERMISSIONS, ['role', 'module', 'canView', 'canAdd', 'canEdit', 'canDelete']);
  createSheet(ss, SHEETS.SESSIONS, ['sessionId', 'userId', 'role', 'expiresAt', 'createdAt']);
  
  // Remove default Sheet1
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }
  
  // Add default admin user
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  usersSheet.appendRow(['user-admin-001', 'admin', 'admin123', 'Admin', 'Active', getTodayISO()]);
  
  // Create Drive folder for uploads
  const folder = DriveApp.createFolder('Al-Aqsa-HRM-Uploads');
  const folderId = folder.getId();
  
  // Store configuration in PropertiesService (single source of truth)
  initConfig(spreadsheetId, folderId, 500);
  
  // Log results
  Logger.log('='.repeat(60));
  Logger.log('DATABASE SETUP COMPLETE!');
  Logger.log('='.repeat(60));
  Logger.log('Spreadsheet ID: ' + spreadsheetId);
  Logger.log('Drive Folder ID: ' + folderId);
  Logger.log('');
  Logger.log('Configuration stored in PropertiesService');
  Logger.log('UPDATE CODE.gs is no longer needed - config is automatic');
  Logger.log('='.repeat(60));
  
  return {
    spreadsheetId: spreadsheetId,
    driveFolderId: folderId,
    alreadyExists: false
  };
}

/**
 * Create a sheet with headers
 */
function createSheet(ss, sheetName, headers) {
  const sheet = ss.insertSheet(sheetName);
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return sheet;
}

/**
 * Migrate existing database sheets to v3 schema.
 * Adds missing columns to existing sheets without deleting data or reordering columns.
 * Safe to run multiple times (idempotent).
 */
function migrateDatabase() {
  const ss = getSpreadsheet();
  const v3Schema = {
    [SHEETS.EMPLOYEES]:        ['id', 'name', 'phone', 'nid', 'role', 'salary', 'deployedAt', 'joinDate', 'guardianName', 'guardianPhone', 'address', 'status'],
    [SHEETS.CLIENTS]:          ['id', 'name', 'contactPerson', 'phone', 'contactRate', 'address', 'serviceStartDate', 'lastBillSubmitted', 'billStatus', 'dueAmount', 'assignedEmployeeSalary', 'status', 'createdAt'],
    [SHEETS.GUARD_DUTY]:       ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName', 'shift', 'status', 'checkIn', 'checkOut', 'notes'],
    [SHEETS.ESCORT_DUTY]:      ['id', 'employeeId', 'employeeName', 'clientId', 'clientName', 'vesselName', 'lighterName', 'startDate', 'startShift', 'endDate', 'endShift', 'releasePoint', 'totalDays', 'conveyance', 'status', 'notes'],
    [SHEETS.DAY_LABOR]:        ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName', 'hoursWorked', 'rate', 'amount', 'notes'],
    [SHEETS.LOAN_ADVANCE]:     ['id', 'employeeId', 'employeeName', 'type', 'amount', 'issueDate', 'paymentMethod', 'remarks', 'repaymentType', 'monthlyDeduct', 'status', 'createdAt']
  };

  const results = [];
  for (const [sheetName, expectedHeaders] of Object.entries(v3Schema)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('SKIP: Sheet "' + sheetName + '" not found');
      results.push({ sheet: sheetName, added: [], skipped: true });
      continue;
    }

    const lastCol = sheet.getLastColumn();
    const currentHeaders = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
      : [];

    const missingHeaders = expectedHeaders.filter(h => currentHeaders.indexOf(h) === -1);
    if (missingHeaders.length === 0) {
      Logger.log('OK: Sheet "' + sheetName + '" already up-to-date');
      results.push({ sheet: sheetName, added: [], skipped: false });
      continue;
    }

    // Append missing columns to the right
    const startCol = lastCol + 1;
    sheet.getRange(1, startCol, 1, missingHeaders.length)
      .setValues([missingHeaders])
      .setFontWeight('bold');

    Logger.log('MIGRATED: Sheet "' + sheetName + '" — added columns: ' + missingHeaders.join(', '));
    results.push({ sheet: sheetName, added: missingHeaders, skipped: false });
  }

  Logger.log('='.repeat(60));
  Logger.log('DATABASE MIGRATION COMPLETE');
  Logger.log('='.repeat(60));
  return results;
}

// ============================================
// SPREADSHEET HELPERS
// ============================================

/**
 * Get spreadsheet instance
 */
function getSpreadsheet() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID not configured. Run setupDatabase() first.');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Get sheet by name
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }
  return sheet;
}

/**
 * Get all data from sheet as array of objects
 */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return []; // Only headers, no data
  }
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// ============================================
// INDEXED SHEET LOOKUPS
// ============================================

/**
 * Get indexed sheet data for fast lookups
 * Returns { rows: array of objects, index: { keyValue -> rowIndex } }
 * 
 * RULES:
 * - Indexes are READ-ONLY
 * - Rebuilt per request (no stale cache)
 * - Keys stored as STRING for consistent lookup
 * - rowIndex in index is 0-based into rows array
 * 
 * @param {string} sheetName - Name of sheet
 * @param {string} keyColumn - Column to index by (e.g., 'id', 'username')
 * @returns {Object} { rows: [], index: {}, headers: [] }
 */
function getIndexedSheet(sheetName, keyColumn) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { rows: [], index: {}, headers: data[0] || [] };
  }
  
  const headers = data[0];
  const keyIndex = headers.indexOf(keyColumn);
  
  if (keyIndex < 0) {
    throw new Error('Index column not found: ' + keyColumn + ' in sheet ' + sheetName);
  }
  
  const rows = [];
  const index = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    headers.forEach((header, colIndex) => {
      obj[header] = row[colIndex];
    });
    
    // Store in rows array
    const rowIndex = rows.length;
    rows.push(obj);
    
    // Build index (key as string for consistent lookup)
    const keyValue = String(row[keyIndex]);
    index[keyValue] = rowIndex;
  }
  
  return { rows, index, headers };
}

/**
 * Get record from indexed sheet by key value
 * Returns record object or null if not found
 * 
 * @param {Object} indexedSheet - Result from getIndexedSheet()
 * @param {string|number} keyValue - Value to look up
 * @returns {Object|null} Record or null
 */
function getFromIndex(indexedSheet, keyValue) {
  const rowIndex = indexedSheet.index[String(keyValue)];
  if (rowIndex === undefined) {
    return null;
  }
  return indexedSheet.rows[rowIndex];
}

/**
 * Check if key exists in indexed sheet
 * 
 * @param {Object} indexedSheet - Result from getIndexedSheet()
 * @param {string|number} keyValue - Value to check
 * @returns {boolean} True if exists
 */
function indexHasKey(indexedSheet, keyValue) {
  return indexedSheet.index[String(keyValue)] !== undefined;
}

/**
 * Find row index by ID (1-indexed, includes header row)
 */
function findRowById(sheetName, id, idColumn = 'id') {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idColumn);
  
  if (idIndex < 0) {
    throw new Error('Column not found: ' + idColumn);
  }
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === id) {
      return i + 1; // Convert to 1-indexed row number
    }
  }
  
  return -1; // Not found
}

/**
 * Find record by ID
 */
function findById(sheetName, id, idColumn = 'id') {
  const records = getSheetData(sheetName);
  return records.find(r => r[idColumn] === id) || null;
}

/**
 * Add record to sheet
 */
function addRecord(sheetName, record) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const row = headers.map(header => record[header] !== undefined ? record[header] : '');
  sheet.appendRow(row);
  
  return record;
}

/**
 * Update record in sheet
 */
function updateRecord(sheetName, id, record, idColumn = 'id') {
  const sheet = getSheet(sheetName);
  const rowIndex = findRowById(sheetName, id, idColumn);
  
  if (rowIndex < 0) {
    return null;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => record[header] !== undefined ? record[header] : '');
  
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  
  return record;
}

/**
 * Delete record from sheet
 */
function deleteRecord(sheetName, id, idColumn = 'id') {
  const sheet = getSheet(sheetName);
  const rowIndex = findRowById(sheetName, id, idColumn);
  
  if (rowIndex < 0) {
    return false;
  }
  
  sheet.deleteRow(rowIndex);
  return true;
}

/**
 * Add or update record
 */
function upsertRecord(sheetName, id, record, idColumn = 'id') {
  const existing = findById(sheetName, id, idColumn);
  
  if (existing) {
    return updateRecord(sheetName, id, record, idColumn);
  } else {
    return addRecord(sheetName, record);
  }
}

// ============================================
// DATE HELPERS
// ============================================

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
function getTodayISO() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Get current datetime in ISO format
 */
function getNowISO() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
}

// ============================================
// ID GENERATION
// ============================================

/**
 * Generate unique ID with prefix
 */
function generateId(prefix = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return prefix ? prefix + '-' + timestamp + '-' + random : timestamp + '-' + random;
}

// ============================================
// PERMISSION HELPERS
// ============================================

/**
 * Check if user has permission for action
 */
function checkPermission(role, module, permission) {
  if (!role || !BACKEND_PERMISSIONS[role]) {
    return false;
  }
  
  // Normalize module name: accept both "Invoice" (frontend) and "Invoices" (backend)
  var normalizedModule = module;
  if (module === 'Invoice') {
    normalizedModule = 'Invoices';
  }
  
  var modulePerms = BACKEND_PERMISSIONS[role][normalizedModule];
  if (!modulePerms) {
    return false;
  }
  
  return modulePerms[permission] === true;
}

/**
 * Create unauthorized response
 */
function unauthorizedResponse(action) {
  return {
    success: false,
    action: action,
    data: null,
    error: 'FORBIDDEN',
    message: 'Insufficient permissions'
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate required fields
 */
function validateRequired(payload, fields) {
  const missing = fields.filter(f => !payload[f] && payload[f] !== 0);
  return missing.length === 0 ? null : 'Missing required fields: ' + missing.join(', ');
}

/**
 * Parse number safely
 */
function parseNumber(value, defaultValue = 0) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

// ============================================
// PHASE 2 SECURITY — AUTH GATE FUNCTIONS
// These are the real implementations, wired into handleRequest().
// ============================================

/**
 * Assert that the session validation result indicates a valid user.
 * @param {Object} sessionResult - result from validateSession()
 * @returns {Object|null} denial response if unauthenticated, or null if OK
 */
function assertAuthenticated(sessionResult) {
  if (!sessionResult || sessionResult.error) {
    var errorCode = (sessionResult && sessionResult.error) || 'UNAUTHORIZED';
    return deny(
      errorCode,
      errorCode === 'SESSION_EXPIRED'
        ? 'Session expired. Please log in again.'
        : 'Authentication required'
    );
  }
  if (!sessionResult.user) {
    return deny('UNAUTHORIZED', 'Authentication required');
  }
  return null; // authenticated OK
}

/**
 * Assert that the authenticated user's role is allowed to perform
 * the given action, using the ACTION_PERMISSIONS map as authority.
 *   null entry        → auth-only; allowed for any authenticated user.
 *   missing entry     → FAIL CLOSED (deny by default).
 *   array permission  → allow if ANY listed permission is true.
 *   string permission → single checkPermission() call.
 *
 * @param {string} action - the routeAction case name
 * @param {string} role   - sessionUser.role (Admin | Supervisor | Viewer)
 * @returns {Object|null} denial response if forbidden, or null if OK
 */
function assertAuthorized(action, role) {
  // Fail closed: if action is not in the map, deny
  if (!(action in ACTION_PERMISSIONS)) {
    Logger.log('SECURITY: Unknown action denied (fail-closed): ' + action);
    return deny('FORBIDDEN', 'Action not permitted');
  }

  var perm = ACTION_PERMISSIONS[action];

  // null → auth-only, no role check needed
  if (perm === null) {
    return null;
  }

  // Array of permissions → allow if the role has ANY of them
  if (Array.isArray(perm.permission)) {
    var hasAny = perm.permission.some(function(p) {
      return checkPermission(role, perm.module, p);
    });
    if (!hasAny) {
      return deny('FORBIDDEN', 'Insufficient permissions for ' + perm.module);
    }
    return null;
  }

  // Single permission check
  if (!checkPermission(role, perm.module, perm.permission)) {
    return deny('FORBIDDEN', 'Insufficient permissions for ' + perm.module);
  }
  return null;
}

/**
 * Build a standardised denial response.
 * @param {string} errorCode - UNAUTHORIZED | FORBIDDEN | SESSION_EXPIRED
 * @param {string} message   - human-readable denial reason
 * @param {string} [action]  - optional action name (set by caller if needed)
 * @returns {Object} { success:false, action, data:null, error, message }
 */
function deny(errorCode, message, action) {
  return {
    success: false,
    action: action || '',
    data: null,
    error: errorCode,
    message: message || 'Access denied'
  };
}

/**
 * Return a sanitized error response for handler catch blocks.
 * Logs the real error internally but returns a generic message to the client.
 * @param {string} action - action name for the response
 * @param {Error}  error  - the caught error (logged, not exposed)
 * @returns {Object} safe error response
 */
function sanitizedError(action, error) {
  Logger.log('Handler error [' + action + ']: ' + error.toString());
  return {
    success: false,
    action: action,
    data: null,
    error: 'SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again.'
  };
}
