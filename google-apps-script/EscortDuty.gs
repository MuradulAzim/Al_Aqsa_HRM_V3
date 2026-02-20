/**
 * Al-Aqsa HRM Backend - Escort Duty Handler
 * Operations for escort duty tracking
 */

/**
 * Get escort duty records (filtered by date range)
 */
function handleGetEscortDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canView')) {
    return unauthorizedResponse('getEscortDuty');
  }
  
  try {
    let records = getSheetData(SHEETS.ESCORT_DUTY);
    
    // Filter by date range if provided
    if (payload.startDate && payload.endDate) {
      records = records.filter(r => {
        return r.startDate <= payload.endDate && r.endDate >= payload.startDate;
      });
    }
    
    return {
      success: true,
      action: 'getEscortDuty',
      data: records,
      message: 'Escort duty records retrieved'
    };
  } catch (error) {
    return sanitizedError('getEscortDuty', error);
  }
}

/**
 * Add escort duty record
 */
function handleAddEscortDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canAdd')) {
    return unauthorizedResponse('addEscortDuty');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['id', 'startDate', 'endDate', 'employeeName'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addEscortDuty',
        data: null,
        message: validationError
      };
    }
    
    // Prepare record data
    const recordData = {
      id: payload.id,
      startDate: payload.startDate,
      endDate: payload.endDate,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      clientId: payload.clientId || '',
      clientName: payload.clientName || '',
      totalDays: parseNumber(payload.totalDays, 1),
      conveyance: parseNumber(payload.conveyance, 0),
      status: payload.status || 'Active',
      notes: payload.notes || ''
    };
    
    // Add record
    addRecord(SHEETS.ESCORT_DUTY, recordData);
    
    return {
      success: true,
      action: 'addEscortDuty',
      data: recordData,
      message: 'Escort duty record added'
    };
  } catch (error) {
    return sanitizedError('addEscortDuty', error);
  }
}

/**
 * Delete escort duty record
 */
function handleDeleteEscortDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canDelete')) {
    return unauthorizedResponse('deleteEscortDuty');
  }
  
  try {
    const deleted = deleteRecord(SHEETS.ESCORT_DUTY, payload.id);
    
    if (!deleted) {
      return {
        success: false,
        action: 'deleteEscortDuty',
        data: null,
        message: 'Escort duty record not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteEscortDuty',
      data: null,
      message: 'Escort duty record deleted'
    };
  } catch (error) {
    return sanitizedError('deleteEscortDuty', error);
  }
}
