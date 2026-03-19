/**
 * SYU Campus - Main JavaScript
 * Handles navigation, interactions, and PWA features
 */

class SYUCampus {
    constructor() {
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupPWA();
        this.setupTheme();
        this.setupInteractions();
    }

    /**
     * Navigation Setup
     */
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const menuToggle = document.getElementById('menuToggle');
        const mobileNav = document.getElementById('mobileNav');

        // Mobile menu toggle
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                mobileNav.classList.toggle('active');
            });
        }

        // Navigation item click handling
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const isLink = item.hasAttribute('href') && item.getAttribute('href') !== '#';

                if (!isLink) {
                    e.preventDefault();
                }

                // Remove active class from all items
                navItems.forEach(nav => nav.classList.remove('active'));
                // Add active class to clicked item
                item.classList.add('active');

                // Close mobile menu if open
                if (mobileNav && mobileNav.classList.contains('active')) {
                    mobileNav.classList.remove('active');
                }
            });
        });

        // Set active navigation on page load
        this.setActiveNavigation();
    }

    /**
     * Set active navigation based on current page
     */
    setActiveNavigation() {
        const currentPath = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const href = item.getAttribute('href');
            const isActive =
                (currentPath.includes('index.html') || currentPath.endsWith('/')) && item.dataset.page === 'home' ||
                currentPath.includes('notices.html') && item.dataset.page === 'notices' ||
                currentPath.includes('menu.html') && item.dataset.page === 'menu' ||
                currentPath.includes('schedule.html') && item.dataset.page === 'schedule';

            if (isActive) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * PWA Setup
     */
    setupPWA() {
        // Install button (if needed)
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.showInstallPrompt(deferredPrompt);
        });

        window.addEventListener('appinstalled', () => {
            console.log('App installed successfully');
        });
    }

    /**
     * Show install prompt for PWA
     */
    showInstallPrompt(deferredPrompt) {
        // This can be customized to show a custom install button
        // For now, the browser handles it automatically
    }

    /**
     * Theme Setup (Light/Dark mode)
     */
    setupTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

        prefersDark.addEventListener('change', (e) => {
            this.applyTheme(e.matches ? 'dark' : 'light');
        });

        // Apply initial theme
        this.applyTheme(prefersDark.matches ? 'dark' : 'light');
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    /**
     * Setup Interactions
     */
    setupInteractions() {
        // Card ripple effect (optional enhancement)
        const cards = document.querySelectorAll('.card, .featured-item');

        cards.forEach(card => {
            card.addEventListener('mousedown', (e) => {
                // Ripple effect or other interactions
            });
        });

        // Smooth scroll for anchors
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });

        // Handle back button for mobile
        this.setupBackButton();
    }

    /**
     * Setup back button handling
     */
    setupBackButton() {
        window.addEventListener('popstate', () => {
            this.setActiveNavigation();
        });
    }

    /**
     * Utility: Fetch and cache data
     */
    async fetchWithCache(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            // Try to get from cache
            if ('caches' in window) {
                const cached = await caches.match(url);
                if (cached) {
                    return await cached.json();
                }
            }
            throw error;
        }
    }

    /**
     * Utility: Format date
     */
    formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('ko-KR', options);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SYUCampus();
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // App is hidden
        console.log('App hidden');
    } else {
        // App is visible - refresh data if needed
        console.log('App visible');
    }
});
