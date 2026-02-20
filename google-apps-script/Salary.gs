/**
 * Al-Aqsa HRM Backend - Salary Ledger Handler
 * Operations for salary ledger and salary generation
 */

/**
 * Get salary ledger records (filtered by employeeId and/or month)
 */
function handleGetSalaryLedger(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Salary', 'canView')) {
    return unauthorizedResponse('getSalaryLedger');
  }
  
  try {
    let records = getSheetData(SHEETS.SALARY_LEDGER);
    
    // Filter by employeeId/Name if provided
    if (payload.employeeId) {
      const searchTerm = payload.employeeId.toLowerCase();
      records = records.filter(e => 
        (e.employeeName && e.employeeName.toLowerCase().includes(searchTerm)) ||
        e.employeeId === payload.employeeId
      );
    }
    
    // Filter by month if provided
    if (payload.month) {
      records = records.filter(e => e.month === payload.month);
    }
    
    return {
      success: true,
      action: 'getSalaryLedger',
      data: records,
      message: 'Salary ledger retrieved'
    };
  } catch (error) {
    return sanitizedError('getSalaryLedger', error);
  }
}

/**
 * Generate salary entries from unprocessed events
 */
function handleGenerateSalary(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Salary', 'canAdd')) {
    return unauthorizedResponse('generateSalary');
  }
  
  try {
    const newEntries = [];
    const now = getNowISO();
    
    // Get processed events
    const processedEventsData = getSheetData(SHEETS.PROCESSED_EVENTS);
    const processedEvents = processedEventsData.map(e => e.eventKey);
    
    // Get current running balance for each employee from existing ledger
    const salaryLedger = getSheetData(SHEETS.SALARY_LEDGER);
    const employeeBalances = {};
    salaryLedger.forEach(entry => {
      employeeBalances[entry.employeeId] = parseNumber(entry.runningBalance, 0);
    });
    
    // Default daily rate
    const dailyRate = CONFIG.DEFAULT_DAILY_RATE || 500;
    
    // Process Guard Duty (if Present)
    const guardDuty = getSheetData(SHEETS.GUARD_DUTY);
    guardDuty.forEach(duty => {
      const eventKey = 'guard-' + duty.id;
      if (!processedEvents.includes(eventKey) && duty.status === 'Present') {
        const earned = dailyRate;
        const employeeId = duty.employeeId || 'EMP-' + duty.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance + earned;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: duty.employeeName,
          sourceModule: 'Guard',
          sourceId: duty.id,
          date: duty.date,
          shiftOrHours: duty.shift,
          earnedAmount: earned,
          deductedAmount: 0,
          netChange: earned,
          runningBalance: newBalance,
          month: duty.date ? duty.date.substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Process Day Labor
    const dayLabor = getSheetData(SHEETS.DAY_LABOR);
    dayLabor.forEach(labor => {
      const eventKey = 'labor-' + labor.id;
      if (!processedEvents.includes(eventKey)) {
        const hours = parseNumber(labor.hoursWorked, 0);
        const earned = (hours / 9) * dailyRate;
        const employeeId = labor.employeeId || 'EMP-' + labor.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance + earned;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: labor.employeeName,
          sourceModule: 'DayLabor',
          sourceId: labor.id,
          date: labor.date,
          shiftOrHours: hours + ' hrs',
          earnedAmount: parseFloat(earned.toFixed(2)),
          deductedAmount: 0,
          netChange: parseFloat(earned.toFixed(2)),
          runningBalance: parseFloat(newBalance.toFixed(2)),
          month: labor.date ? labor.date.substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Process Escort Duty (Active only)
    const escortDuty = getSheetData(SHEETS.ESCORT_DUTY);
    escortDuty.forEach(escort => {
      const eventKey = 'escort-' + escort.id;
      if (!processedEvents.includes(eventKey) && escort.status === 'Active') {
        const totalDays = parseNumber(escort.totalDays, 0);
        const conveyance = parseNumber(escort.conveyance, 0);
        const earned = (dailyRate * totalDays) + conveyance;
        const employeeId = escort.employeeId || 'EMP-' + escort.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance + earned;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: escort.employeeName,
          sourceModule: 'Escort',
          sourceId: escort.id,
          date: escort.startDate,
          shiftOrHours: totalDays + ' days',
          earnedAmount: parseFloat(earned.toFixed(2)),
          deductedAmount: 0,
          netChange: parseFloat(earned.toFixed(2)),
          runningBalance: parseFloat(newBalance.toFixed(2)),
          month: escort.startDate ? escort.startDate.substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Process Loan/Advance (Active only - as deductions)
    const loanAdvance = getSheetData(SHEETS.LOAN_ADVANCE);
    loanAdvance.forEach(loan => {
      const eventKey = 'loan-' + loan.id;
      if (!processedEvents.includes(eventKey) && loan.status === 'Active') {
        const deducted = parseNumber(loan.amount, 0);
        const employeeId = loan.employeeId || 'EMP-' + loan.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance - deducted;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: loan.employeeName,
          sourceModule: 'LoanAdvance',
          sourceId: loan.id,
          date: loan.issueDate,
          shiftOrHours: loan.type,
          earnedAmount: 0,
          deductedAmount: deducted,
          netChange: -deducted,
          runningBalance: parseFloat(newBalance.toFixed(2)),
          month: loan.issueDate ? loan.issueDate.substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Add new entries to salary ledger
    newEntries.forEach(entry => {
      addRecord(SHEETS.SALARY_LEDGER, entry);
    });
    
    return {
      success: true,
      action: 'generateSalary',
      data: { entriesGenerated: newEntries.length },
      message: 'Generated ' + newEntries.length + ' salary entries'
    };
  } catch (error) {
    return sanitizedError('generateSalary', error);
  }
}
