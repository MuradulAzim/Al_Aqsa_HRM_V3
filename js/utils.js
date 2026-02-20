// Utility helpers only
// No business logic

/**
 * Returns today's date in ISO format (YYYY-MM-DD)
 * Uses locale-independent date components
 * @returns {string} Date in YYYY-MM-DD format
 */
function getTodayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
