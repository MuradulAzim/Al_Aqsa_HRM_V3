// Employee Management Module
// Core profile data only - NO file uploads

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let employees = [];

// ============================================
// PAGINATION STATE
// ============================================
let employeesPaginationState = createPaginationState(10);
let employeesFilteredData = [];

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh employees data from backend
 * Must be called explicitly - no auto-refresh
 */
async function refreshEmployees() {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('employeesTableBody', 8);
    }
    
    try {
        const response = await request("getEmployees", {});
        if (response.success && Array.isArray(response.data)) {
            employees = response.data;
        } else {
            employees = [];
        }
        renderEmployeesTable(employees);
    } catch (error) {
        console.error("Failed to refresh employees:", error);
        employees = [];
        renderEmployeesTable(employees);
        if (typeof showToast === 'function') {
            showToast('Failed to load employees', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTION
// ============================================

/**
 * Render employees table from provided data
 * @param {Array} data - Array of employee objects
 */
function renderEmployeesTable(data) {
    employeesFilteredData = data || [];
    employeesPaginationState.currentPage = 1;
    renderPaginatedEmployeesTable();
}

/**
 * Render paginated employees table
 */
function renderPaginatedEmployeesTable() {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;

    if (!employeesFilteredData || employeesFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('employeesTableBody', 'No employees found. Add your first employee using the form above.', 8, 'fa-users');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                        No employees found
                    </td>
                </tr>
            `;
        }
        // Clear pagination controls when empty
        const paginationContainer = document.getElementById('employeesPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(employeesFilteredData, employeesPaginationState.currentPage, employeesPaginationState.pageSize);

    tbody.innerHTML = result.items.map((emp, localIndex) => {
        const displayIndex = result.startIndex + localIndex;
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${displayIndex}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(emp.name || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(emp.phone || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(emp.role || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${emp.salary || ''}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(emp.deployedAt || '')}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(emp.status)}">
                    ${escapeHtml(emp.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">
                <button onclick="viewEmployee('${emp.id}')" class="text-blue-600 hover:text-blue-800 mr-2">View</button>
                <button onclick="editEmployee('${emp.id}')" class="text-green-600 hover:text-green-800 mr-2">Edit</button>
                <button onclick="deleteEmployee('${emp.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
        `;
    }).join('');

    // Render pagination controls
    renderPaginationControls('employeesPagination', {
        ...result,
        pageSize: employeesPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            employeesPaginationState.currentPage = page;
            renderPaginatedEmployeesTable();
        },
        onPageSizeChange: (size) => {
            employeesPaginationState.pageSize = size;
            employeesPaginationState.currentPage = 1;
            renderPaginatedEmployeesTable();
        }
    });
}

/**
 * Get CSS class for status badge
 * @param {string} status - Employee status
 * @returns {string} CSS classes
 */
function getStatusClass(status) {
    switch (status) {
        case 'Active':
            return 'bg-green-100 text-green-800';
        case 'Inactive':
            return 'bg-gray-100 text-gray-800';
        case 'Terminated':
            return 'bg-red-100 text-red-800';
        case 'Suspended':
            return 'bg-yellow-100 text-yellow-800';
        case 'Retired':
            return 'bg-blue-100 text-blue-800';
        default:
            return 'bg-gray-100 text-gray-800';
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
// FORM HANDLING
// ============================================

/**
 * Handle form submission for add/edit employee
 * @param {Event} event - Form submit event
 */
async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('employeeForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('employeeForm')) {
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    // Collect form data - ensure id and phone remain strings
    const payload = {
        id: String(form.phone.value).trim(),  // Phone is employee ID
        name: String(form.name.value).trim(),
        phone: String(form.phone.value).trim(),
        role: String(form.role.value).trim(),
        salary: Number(form.salary.value) || 0,
        deployedAt: String(form.deployedAt.value || '').trim(),
        joinDate: String(form.joinDate.value).trim(),
        nid: String(form.nid.value).trim(),
        guardianName: String(form.guardianName.value).trim(),
        guardianPhone: String(form.guardianPhone.value).trim(),
        address: String(form.address.value).trim(),
        status: String(form.status.value).trim()
    };

    try {
        const response = await request("addOrUpdateEmployee", payload);
        if (response.success) {
            resetForm();
            await refreshEmployees();
            if (typeof showToast === 'function') {
                showToast('Employee saved successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save employee', 'error');
            }
        }
    } catch (error) {
        console.error("Error saving employee:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving employee', 'error');
        }
    } finally {
        restoreBtn();
    }
}

/**
 * Reset form to initial state
 */
function resetForm() {
    const form = document.getElementById('employeeForm');
    if (form) {
        form.reset();
    }
    document.getElementById('formTitle').textContent = 'Add New Employee';
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * View employee details
 * @param {string} id - Employee ID (string)
 */
function viewEmployee(id) {
    const emp = employees.find(e => e.id === id);
    if (!emp) {
        console.error("Employee not found:", id);
        return;
    }

    // Build details HTML
    const details = `
        <div class="space-y-2">
            <p><strong>ID/Phone:</strong> ${escapeHtml(emp.phone)}</p>
            <p><strong>Name:</strong> ${escapeHtml(emp.name)}</p>
            <p><strong>Role:</strong> ${escapeHtml(emp.role)}</p>
            <p><strong>Salary:</strong> ${emp.salary}</p>
            <p><strong>Deployed At:</strong> ${escapeHtml(emp.deployedAt || 'Not deployed')}</p>
            <p><strong>Join Date:</strong> ${escapeHtml(emp.joinDate)}</p>
            <p><strong>NID:</strong> ${escapeHtml(emp.nid)}</p>
            <p><strong>Guardian Name:</strong> ${escapeHtml(emp.guardianName)}</p>
            <p><strong>Guardian Phone:</strong> ${escapeHtml(emp.guardianPhone)}</p>
            <p><strong>Address:</strong> ${escapeHtml(emp.address)}</p>
            <p><strong>Status:</strong> ${escapeHtml(emp.status)}</p>
        </div>
    `;

    showModal('Employee Details', details);
}

/**
 * Edit employee - populate form with employee data
 * @param {string} id - Employee ID (string)
 */
function editEmployee(id) {
    const emp = employees.find(e => e.id === id);
    if (!emp) {
        console.error("Employee not found:", id);
        return;
    }

    const form = document.getElementById('employeeForm');
    if (!form) return;

    // Populate form fields - keep strings as strings
    form.name.value = emp.name || '';
    form.phone.value = emp.phone || '';
    form.role.value = emp.role || '';
    form.salary.value = emp.salary || '';
    form.deployedAt.value = emp.deployedAt || '';
    form.joinDate.value = emp.joinDate || '';
    form.nid.value = emp.nid || '';
    form.guardianName.value = emp.guardianName || '';
    form.guardianPhone.value = emp.guardianPhone || '';
    form.address.value = emp.address || '';
    form.status.value = emp.status || 'Active';

    document.getElementById('formTitle').textContent = 'Edit Employee';

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Delete employee
 * @param {string} id - Employee ID (string)
 */
async function deleteEmployee(id) {
    const emp = employees.find(e => e.id === id);
    const empName = emp ? emp.name : 'this employee';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(empName);
    } else {
        confirmed = confirm('Are you sure you want to delete this employee?');
    }
    
    if (!confirmed) return;

    try {
        const response = await request("deleteEmployee", { id: id });
        if (response.success) {
            await refreshEmployees();
            if (typeof showToast === 'function') {
                showToast('Employee deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete employee', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting employee:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting employee', 'error');
        }
    }
}

// ============================================
// MODAL UTILITY
// ============================================

/**
 * Show modal dialog
 * @param {string} title - Modal title
 * @param {string} content - Modal HTML content
 */
function showModal(title, content) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    if (modal && modalTitle && modalContent) {
        modalTitle.textContent = title;
        modalContent.innerHTML = content;
        modal.classList.remove('hidden');
    }
}

/**
 * Close modal dialog
 */
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    if (typeof renderUserInfo === 'function') renderUserInfo('userInfo');
    
    // Initialize form validation
    if (typeof initFormValidation === 'function') {
        initFormValidation('employeeForm');
    }
    
    // Initialize modal accessibility
    if (typeof initModalAccessibility === 'function') {
        initModalAccessibility('modal', closeModal);
    }
    
    // Initial load
    await refreshEmployees();
});
