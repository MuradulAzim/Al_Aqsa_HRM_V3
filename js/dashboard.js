// Dashboard refresh contract
// Manual refresh only - NO automatic updates
// READ-ONLY - Dashboard must NEVER modify module data

/**
 * Refresh the dashboard - MUST be called explicitly
 * Dashboard NEVER auto-updates
 * This is the ONLY entry point for dashboard data updates
 * @param {string} reason - The reason for the refresh request
 */
async function refreshDashboard(reason) {
    // Log refresh request to console
    console.log("Dashboard refresh requested. Reason: " + reason);
    
    // Update UI with last refresh reason
    const refreshReasonElement = document.getElementById('lastRefreshReason');
    if (refreshReasonElement) {
        refreshReasonElement.textContent = "Last refresh reason: " + reason;
    }

    // Fetch dashboard stats (READ-ONLY)
    try {
        const response = await request("getDashboardStats", {});
        if (response.success && response.data) {
            renderDashboardStats(response.data);
        } else {
            console.error("Failed to fetch dashboard stats:", response.message);
        }
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
    }
}

/**
 * Render dashboard statistics
 * @param {object} stats - Stats object from API
 */
function renderDashboardStats(stats) {
    // Employee stats
    setStatValue('statTotalEmployees', stats.employees?.total || 0);
    setStatValue('statActiveEmployees', stats.employees?.active || 0);
    
    // Guard duty stats
    setStatValue('statGuardDutyToday', stats.guardDuty?.todayTotal || 0);
    setStatValue('statDayShift', stats.guardDuty?.todayDayShift || 0);
    setStatValue('statNightShift', stats.guardDuty?.todayNightShift || 0);
    setStatValue('statPresent', stats.guardDuty?.present || 0);
    setStatValue('statAbsent', stats.guardDuty?.absent || 0);
    setStatValue('statLate', stats.guardDuty?.late || 0);
}

/**
 * Set stat card value
 * @param {string} elementId - Element ID
 * @param {number} value - Stat value
 */
function setStatValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}
