/**
 * Subjects Page Module
 * Handles subject listing and passage loading with pagination
 */

import { getPublishedPassagesBySubject, getPassage } from './passages.js';
import { saveAttempt } from './attempts.js';
import { showToast, formatDuration } from './ui.js';

let currentPage = 1;
let lastDoc = null;
let isLoading = false;

/**
 * Initialize subjects page
 */
export async function initSubjectsPage() {
    try {
        await loadSubjectStats();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing subjects page:', error);
        showToast('Failed to load subjects', 'error');
    }
}

/**
 * Load passage statistics for each subject with pagination
 */
async function loadSubjectStats() {
    const subjects = [
        { name: 'Biology', icon: '🧬', description: 'Cell biology, genetics, ecology, and more' },
        { name: 'Physics', icon: '⚛️', description: 'Mechanics, thermodynamics, waves, and modern physics' },
        { name: 'Chemistry', icon: '⚗️', description: 'Organic, inorganic, and physical chemistry' },
        { name: 'Geology', icon: '🌍', description: 'Earth science, minerals, and geological processes' },
        { name: 'English', icon: '📖', description: 'Grammar, comprehension, and writing skills' }
    ];

    const container = document.getElementById('subjects-grid');
    if (!container) return;

    // Clear skeleton loading
    container.innerHTML = '';

    for (const subject of subjects) {
        try {
            // Use optimized query with pagination
            const passages = await getSubjectPassagesOptimized(subject.name);
            const count = passages.length;
            
            const subjectCard = createSubjectCard(subject, count);
            container.appendChild(subjectCard);
            
        } catch (error) {
            console.error(`Error loading ${subject.name} stats:`, error);
            const subjectCard = createSubjectCard(subject, 0, true);
            container.appendChild(subjectCard);
        }
    }
}

/**
 * Get subject passages with optimized Firestore query
 * @param {string} subject - Subject name
 * @returns {Promise<Array>} - Array of passages
 */
