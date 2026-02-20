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
    // Validate required fields
    const requiredFields = ['id', 'companyName'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addOrUpdateClient',
        data: null,
        message: validationError
      };
    }
    
    // Prepare client data
    const clientData = {
      id: payload.id,
      companyName: payload.companyName || '',
      contactPerson: payload.contactPerson || '',
      phone: payload.phone || '',
      email: payload.email || '',
      address: payload.address || '',
      status: payload.status || 'Active'
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
