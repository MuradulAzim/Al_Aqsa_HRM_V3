/**
 * Al-Aqsa HRM Backend - Guard Duty Handler
 * Operations for guard duty attendance tracking
 */

/**
 * Get guard duty records (filtered by date)
 */
function handleGetGuardDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'GuardDuty', 'canView')) {
    return unauthorizedResponse('getGuardDuty');
  }
  
  try {
    let records = getSheetData(SHEETS.GUARD_DUTY);
    
    // Filter by date if provided
    if (payload.date) {
      records = records.filter(r => r.date === payload.date);
    }
    
    return {
      success: true,
      action: 'getGuardDuty',
      data: records,
      message: 'Guard duty records retrieved'
    };
  } catch (error) {
    return sanitizedError('getGuardDuty', error);
  }
}

/**
 * Add guard duty record
 */
function handleAddGuardDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'GuardDuty', 'canAdd')) {
    return unauthorizedResponse('addGuardDuty');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['id', 'date', 'employeeName'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addGuardDuty',
        data: null,
        message: validationError
      };
    }
    
    // Prepare record data (v3 schema — aligned with frontend)
    const recordData = {
      id: payload.id,
      date: payload.date,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      clientId: payload.clientId || '',
      shift: payload.shift || 'Day',
      status: payload.status || 'Present',
      checkIn: payload.checkIn || '',
      checkOut: payload.checkOut || '',
      notes: payload.notes || ''
    };
    
    // Add record
    addRecord(SHEETS.GUARD_DUTY, recordData);
    
    return {
      success: true,
      action: 'addGuardDuty',
      data: recordData,
      message: 'Guard duty record added'
    };
  } catch (error) {
    return sanitizedError('addGuardDuty', error);
  }
}

/**
 * Delete guard duty record
 */
function handleDeleteGuardDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'GuardDuty', 'canDelete')) {
    return unauthorizedResponse('deleteGuardDuty');
  }
  
  try {
    const deleted = deleteRecord(SHEETS.GUARD_DUTY, payload.id);
    
    if (!deleted) {
      return {
        success: false,
        action: 'deleteGuardDuty',
        data: null,
        message: 'Guard duty record not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteGuardDuty',
      data: null,
      message: 'Guard duty record deleted'
    };
  } catch (error) {
    return sanitizedError('deleteGuardDuty', error);
  }
}

/**
 * Get dashboard statistics
 *
 * PHASE 2: Permission enforced at centralized gate (ACTION_PERMISSIONS → GuardDuty/canView)
 * and defense-in-depth check below.
 */
function handleGetDashboardStats(payload, sessionUser) {
  // Defense-in-depth: also enforced by centralized gate
  if (!sessionUser || !checkPermission(sessionUser.role, 'GuardDuty', 'canView')) {
    return unauthorizedResponse('getDashboardStats');
  }

  try {
    const today = getTodayISO();
    const employees = getSheetData(SHEETS.EMPLOYEES);
    const guardDuty = getSheetData(SHEETS.GUARD_DUTY);
    const fileUploads = getSheetData(SHEETS.FILE_UPLOADS);
    
    // Filter today's duty
    const todayDuty = guardDuty.filter(r => r.date === today);
    
    // Calculate employee stats
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'Active').length;
    const inactiveEmployees = totalEmployees - activeEmployees;
    
    // Calculate guard duty stats for today
    const todayTotal = todayDuty.length;
    const todayDayShift = todayDuty.filter(r => r.shift === 'Day').length;
    const todayNightShift = todayDuty.filter(r => r.shift === 'Night').length;
    const todayPresent = todayDuty.filter(r => r.status === 'Present').length;
    const todayAbsent = todayDuty.filter(r => r.status === 'Absent').length;
    const todayLate = todayDuty.filter(r => r.status === 'Late').length;

    // Calculate file upload stats
    const totalFiles = fileUploads.length;
    const todayFiles = fileUploads.filter(f => f.uploadedAt && f.uploadedAt.startsWith(today)).length;
    
    return {
      success: true,
      action: 'getDashboardStats',
      data: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          inactive: inactiveEmployees
        },
        guardDuty: {
          todayTotal: todayTotal,
          todayDayShift: todayDayShift,
          todayNightShift: todayNightShift,
          present: todayPresent,
          absent: todayAbsent,
          late: todayLate
        },
        files: {
          total: totalFiles,
          todayUploads: todayFiles
        }
      },
      message: 'Dashboard stats retrieved'
    };
  } catch (error) {
    return sanitizedError('getDashboardStats', error);
  }
}
