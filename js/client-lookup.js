// ============================================
// CLIENT LOOKUP — Reusable Dropdown Population
// ============================================
// Shared component for populating <select> dropdowns with client names.
// Used by Employee Management, Guard Duty, Day Labor, Escort Duty forms.
// Fetches clients from the backend via existing getClients endpoint.
// NO permission logic — data comes from existing getClients action.
// Modeled after employee-lookup.js pattern.

/**
 * Cached client list for dropdown (fetched once per page load)
 * @type {Array}
 */
let _lookupClients = [];
let _lookupClientsLoaded = false;

/**
 * Fetch clients for dropdown (cached per page load)
 * Reuses the existing 'getClients' backend action.
 * @returns {Promise<Array>} Array of client objects
 */
async function fetchLookupClients() {
    if (_lookupClientsLoaded && _lookupClients.length > 0) {
        return _lookupClients;
    }

    try {
        const response = await request('getClients', {});
        if (response.success && Array.isArray(response.data)) {
            _lookupClients = response.data;
        } else {
            _lookupClients = [];
        }
    } catch (error) {
        console.error('Failed to fetch clients for lookup:', error);
        _lookupClients = [];
    }
    _lookupClientsLoaded = true;
    return _lookupClients;
}

/**
 * Populate a <select> element with client names from the cached client list.
 *
 * @param {Object} options
 * @param {string} options.selectId       - ID of the <select> element to populate
 * @param {string} [options.hiddenIdField] - ID of a hidden input to auto-set with client ID on change (optional)
 * @param {boolean} [options.includeEmpty] - Whether to include an empty/default option (default: true)
 * @param {string} [options.emptyLabel]   - Label for the empty option (default: '-- Select Client --')
 */
async function populateClientDropdown(options) {
    const {
        selectId,
        hiddenIdField = '',
        includeEmpty = true,
        emptyLabel = '-- Select Client --'
    } = options;

    const select = document.getElementById(selectId);
    if (!select) return;

    // Fetch clients (uses cache if already loaded)
    const clients = await fetchLookupClients();

    // Build options HTML
    let optionsHtml = '';

    if (includeEmpty) {
        optionsHtml += `<option value="">${emptyLabel}</option>`;
    }

    // Sort clients alphabetically by name
    const sorted = [...clients]
        .filter(c => c.status === 'Active' || !c.status)
        .sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

    for (const client of sorted) {
        const name = client.name || '';
        const id = client.id || '';
        optionsHtml += `<option value="${escapeAttr(name)}" data-client-id="${escapeAttr(id)}">${escapeAttr(name)}</option>`;
    }

    select.innerHTML = optionsHtml;

    // If a hidden ID field is specified, sync it on change
    if (hiddenIdField) {
        const hiddenInput = document.getElementById(hiddenIdField);
        if (hiddenInput) {
            select.addEventListener('change', function () {
                const selectedOption = select.options[select.selectedIndex];
                hiddenInput.value = selectedOption ? (selectedOption.dataset.clientId || '') : '';
            });
        }
    }
}

/**
 * Escape string for use in HTML attributes
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Pre-load clients for dropdown on page load.
 * Call this in DOMContentLoaded after auth is verified.
 */
async function preloadClientLookup() {
    await fetchLookupClients();
}
