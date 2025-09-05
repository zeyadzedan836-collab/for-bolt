/**
 * Dashboard Page Module
 * Handles dashboard initialization and chart rendering
 */

import { getAttemptsForUser, getUserStats } from './attempts.js';
import { getPassages } from './passages.js';
import { 
    createScoreTrendChart, 
    createSubjectPerformanceChart, 
    createAttemptDistributionChart,
    updateChartData,
    destroyChart
} from './charts.js';
import { showToast, formatDate, formatDuration, debounce, showEmptyState } from './ui.js';

let currentAttempts = [];
let currentStats = null;
let scoreTrendChart = null;
let subjectChart = null;
let distributionChart = null;

/**
 * Initialize dashboard page
 */
export async function initDashboardPage() {
    try {
        // Show loading skeletons while data loads
        showLoadingState();
        
        await Promise.all([
            loadUserStats(),
            loadRecentAttempts(),
            updateProfileInfo()
        ]);
        
        await renderCharts();
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
        hideLoadingState();
    }
}

/**
 * Show loading state with skeletons
 */
function showLoadingState() {
    // Stats overview already has skeleton cards in HTML
    
    // Profile info
    document.getElementById('profile-name').textContent = 'Loading...';
    document.getElementById('profile-email').textContent = 'Loading...';
    document.getElementById('attempts-count').textContent = 'Loading...';
}

/**
 * Hide loading state and show actual content
 */
function hideLoadingState() {
    // Remove skeleton classes
    document.querySelectorAll('.skeleton-card').forEach(card => {
        card.classList.remove('skeleton-card');
    });
}

/**
 * Load user statistics with optimized queries
 */