async function getSubjectPassagesOptimized(subject) {
    try {
        // Import Firestore functions
        const { db } = await import('./firebase.js');
        const { 
            collection, 
            query, 
            where, 
            orderBy, 
            limit, 
            getDocs 
        } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        // Optimized query with proper indexing
        const q = query(
            collection(db, 'passages'),
            where('subject', '==', subject),
            where('isPublished', '==', true),
            orderBy('createdAt', 'desc'),
            limit(12) // Pagination limit
        );

        const querySnapshot = await getDocs(q);
        const passages = [];
        
        querySnapshot.forEach((doc) => {
            passages.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return passages;
    } catch (error) {
        console.error('Firestore query error:', error);
        
        // If this error occurs, you need to create a composite index
        if (error.code === 'failed-precondition') {
            console.warn(`
                🔥 Firestore Index Required!
                
                Create this composite index in Firebase Console:
                Collection: passages
                Fields: subject (Ascending), isPublished (Ascending), createdAt (Descending)
                
                Or use this direct link:
                https://console.firebase.google.com/project/${error.projectId}/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9zdHVkeXNwaGVyZS1kZXYvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3Bhc3NhZ2VzL2luZGV4ZXMvXxABGgoKBnN1YmplY3QQARoOCgppc1B1Ymxpc2hlZBABGg0KCWNyZWF0ZWRBdBAC
            `);
        }
        
        throw error;
    }
}

/**
 * Create subject card element
 * @param {Object} subject - Subject data
 * @param {number} count - Number of passages
 * @param {boolean} hasError - Whether there was an error loading
 * @returns {HTMLElement} - Subject card element
 */
function createSubjectCard(subject, count, hasError = false) {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.dataset.subject = subject.name.toLowerCase();
    
    const iconClass = `${subject.name.toLowerCase()}-icon`;
    const statusText = hasError ? 'Error loading' : 
                     count === 0 ? 'No passages yet' : 
                     `${count} passage${count !== 1 ? 's' : ''}`;
    
    card.innerHTML = `
        <div class="subject-icon ${iconClass}">${subject.icon}</div>
        <h3 class="subject-title">${subject.name}</h3>
        <p class="subject-description">${subject.description}</p>
        <div class="subject-stats">
            <span class="stat">${statusText}</span>
        </div>
        <div class="subject-categories">
            ${count > 0 ? '<span class="category-tag">Available</span>' : 
              '<span class="category-tag" style="opacity: 0.5;">Coming Soon</span>'}
        </div>
        <button class="btn btn-primary subject-btn" 
                onclick="viewSubject('${subject.name}')" 
                ${count === 0 ? 'disabled' : ''}>
            View All
        </button>
    `;
    
    // Add hover animation
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-8px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
    
    return card;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Close modals when clicking outside
    const subjectModal = document.getElementById('subject-modal');
    if (subjectModal) {
        subjectModal.addEventListener('click', (e) => {
            if (e.target === subjectModal) {
                closeSubjectModal();
            }
        });
    }

    const quizModal = document.getElementById('quiz-modal');
    if (quizModal) {
        quizModal.addEventListener('click', (e) => {
            if (e.target === quizModal) {
                closeQuizModal();
            }
        });
    }
}

/**
 * View subject passages with pagination
 * @param {string} subject - Subject name
 */
window.viewSubject = async function(subject) {
    if (isLoading) return;
    isLoading = true;
    
    try {
        // Reset pagination
        currentPage = 1;
        lastDoc = null;
        
        // Show loading in modal
        document.getElementById('subject-modal-title').textContent = `${subject} Passages`;
        const container = document.getElementById('subject-passages-container');
        container.innerHTML = createPassageSkeletons();
        
        document.getElementById('subject-modal').classList.add('show');
        
        // Load passages with pagination
        const passages = await loadSubjectPassages(subject);
        renderSubjectPassages(passages, container);
        
    } catch (error) {
        console.error('Error loading subject passages:', error);
        showToast('Failed to load passages', 'error');
        
        const container = document.getElementById('subject-passages-container');
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">⚠️</div>
                <h3>Failed to load passages</h3>
                <p>Please try again later.</p>
                <button class="btn btn-primary" onclick="viewSubject('${subject}')">Retry</button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
};

/**
 * Load subject passages with optimized pagination
 * @param {string} subject - Subject name
 * @returns {Promise<Array>} - Array of passages
 */
async function loadSubjectPassages(subject) {
    return await getSubjectPassagesOptimized(subject);
}

/**
 * Create passage loading skeletons
 * @returns {string} - HTML for skeleton cards
 */
function createPassageSkeletons() {
    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
            ${Array(6).fill().map(() => `
                <div class="passage-card skeleton-card">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-meta"></div>
                    <div class="skeleton-description"></div>
                    <div class="skeleton-actions"></div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render subject passages
 * @param {Array} passages - Array of passages
 * @param {HTMLElement} container - Container element
 */
function renderSubjectPassages(passages, container) {
    if (passages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">📄</div>
                <h3>No passages available</h3>
                <p>Check back later for new passages.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
            ${passages.map(passage => `
                <div class="passage-card" style="background: white; border-radius: 12px; padding: 1.5rem; border: 1px solid #e2e8f0; transition: all 0.3s ease;">
                    <h4 style="margin-bottom: 0.5rem; color: #1e293b;">${passage.title}</h4>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
                        <span class="difficulty-badge ${passage.difficulty.toLowerCase()}">${passage.difficulty}</span>
                        <span class="time-badge">${passage.timeLimit || 10} min</span>
                    </div>
                    <p style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.9rem; line-height: 1.4;">
                        ${(passage.content || passage.text || '').substring(0, 150)}...
                    </p>
                    <div style="display: flex; gap: 0.75rem;">
                        <button class="btn btn-outline btn-sm" onclick="previewPassage('${passage.id}')">Preview</button>
                        <button class="btn btn-primary btn-sm" onclick="startQuiz('${passage.id}')">Start Quiz</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Close subject modal
 */
window.closeSubjectModal = function() {
    document.getElementById('subject-modal').classList.remove('show');
};

/**
 * Preview passage
 * @param {string} passageId - Passage ID
 */
window.previewPassage = async function(passageId) {
    try {
        const passage = await getPassage(passageId);
        if (!passage) {
            showToast('Passage not found', 'error');
            return;
        }

        let modal = document.getElementById('passage-preview-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'passage-preview-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; max-height: 90vh;">
                    <div class="modal-header">
                        <h3 id="preview-modal-title"></h3>
                        <button class="modal-close" onclick="closePreviewModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <div id="preview-modal-details" style="margin-bottom: 1rem;"></div>
                        <div id="preview-modal-text"></div>
                    </div>
                </div>
            `;
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closePreviewModal();
                }
            });
            document.body.appendChild(modal);
        }

        const text = passage.text || passage.content || '';
        document.getElementById('preview-modal-title').textContent = passage.title || '';
        
        const validDiffs = ['easy','medium','hard'];
        const diff = validDiffs.includes((passage.difficulty || '').toLowerCase()) ? passage.difficulty : 'Unknown';
        document.getElementById('preview-modal-details').innerHTML = `
            <span class="difficulty-badge ${diff.toLowerCase()}">${diff}</span>
        `;
        document.getElementById('preview-modal-text').textContent = text;

        modal.classList.add('show');
    } catch (error) {
        console.error('Error previewing passage:', error);
        showToast('Failed to load passage', 'error');
    }
};

/**
 * Close preview modal
 */
window.closePreviewModal = function() {
    const modal = document.getElementById('passage-preview-modal');
    if (modal) {
        modal.classList.remove('show');
    }
};

/**
 * Start quiz
 * @param {string} passageId - Passage ID
 */
window.startQuiz = async function(passageId) {
    try {
        const passage = await getPassage(passageId);
        if (!passage) {
            showToast('Passage not found', 'error');
            return;
        }

        // Cache passage data for quiz page
        const cachedKey = 'studysphere.passages.v1';
        const passages = JSON.parse(localStorage.getItem(cachedKey) || '[]');
        const normalized = { ...passage, text: passage.text || passage.content || '' };
        const index = passages.findIndex(p => p.id === passageId);
        if (index >= 0) {
            passages[index] = normalized;
        } else {
            passages.push(normalized);
        }
        localStorage.setItem(cachedKey, JSON.stringify(passages));

        // Navigate to quiz using router
        window.router.navigate(`/quiz?passage=${passageId}`);
    } catch (error) {
        console.error('Error starting quiz:', error);
        showToast('Failed to start quiz', 'error');
    }
};

/**
 * Close quiz modal
 */
window.closeQuizModal = function() {
    document.getElementById('quiz-modal').classList.remove('show');
};