/**
 * Lightweight SPA Router
 * Handles client-side routing with history API
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.isNavigating = false;
    this.init();
  }

  /**
   * Initialize router
   */
  init() {
    // Define routes
    this.routes.set('/', 'partials/home.html');
    this.routes.set('/subjects', 'partials/subjects.html');
    this.routes.set('/dashboard', 'partials/dashboard.html');
    this.routes.set('/admin', 'partials/admin.html');
    this.routes.set('/quiz', 'partials/quiz.html');

    // Handle initial page load
    this.handleInitialLoad();

    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', (e) => {
      this.navigateToPath(window.location.pathname, false);
    });

    // Intercept navigation links
    this.setupLinkInterception();
  }

  /**
   * Handle initial page load
   */
  async handleInitialLoad() {
    const path = window.location.pathname;
    await this.navigateToPath(path, false);
  }

  /**
   * Setup link interception for SPA navigation
   */
  setupLinkInterception() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-nav]');
      if (!link) return;

      e.preventDefault();
      const href = link.getAttribute('href');
      if (href && href !== window.location.pathname) {
        this.navigateToPath(href, true);
      }
    });
  }

  /**
   * Navigate to a specific path
   * @param {string} path - The path to navigate to
   * @param {boolean} pushState - Whether to push to history
   */
  async navigateToPath(path, pushState = true) {
    if (this.isNavigating) return;
    this.isNavigating = true;

    try {
      // Show loading state
      this.showLoadingState();

      // Get the partial file for this route
      const partialFile = this.routes.get(path) || this.routes.get('/');
      
      // Load the partial content
      const content = await this.loadPartial(partialFile);
      
      // Update the main content
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.innerHTML = content;
      }

      // Update browser history
      if (pushState && path !== window.location.pathname) {
        history.pushState({ path }, '', path);
      }

      // Update current route
      this.currentRoute = path;

      // Update navigation active states
      this.updateNavigation(path);

      // Initialize page-specific functionality
      await this.initializePage(path);

      // Hide loading state
      this.hideLoadingState();

    } catch (error) {
      console.error('Navigation error:', error);
      this.showErrorState();
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * Load partial HTML content
   * @param {string} partialFile - Path to partial file
   * @returns {Promise<string>} - HTML content
   */
  async loadPartial(partialFile) {
    try {
      const response = await fetch(partialFile);
      if (!response.ok) {
        throw new Error(`Failed to load ${partialFile}: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Error loading partial:', error);
      return '<div class="error-state"><h2>Page not found</h2><p>The requested page could not be loaded.</p></div>';
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    document.body.classList.add('page-loading');
    
    // Show loading bar
    let loadingBar = document.getElementById('loading-bar');
    if (!loadingBar) {
      loadingBar = document.createElement('div');
      loadingBar.id = 'loading-bar';
      loadingBar.className = 'loading-bar';
      document.body.appendChild(loadingBar);
    }
    loadingBar.style.width = '70%';
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    document.body.classList.remove('page-loading');
    
    const loadingBar = document.getElementById('loading-bar');
    if (loadingBar) {
      loadingBar.style.width = '100%';
      setTimeout(() => {
        loadingBar.style.opacity = '0';
        setTimeout(() => {
          loadingBar.style.width = '0%';
          loadingBar.style.opacity = '1';
        }, 200);
      }, 100);
    }
  }

  /**
   * Show error state
   */
  showErrorState() {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.innerHTML = `
        <div class="error-state" style="text-align: center; padding: 4rem 2rem;">
          <h2>Something went wrong</h2>
          <p>Please try refreshing the page or go back to the <a href="/" data-nav>home page</a>.</p>
        </div>
      `;
    }
    this.hideLoadingState();
  }

  /**
   * Update navigation active states
   * @param {string} path - Current path
   */
  updateNavigation(path) {
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Add active class to current nav link
    const currentLink = document.querySelector(`.nav-link[href="${path}"]`);
    if (currentLink) {
      currentLink.classList.add('active');
    }

    // Update page title
    this.updatePageTitle(path);
  }

  /**
   * Update page title based on route
   * @param {string} path - Current path
   */
  updatePageTitle(path) {
    const titles = {
      '/': 'StudySphere - URT Exam Preparation',
      '/subjects': 'Subjects - StudySphere',
      '/dashboard': 'Dashboard - StudySphere',
      '/admin': 'Admin Dashboard - StudySphere',
      '/quiz': 'Quiz - StudySphere'
    };

    document.title = titles[path] || 'StudySphere';
  }

  /**
   * Initialize page-specific functionality
   * @param {string} path - Current path
   */
  async initializePage(path) {
    // Wait for auth to be ready before initializing pages
    if (window.authManager) {
      await window.authManager.ready();
    }

    // Initialize page-specific modules
    switch (path) {
      case '/':
        await this.initHomePage();
        break;
      case '/subjects':
        await this.initSubjectsPage();
        break;
      case '/dashboard':
        await this.initDashboardPage();
        break;
      case '/admin':
        await this.initAdminPage();
        break;
      case '/quiz':
        await this.initQuizPage();
        break;
    }
  }

  /**
   * Initialize home page
   */
  async initHomePage() {
    // Add smooth scrolling for hero buttons
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
      scrollIndicator.addEventListener('click', () => {
        document.getElementById('features')?.scrollIntoView({
          behavior: 'smooth'
        });
      });
    }
  }

  /**
   * Initialize subjects page
   */
  async initSubjectsPage() {
    try {
      // Dynamically import subjects functionality
      const { initSubjectsPage } = await import('./subjects.js');
      await initSubjectsPage();
    } catch (error) {
      console.error('Error initializing subjects page:', error);
    }
  }

  /**
   * Initialize dashboard page
   */
  async initDashboardPage() {
    // Check authentication
    if (!window.authManager?.isAuthenticated()) {
      window.authManager?.showAuthModal();
      return;
    }

    try {
      // Dynamically import Chart.js and dashboard functionality
      const [chartModule, dashboardModule] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/chart.js'),
        import('./dashboard.js')
      ]);
      
      window.Chart = chartModule.default;
      await dashboardModule.initDashboardPage();
    } catch (error) {
      console.error('Error initializing dashboard page:', error);
    }
  }

  /**
   * Initialize admin page
   */
  async initAdminPage() {
    // Check admin access
    if (!window.authManager?.isAdmin()) {
      this.navigateToPath('/dashboard', true);
      return;
    }

    try {
      // Dynamically import admin functionality
      const { initAdminPage } = await import('./admin.js');
      await initAdminPage();
    } catch (error) {
      console.error('Error initializing admin page:', error);
    }
  }

  /**
   * Initialize quiz page
   */
  async initQuizPage() {
    try {
      // Dynamically import quiz functionality
      const { initQuizPage } = await import('./quiz.js');
      await initQuizPage();
    } catch (error) {
      console.error('Error initializing quiz page:', error);
    }
  }

  /**
   * Navigate to a specific route
   * @param {string} path - Path to navigate to
   */
  navigate(path) {
    this.navigateToPath(path, true);
  }

  /**
   * Get current route
   * @returns {string} - Current route path
   */
  getCurrentRoute() {
    return this.currentRoute;
  }
}

// Create global router instance
export const router = new Router();

// Make router globally available
window.router = router;