async function loadUserStats() {
    try {
        currentStats = await getUserStats();
        
        // Update overview stats
        const statsOverview = document.getElementById('stats-overview');
        if (statsOverview) {
            statsOverview.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <span class="stat-number">${currentStats.totalAttempts}</span>
                    <span class="stat-label">Total Attempts</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <span class="stat-number">${currentStats.averageScore}%</span>
                    <span class="stat-label">Average Score</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⏱️</div>
                    <span class="stat-number">${currentStats.totalTimeMinutes}m</span>
                    <span class="stat-label">Study Time</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-number">${currentStats.bestScore}%</span>
                    <span class="stat-label">Best Score</span>
                </div>
            `;
        }
        
        // Update sidebar quick stats
        document.getElementById('recent-score').textContent = currentStats.recentScore + '%';
        
        // Calculate this week's attempts
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weekAttempts = currentStats.scoreHistory.filter(
            attempt => new Date(attempt.attemptedAt) > oneWeekAgo
        ).length;
        document.getElementById('week-attempts').textContent = weekAttempts + ' attempts';
        
        // Find favorite subject
        const favoriteSubject = Object.entries(currentStats.subjectStats)
            .filter(([_, stats]) => stats.attempts > 0)
            .sort((a, b) => b[1].attempts - a[1].attempts)[0];
        document.getElementById('favorite-subject').textContent = 
            favoriteSubject ? favoriteSubject[0] : '-';
        
    } catch (error) {
        console.error('Error loading user stats:', error);
        showToast('Failed to load statistics', 'error');
    }
}

/**
 * Load recent attempts with pagination
 */
async function loadRecentAttempts() {
    try {
        // Use optimized query with limit
        currentAttempts = await getAttemptsForUser({ limitCount: 20 });
        renderAttemptsTable();
        setupFilters();
    } catch (error) {
        console.error('Error loading attempts:', error);
        showToast('Failed to load quiz history', 'error');
    }
}

/**
 * Update profile information
 */
function updateProfileInfo() {
    if (window.authManager?.currentUser) {
        const user = window.authManager.currentUser;
        document.getElementById('profile-name').textContent = 
            user.displayName || user.email.split('@')[0];
        document.getElementById('profile-email').textContent = user.email;
        document.getElementById('profile-avatar').textContent = 
            (user.displayName || user.email).charAt(0).toUpperCase();
    }
}

/**
 * Render attempts table with pagination support
 */
function renderAttemptsTable() {
    const tbody = document.getElementById('attempts-tbody');
    const attemptsCount = document.getElementById('attempts-count');
    
    if (!tbody || !attemptsCount) return;
    
    attemptsCount.textContent = 
        `${currentAttempts.length} attempt${currentAttempts.length !== 1 ? 's' : ''}`;
    
    if (currentAttempts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="empty-icon">📊</div>
                    <p>No quiz attempts yet</p>
                    <a href="/subjects" class="btn btn-primary btn-sm" data-nav>Start Your First Quiz</a>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = currentAttempts.slice(0, 10).map(attempt => {
        const scoreClass = attempt.score >= 80 ? 'score-excellent' : 
                         attempt.score >= 60 ? 'score-good' : 'score-needs-improvement';
        
        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">Passage ${attempt.passageId.substring(0, 8)}...</div>
                </td>
                <td>${attempt.subject}</td>
                <td>
                    <span class="score-badge ${scoreClass}">${attempt.score}%</span>
                </td>
                <td>${formatDuration(attempt.timeTakenSec)}</td>
                <td>${formatDate(attempt.attemptedAt)}</td>
                <td>
                    <button class="btn btn-outline btn-xs" onclick="retakeQuiz('${attempt.passageId}')">
                        Retake
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Setup filter functionality
 */
function setupFilters() {
    const attemptsSubjectFilter = document.getElementById('attempts-subject-filter');
    const attemptsDateFilter = document.getElementById('attempts-date-filter');
    const trendSubjectFilter = document.getElementById('trend-subject-filter');

    if (attemptsSubjectFilter) {
        attemptsSubjectFilter.addEventListener('change', filterAttempts);
    }
    if (attemptsDateFilter) {
        attemptsDateFilter.addEventListener('change', filterAttempts);
    }
    if (trendSubjectFilter) {
        trendSubjectFilter.addEventListener('change', updateTrendChart);
    }
}

/**
 * Filter attempts based on selected criteria
 */
function filterAttempts() {
    const subjectFilter = document.getElementById('attempts-subject-filter')?.value;
    const dateFilter = document.getElementById('attempts-date-filter')?.value;

    let filtered = [...currentAttempts];

    if (subjectFilter) {
        filtered = filtered.filter(attempt => attempt.subject === subjectFilter);
    }

    if (dateFilter) {
        const filterDate = new Date(dateFilter);
        filtered = filtered.filter(attempt => {
            const attemptDate = new Date(attempt.attemptedAt);
            return attemptDate.toDateString() === filterDate.toDateString();
        });
    }

    // Temporarily replace currentAttempts for rendering
    const originalAttempts = currentAttempts;
    currentAttempts = filtered;
    renderAttemptsTable();
    currentAttempts = originalAttempts;
}

/**
 * Update trend chart based on subject filter
 */
function updateTrendChart() {
    if (!scoreTrendChart || !currentStats) return;

    const subjectFilter = document.getElementById('trend-subject-filter')?.value;
    let trendData = currentStats.scoreHistory;

    if (subjectFilter) {
        trendData = trendData.filter(attempt => attempt.subject === subjectFilter);
    }

    const chartData = trendData.map(attempt => ({
        date: new Date(attempt.attemptedAt),
        score: attempt.score
    }));

    // Update chart
    scoreTrendChart.data.labels = chartData.map(item => item.date.toLocaleDateString());
    scoreTrendChart.data.datasets[0].data = chartData.map(item => item.score);
    scoreTrendChart.update();
}

/**
 * Render all charts
 */
async function renderCharts() {
    if (!currentStats) return;

    try {
        // Score trend chart
        const trendCanvas = document.getElementById('score-trend-chart');
        if (trendCanvas && currentStats.scoreHistory.length > 0) {
            if (scoreTrendChart) destroyChart(scoreTrendChart);
            
            const trendData = currentStats.scoreHistory.map(attempt => ({
                date: new Date(attempt.attemptedAt),
                score: attempt.score
            }));
            
            scoreTrendChart = createScoreTrendChart(trendCanvas, trendData);
        }

        // Subject performance chart
        const subjectCanvas = document.getElementById('subject-performance-chart');
        if (subjectCanvas) {
            if (subjectChart) destroyChart(subjectChart);
            subjectChart = createSubjectPerformanceChart(subjectCanvas, currentStats.subjectStats);
        }

        // Activity distribution chart
        const distributionCanvas = document.getElementById('activity-distribution-chart');
        if (distributionCanvas) {
            if (distributionChart) destroyChart(distributionChart);
            distributionChart = createAttemptDistributionChart(distributionCanvas, currentStats.subjectStats);
        }
    } catch (error) {
        console.error('Error rendering charts:', error);
        showToast('Failed to load charts', 'error');
    }
}

/**
 * Retake quiz function
 * @param {string} passageId - Passage ID to retake
 */
window.retakeQuiz = async function(passageId) {
    try {
        const passages = await getPassages({ publishedOnly: true });
        const passage = passages.find(p => p.id === passageId);
        
        if (passage) {
            window.router.navigate(`/quiz?passage=${passageId}`);
        } else {
            showToast('Passage not found or no longer available', 'error');
        }
    } catch (error) {
        console.error('Error finding passage:', error);
        showToast('Failed to load passage', 'error');
    }
};