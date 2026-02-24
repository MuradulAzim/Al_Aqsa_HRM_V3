// ============================================
// CLIENT LOOKUP — Reusable Dropdown Population
// ============================================
// Shared component for populating <select> dropdowns with client names.
// Used by Employee Management, Guard Duty, Day Labor, Escort Duty forms.
// Fetches clients from the backend via existing getClients endpoint.
// NO permission logic — data comes from existing getClients action.
// Canonical client name field: companyName (matches Google Sheet header).

/**
 * Debug flag — set to true in browser console to enable logging:
 *   _CLIENT_LOOKUP_DEBUG = true;
 */
var _CLIENT_LOOKUP_DEBUG = false;

function _clDebug() {
    if (_CLIENT_LOOKUP_DEBUG) {
        console.log('[client-lookup]', ...arguments);
    }
}

/**
 * Cached client list for dropdown (fetched once per page load)
 * @type {Array}
 */
let _lookupClients = [];
let _lookupClientsLoaded = false;

/**
 * Get the display name for a client object.
 * Prefers companyName, falls back to name.
 * @param {Object} client
 * @returns {string}
 */
function getClientDisplayName(client) {
    if (!client) return '';
    return (client.companyName || client.name || '').toString().trim();
}

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
        _clDebug('Fetching clients from backend...');
        const response = await request('getClients', {});
        if (response.success && Array.isArray(response.data)) {
            _lookupClients = response.data;
            _clDebug('Fetched', _lookupClients.length, 'clients');
            if (_lookupClients.length > 0) {
                _clDebug('Sample client:', JSON.stringify(_lookupClients[0]));
            }
        } else {
            _lookupClients = [];
            console.warn('[client-lookup] getClients returned unexpected shape:', response);
        }
    } catch (error) {
        console.error('[client-lookup] Failed to fetch clients:', error);
        _lookupClients = [];
        if (typeof showToast === 'function') {
            showToast('Failed to load client list — check permissions or network', 'error');
        }
    }
    _lookupClientsLoaded = true;

    if (_lookupClients.length === 0) {
        console.warn('[client-lookup] No clients available after fetch');
        if (typeof showToast === 'function') {
            showToast('No clients available (check permissions or client list)', 'warning');
        }
    }

    return _lookupClients;
}

/**
 * Check if a client should be treated as active (case-insensitive).
 * Active if status is missing, empty, or anything other than 'inactive'.
 * @param {Object} client
 * @returns {boolean}
 */
