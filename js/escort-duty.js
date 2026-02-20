// Escort Duty Tracking Module (Date-Range Based)
// Isolated module - NO cross-module references

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let escortRecords = [];
let currentRange = {
    startDate: getTodayISO(),
    endDate: getTodayISO()
};

// ============================================
// PAGINATION STATE
// ============================================
let escortPaginationState = createPaginationState(10);
let escortFilteredData = [];

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh escort duty data for a specific date range
 * ALL UI updates happen here - no other function may mutate escortRecords
 * @param {Object} dateRange - { startDate, endDate } in YYYY-MM-DD format
 */
async function refreshEscortDuty(dateRange) {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('escortTableBody', 11);
    }
    
    try {
        const response = await request("getEscortDuty", dateRange);
        if (response.success && Array.isArray(response.data)) {
            escortRecords = response.data;
        } else {
            escortRecords = [];
        }
        // All UI updates happen here
        renderEscortTable(escortRecords);
        updateEscortSummary(escortRecords);
        updateDateRangeDisplay();
    } catch (error) {
        console.error("Failed to refresh escort duty:", error);
        escortRecords = [];
        renderEscortTable(escortRecords);
        updateEscortSummary(escortRecords);
        updateDateRangeDisplay();
        if (typeof showToast === 'function') {
            showToast('Failed to load escort records', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render escort records table
 * @param {Array} data - Array of escort records
 */
function renderEscortTable(data) {
    escortFilteredData = data || [];
    escortPaginationState.currentPage = 1;
    renderPaginatedEscortTable();
}

/**
 * Render paginated escort records table
 */
function renderPaginatedEscortTable() {
    const tbody = document.getElementById('escortTableBody');
    if (!tbody) return;

    if (!escortFilteredData || escortFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('escortTableBody', 'No escort records found for this date range. Add a record using the button above.', 11, 'fa-ship');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="px-4 py-8 text-center text-gray-500">
                        No escort records found for this date range
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('escortPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(escortFilteredData, escortPaginationState.currentPage, escortPaginationState.pageSize);

    tbody.innerHTML = result.items.map((record, localIndex) => {
        const displayIndex = result.startIndex + localIndex;
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${displayIndex}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(record.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.clientName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.vesselName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.lighterName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.startDate || '')} ${escapeHtml(record.startShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.endDate || '')} ${escapeHtml(record.endShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${record.totalDays || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.conveyance || 0}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${record.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    ${escapeHtml(record.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('escortPagination', {
        ...result,
        pageSize: escortPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            escortPaginationState.currentPage = page;
            renderPaginatedEscortTable();
        },
        onPageSizeChange: (size) => {
            escortPaginationState.pageSize = size;
            escortPaginationState.currentPage = 1;
            renderPaginatedEscortTable();
        }
    });
}

/**
 * Update summary metrics
 * @param {Array} data - Array of escort records
 */
function updateEscortSummary(data) {
    const totalRecords = data.length;
    const totalDays = data.reduce((sum, r) => sum + (Number(r.totalDays) || 0), 0);
    const activeCount = data.filter(r => r.status === 'Active').length;
    const inactiveCount = data.filter(r => r.status === 'Inactive').length;

    setElementText('summaryTotalRecords', totalRecords);
    setElementText('summaryTotalDays', totalDays);
    setElementText('summaryActiveEscorts', activeCount);
    setElementText('summaryInactiveEscorts', inactiveCount);
}

/**
 * Update date range display in navigation
 */
function updateDateRangeDisplay() {
    setElementText('startDateDisplay', currentRange.startDate);
    setElementText('endDateDisplay', currentRange.endDate);
}

/**
 * Set element text content safely
 * @param {string} elementId - Element ID
 * @param {string|number} text - Text content
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// DATE RANGE NAVIGATION
// ============================================

/**
 * Apply date range filter from inputs
 */
function applyDateRange() {
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (startInput && endInput) {
        currentRange.startDate = startInput.value || getTodayISO();
        currentRange.endDate = endInput.value || getTodayISO();
        
        // Ensure start is not after end
        if (currentRange.startDate > currentRange.endDate) {
            currentRange.endDate = currentRange.startDate;
            endInput.value = currentRange.endDate;
        }
        
        refreshEscortDuty(currentRange);
    }
}

/**
 * Reset date range to today
 */
function resetDateRange() {
    const today = getTodayISO();
    currentRange.startDate = today;
    currentRange.endDate = today;
    
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (startInput) startInput.value = today;
    if (endInput) endInput.value = today;
    
    refreshEscortDuty(currentRange);
}

/**
 * Parse ISO date string to Date object (locale-independent)
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Date} Date object
 */
function parseDate(dateStr) {
    const parts = dateStr.split('-');
    return new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10)
    );
}

/**
 * Format Date object to ISO string (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Date in YYYY-MM-DD format
 */
function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================
// TOTAL DAYS CALCULATION
// ============================================

/**
 * Calculate total days based on start/end date and shifts
 * Two shifts = one full day
 * Day = shift 1, Night = shift 2
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} startShift - 'Day' or 'Night'
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} endShift - 'Day' or 'Night'
 * @returns {number} Total days (can be .5 increments)
 */
function calculateTotalDays(startDate, startShift, endDate, endShift) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    // Calculate full days between dates
    const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    
    // Assign shift numbers: Day = 1, Night = 2
    const startShiftNum = startShift === 'Day' ? 1 : 2;
    const endShiftNum = endShift === 'Day' ? 1 : 2;
    
    // Calculate total half-days
    // Formula: (days_diff * 2) + (endShiftNum - startShiftNum + 1)
    const totalHalfDays = (daysDiff * 2) + (endShiftNum - startShiftNum + 1);
    
    // Convert to days (2 half-days = 1 day)
    return totalHalfDays / 2;
}

// ============================================
// FORM HANDLING
// ============================================

/**
 * Open add escort modal
 */
function openAddEscortModal() {
    const modal = document.getElementById('escortFormModal');
    const form = document.getElementById('escortForm');
    
    if (form) {
        form.reset();
        // Pre-fill dates with current range
        form.startDate.value = currentRange.startDate;
        form.endDate.value = currentRange.endDate;
        form.startShift.value = 'Day';
        form.endShift.value = 'Night';
        form.status.value = 'Active';
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Close escort modal
 */
function closeEscortModal() {
    const modal = document.getElementById('escortFormModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Handle form submission for adding escort record
 * @param {Event} event - Form submit event
 */
async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('escortForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('escortForm')) {
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    // Generate unique ID
    const id = 'ED-' + Date.now();

    // Get form values
    const startDate = String(form.startDate.value).trim();
    const startShift = String(form.startShift.value).trim();
    const endDate = String(form.endDate.value).trim();
    const endShift = String(form.endShift.value).trim();
    
    // Calculate totalDays locally
    const totalDays = calculateTotalDays(startDate, startShift, endDate, endShift);

    const payload = {
        id: id,
        employeeId: String(form.employeeId.value || '').trim(),
        employeeName: String(form.employeeName.value).trim(),
        clientId: String(form.clientId.value || '').trim(),
        clientName: String(form.clientName.value).trim(),
        vesselName: String(form.vesselName.value).trim(),
        lighterName: String(form.lighterName.value).trim(),
        startDate: startDate,
        startShift: startShift,
        endDate: endDate,
        endShift: endShift,
        releasePoint: String(form.releasePoint.value).trim(),
        totalDays: totalDays,
        conveyance: Number(form.conveyance.value) || 0,
        status: String(form.status.value).trim(),
        notes: String(form.notes.value).trim()
    };

    try {
        const response = await request("addEscortDuty", payload);
        if (response.success) {
            closeEscortModal();
            await refreshEscortDuty(currentRange);
            if (typeof showToast === 'function') {
                showToast('Escort record saved successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save escort record', 'error');
            }
        }
    } catch (error) {
        console.error("Error adding escort record:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving escort record', 'error');
        }
    } finally {
        restoreBtn();
    }
}

// ============================================
// DELETE OPERATION
// ============================================

/**
 * Delete an escort record
 * @param {string} id - Record ID
 */
async function deleteRecord(id) {
    const record = escortRecords.find(r => r.id === id);
    const recordName = record ? `${record.employeeName}'s escort record` : 'this escort record';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(recordName);
    } else {
        confirmed = confirm('Are you sure you want to delete this escort record?');
    }
    
    if (!confirmed) return;

    try {
        const response = await request("deleteEscortDuty", { id: id });
        if (response.success) {
            await refreshEscortDuty(currentRange);
            if (typeof showToast === 'function') {
                showToast('Escort record deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete escort record', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting escort record:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting escort record', 'error');
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize escort duty module on page load
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    if (typeof renderUserInfo === 'function') renderUserInfo();
    
    // Initialize UX enhancements
    if (typeof initFormValidation === 'function') initFormValidation('escortForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('escortFormModal', closeEscortModal);
    
    // Set initial date range inputs
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (startInput) startInput.value = currentRange.startDate;
    if (endInput) endInput.value = currentRange.endDate;
    
    // Initial data load
    await refreshEscortDuty(currentRange);
});
