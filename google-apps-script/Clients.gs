/**
 * Al-Aqsa HRM Backend - Clients Handler
 * CRUD operations for client management
 */

/**
 * Get all clients
 */
function handleGetClients(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Clients', 'canView')) {
    return unauthorizedResponse('getClients');
  }
  
  try {
    const clients = getSheetData(SHEETS.CLIENTS);
    
    return {
      success: true,
      action: 'getClients',
      data: clients,
      message: 'Clients retrieved'
    };
  } catch (error) {
    return sanitizedError('getClients', error);
  }
}

/**
 * Add or update client
 */
function handleAddOrUpdateClient(payload, sessionUser) {
  // Use indexed lookup for existence check
  const indexedClients = getIndexedSheet(SHEETS.CLIENTS, 'id');
  const existing = payload.id ? getFromIndex(indexedClients, payload.id) : null;
  const permission = existing ? 'canEdit' : 'canAdd';
  
  // Permission check
  if (!checkPermission(sessionUser.role, 'Clients', permission)) {
    return unauthorizedResponse('addOrUpdateClient');
  }
  
  try {
    // Accept both 'companyName' and legacy 'name' — canonical field is companyName
    const resolvedName = (payload.companyName || payload.name || '').toString().trim();

    // Validate required fields
    if (!payload.id || !resolvedName) {
      return {
        success: false,
        action: 'addOrUpdateClient',
        data: null,
        message: 'Missing required fields: id, companyName'
      };
    }
    
    // Prepare client data — canonical schema (matches sheet headers)
    const clientData = {
      id: payload.id,
      companyName: resolvedName,
      contactPerson: (payload.contactPerson || '').toString().trim(),
      phone: (payload.phone || '').toString().trim(),
      email: (payload.email || '').toString().trim(),
      contactRate: parseNumber(payload.contactRate, 0),
      address: (payload.address || '').toString().trim(),
      serviceStartDate: payload.serviceStartDate || '',
      lastBillSubmitted: payload.lastBillSubmitted || '',
      billStatus: payload.billStatus || '',
      dueAmount: parseNumber(payload.dueAmount, 0),
      assignedEmployeeSalary: parseNumber(payload.assignedEmployeeSalary, 0),
      status: payload.status || 'Active',
      createdAt: payload.createdAt || ''
    };
    
    // Add or update
    upsertRecord(SHEETS.CLIENTS, payload.id, clientData);
    
    return {
      success: true,
      action: 'addOrUpdateClient',
      data: clientData,
      message: existing ? 'Client updated' : 'Client added'
    };
  } catch (error) {
    return sanitizedError('addOrUpdateClient', error);
  }
}

/**
 * Delete client
 */
function handleDeleteClient(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Clients', 'canDelete')) {
    return unauthorizedResponse('deleteClient');
  }
  
  try {
    const deleted = deleteRecord(SHEETS.CLIENTS, payload.id);
    
    if (!deleted) {
      return {
        success: false,
        action: 'deleteClient',
        data: null,
        message: 'Client not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteClient',
      data: null,
      message: 'Client deleted'
    };
  } catch (error) {
    return sanitizedError('deleteClient', error);
  }
}