function _isClientActive(client) {
    const status = (client.status || '').toString().trim().toLowerCase();
    return status !== 'inactive';
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
        .filter(c => _isClientActive(c))
        .sort((a, b) => {
            const nameA = getClientDisplayName(a).toLowerCase();
            const nameB = getClientDisplayName(b).toLowerCase();
            return nameA.localeCompare(nameB);
        });

    for (const client of sorted) {
        const name = getClientDisplayName(client);
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

// ============================================
// CLIENT LOOKUP — Reusable Type-Ahead
// ============================================
// Same UX pattern as employee-lookup.js.
// User types client name, sees suggestions, selects one.
// Sets both visible name input and hidden ID input.
// Dropdown is appended to document.body to avoid overflow clipping inside modals.

/**
 * Initialize a client lookup (type-ahead) on a text input field.
 *
 * When the user types, a dropdown shows matching clients.
 * Selecting a client sets both the name and ID fields.
 *
 * @param {Object} options
 * @param {string} options.inputId       - ID of the text input for client name
 * @param {string} options.hiddenIdField - ID of the hidden input for client ID
 */
function initClientLookup(options) {
    const { inputId, hiddenIdField } = options;

    const input = document.getElementById(inputId);
    const hiddenInput = document.getElementById(hiddenIdField);
    if (!input) {
        console.error('[client-lookup] initClientLookup: input #' + inputId + ' not found');
        return;
    }
    _clDebug('initClientLookup() running for #' + inputId);

    // Create dropdown container — append to body to avoid modal overflow clipping
    const dropdown = document.createElement('div');
    dropdown.id = inputId + '_client_lookup_dropdown';
    dropdown.className = 'client-lookup-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.cssText = 'display:none; position:fixed; max-height:200px; overflow-y:auto; background:#fff; border:1px solid #d1d5db; border-radius:0 0 0.5rem 0.5rem; z-index:9999; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);';
    document.body.appendChild(dropdown);

    // Track selection state
    let selectedClient = null;

    // Update aria attributes
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');

    /**
     * Position the dropdown below the input using getBoundingClientRect.
     */
    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = rect.bottom + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
    }

    /**
     * Show the dropdown (with correct position).
     */
    function showDropdown() {
        positionDropdown();
        dropdown.style.display = 'block';
        input.setAttribute('aria-expanded', 'true');
    }

    /**
     * Hide the dropdown.
     */
    function hideDropdown() {
        dropdown.style.display = 'none';
        input.setAttribute('aria-expanded', 'false');
    }

    /**
     * Filter active clients by search term
     * @param {Array} clients
     * @param {string} term
     * @returns {Array}
     */
    function filterClients(clients, term) {
        return clients
            .filter(c => _isClientActive(c))
            .filter(c => {
                const name = getClientDisplayName(c).toLowerCase();
                const id = (c.id || '').toString().toLowerCase();
                return name.includes(term) || id.includes(term);
            })
            .sort((a, b) => {
                const nameA = getClientDisplayName(a).toLowerCase();
                const nameB = getClientDisplayName(b).toLowerCase();
                return nameA.localeCompare(nameB);
            })
            .slice(0, 10);
    }

    // Input event — type-ahead search
    input.addEventListener('input', async function () {
        selectedClient = null;
        if (hiddenInput) hiddenInput.value = '';

        const term = input.value.trim().toLowerCase();
        if (term.length < 1) {
            hideDropdown();
            return;
        }

        const clients = await fetchLookupClients();
        const matches = filterClients(clients, term);

        _clDebug('Query "' + term + '" → ' + matches.length + ' matches (of ' + clients.length + ' total)');

        if (matches.length === 0) {
            dropdown.innerHTML = '<div role="option" style="padding:8px 12px; color:#9ca3af; font-size:0.875rem;">No clients found</div>';
            showDropdown();
            return;
        }

        dropdown.innerHTML = matches.map((client, idx) => {
            const displayName = getClientDisplayName(client);
            const displayId = client.id || '';
            return `<div class="client-lookup-item" role="option" data-index="${idx}"
                style="padding:8px 12px; cursor:pointer; font-size:0.875rem; border-bottom:1px solid #f3f4f6;"
                onmouseenter="this.style.backgroundColor='#eff6ff'"
                onmouseleave="this.style.backgroundColor='#fff'">
                <div style="font-weight:500; color:#1f2937;">${escapeAttr(displayName)}</div>
                <div style="font-size:0.75rem; color:#6b7280;">ID: ${escapeAttr(displayId)}</div>
            </div>`;
        }).join('');

        // Attach click handlers
        dropdown.querySelectorAll('.client-lookup-item').forEach((item, idx) => {
            item.addEventListener('mousedown', function (e) {
                e.preventDefault(); // Prevent blur before click fires
                selectClient(matches[idx]);
            });
        });

        showDropdown();
    });

    // Select client helper
    function selectClient(client) {
        selectedClient = client;
        input.value = getClientDisplayName(client);
        if (hiddenInput) {
            hiddenInput.value = client.id || '';
        }
        _clDebug('Selected client:', client.id, getClientDisplayName(client));
        hideDropdown();
    }

    // Close dropdown on blur
    input.addEventListener('blur', function () {
        setTimeout(function () {
            hideDropdown();
            // If user typed but didn't select, try exact match or clear
            if (!selectedClient && input.value.trim()) {
                const term = input.value.trim().toLowerCase();
                const exactMatch = _lookupClients
                    .filter(c => _isClientActive(c))
                    .find(c =>
                        getClientDisplayName(c).toLowerCase() === term ||
                        (c.id || '').toString().toLowerCase() === term
                    );
                if (exactMatch) {
                    selectClient(exactMatch);
                } else {
                    // Clear invalid input
                    input.value = '';
                    if (hiddenInput) hiddenInput.value = '';
                    if (typeof showToast === 'function') {
                        showToast('Please select a client from the list', 'warning');
                    }
                }
            }
        }, 200);
    });

    // Reposition on scroll/resize (since dropdown is fixed position on body)
    function onScrollOrResize() {
        if (dropdown.style.display !== 'none') {
            positionDropdown();
        }
    }
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    // Keyboard navigation
    input.addEventListener('keydown', function (e) {
        const items = dropdown.querySelectorAll('.client-lookup-item');
        if (items.length === 0) return;

        let activeIndex = -1;
        items.forEach((item, idx) => {
            if (item.style.backgroundColor === 'rgb(239, 246, 255)') activeIndex = idx;
        });

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
            items.forEach(item => item.style.backgroundColor = '#fff');
            items[nextIndex].style.backgroundColor = '#eff6ff';
            items[nextIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
            items.forEach(item => item.style.backgroundColor = '#fff');
            items[prevIndex].style.backgroundColor = '#eff6ff';
            items[prevIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0) {
                items[activeIndex].dispatchEvent(new Event('mousedown'));
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });

    _clDebug('initClientLookup() complete for #' + inputId);
}

/**
 * Pre-load clients for lookup/dropdown on page load.
 * Call this in DOMContentLoaded after auth is verified.
 */
async function preloadClientLookup() {
    await fetchLookupClients();
}
