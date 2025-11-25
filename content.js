// Content script for Hyper Launcher v3.2 - DEPRECATED
//
// SECURITY NOTICE: This file is no longer injected into web pages.
// Content script injection was removed in v3.2 to improve:
// - User privacy (no injection on banking/sensitive sites)
// - Chrome Store compliance (<all_urls> permission removed)
// - Security posture (reduced attack surface)
//
// All functionality is now available via:
// - Manifest keyboard commands (Ctrl+Shift+L, etc.)
// - Browser action popup
// - Context menus
// - Background service worker
//
// This file is kept for reference only and can be safely deleted.
//
// Original: Content script for Hyper Launcher v3.0 - Enhanced Page Integration

class HyperLauncherContent {
    constructor() {
        this.isInitialized = false;
        this.notifications = new Map();
        this.shortcuts = new Map();
        this.isFloatingButtonVisible = false;
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // Skip initialization on extension pages and special URLs
        if (this.shouldSkipInjection()) {
            return;
        }
        
        this.setupKeyboardShortcuts();
        this.setupMessageListener();
        this.setupPageAnalysis();
        
        // Optional: Create floating action button (disabled by default)
        // this.createFloatingButton();
        
        this.isInitialized = true;
        // Initialization complete (deprecated file, not injected)
    }

    shouldSkipInjection() {
        const url = window.location.href;
        const skipPatterns = [
            /^chrome:\/\//,
            /^chrome-extension:\/\//,
            /^edge:\/\//,
            /^moz-extension:\/\//,
            /^about:/,
            /^file:\/\//,
            /^data:/,
            /^blob:/
        ];
        
        return skipPatterns.some(pattern => pattern.test(url)) || 
               document.contentType !== 'text/html';
    }

    setupKeyboardShortcuts() {
        // Define keyboard shortcuts
        this.shortcuts.set('ctrl+shift+l', () => this.openLauncher());
        this.shortcuts.set('cmd+shift+l', () => this.openLauncher());
        this.shortcuts.set('ctrl+shift+a', () => this.addCurrentPage());
        this.shortcuts.set('cmd+shift+a', () => this.addCurrentPage());
        this.shortcuts.set('ctrl+shift+s', () => this.addToSickbay());
        this.shortcuts.set('cmd+shift+s', () => this.addToSickbay());
        this.shortcuts.set('ctrl+shift+f', () => this.openFullPage());
        this.shortcuts.set('cmd+shift+f', () => this.openFullPage());
        this.shortcuts.set('ctrl+shift+1', () => this.openLauncherInView('grid'));
        this.shortcuts.set('cmd+shift+1', () => this.openLauncherInView('grid'));
        this.shortcuts.set('ctrl+shift+2', () => this.openLauncherInView('thumbnail'));
        this.shortcuts.set('cmd+shift+2', () => this.openLauncherInView('thumbnail'));
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    handleKeydown(e) {
        // Skip if user is typing in an input field
        if (this.isTypingInInput(e.target)) {
            return;
        }
        
        const key = this.getKeyboardShortcut(e);
        const handler = this.shortcuts.get(key);
        
        if (handler) {
            e.preventDefault();
            handler();
        }
    }

    isTypingInInput(element) {
        const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
        return inputTypes.includes(element.tagName) || 
               element.contentEditable === 'true' ||
               element.isContentEditable;
    }

    getKeyboardShortcut(e) {
        const parts = [];
        
        if (e.ctrlKey) parts.push('ctrl');
        if (e.metaKey) parts.push('cmd');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        
        parts.push(e.key.toLowerCase());
        
        return parts.join('+');
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // SECURITY FIX: Validate message origin
            // Only accept messages from our own extension
            if (!sender || sender.id !== chrome.runtime.id) {
                console.warn('Rejected message from unauthorized sender:', sender);
                sendResponse({
                    success: false,
                    message: 'Unauthorized: Messages only accepted from extension itself'
                });
                return false;
            }

            // Validate request structure
            if (!request || typeof request !== 'object') {
                console.warn('Rejected malformed message request');
                sendResponse({
                    success: false,
                    message: 'Invalid request format'
                });
                return false;
            }

            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open
        });
    }

    setupPageAnalysis() {
        // Analyze page for potential bookmark suggestions
        this.analyzePageContent();
        
        // Set up observers for dynamic content
        this.observePageChanges();
    }

    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'showNotification':
                this.showNotification(request.message, request.type || 'info');
                sendResponse({ success: true });
                break;
            
            case 'getPageInfo':
                sendResponse({
                    title: document.title,
                    url: window.location.href,
                    description: this.getPageDescription(),
                    favicon: this.getPageFavicon(),
                    keywords: this.getPageKeywords()
                });
                break;
            
            case 'highlightBookmarkable':
                this.highlightBookmarkableContent();
                sendResponse({ success: true });
                break;
            
            case 'toggleFloatingButton':
                this.toggleFloatingButton(request.visible);
                sendResponse({ success: true });
                break;
            
            default:
                sendResponse({ success: false, message: 'Unknown action' });
        }
    }

    // ========================================
    // Core Actions
    // ========================================

    async openLauncher() {
        try {
            await chrome.runtime.sendMessage({ action: 'openLauncher' });
            this.showNotification('Opening Hyper Launcher...', 'info');
        } catch (error) {
            console.error('Failed to open launcher:', error);
            this.showNotification('Failed to open launcher', 'error');
        }
    }

    async openFullPage() {
        try {
            await chrome.runtime.sendMessage({ action: 'openFullPage' });
            this.showNotification('Opening full page launcher...', 'info');
        } catch (error) {
            console.error('Failed to open full page:', error);
            this.showNotification('Failed to open full page', 'error');
        }
    }

    async openLauncherInView(view) {
        try {
            // Set the view preference before opening
            await chrome.storage.local.set({ hyperLauncherViewPopup: view });
            await chrome.runtime.sendMessage({ action: 'openLauncher' });
            this.showNotification(`Opening launcher in ${view} view...`, 'info');
        } catch (error) {
            console.error('Failed to open launcher:', error);
            this.showNotification('Failed to open launcher', 'error');
        }
    }

    async addCurrentPage() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'addCurrentPage',
                destination: 'main'
            });
            
            if (response && response.success) {
                this.showNotification('Page added to Hyper Launcher!', 'success');
                this.trackAction('page_added');
            } else {
                this.showNotification('Page already exists in launcher', 'warning');
            }
        } catch (error) {
            console.error('Failed to add page:', error);
            this.showNotification('Failed to add page to launcher', 'error');
        }
    }

    async addToSickbay() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'addCurrentPage',
                destination: 'sickbay'
            });
            
            if (response && response.success) {
                this.showNotification('Page added to Sickbay!', 'success');
                this.trackAction('sickbay_added');
            } else {
                this.showNotification('Page already exists in Sickbay', 'warning');
            }
        } catch (error) {
            console.error('Failed to add to sickbay:', error);
            this.showNotification('Failed to add page to Sickbay', 'error');
        }
    }

    // ========================================
    // Page Analysis
    // ========================================

    analyzePageContent() {
        // Extract meaningful information about the page
        const analysis = {
            title: document.title,
            url: window.location.href,
            description: this.getPageDescription(),
            keywords: this.getPageKeywords(),
            category: this.categorizeContent(),
            importance: this.calculateImportanceScore(),
            hasForm: document.querySelector('form') !== null,
            hasVideo: document.querySelector('video') !== null,
            hasImages: document.querySelectorAll('img').length,
            wordCount: this.getWordCount(),
            language: document.documentElement.lang || 'en'
        };
        
        // Store analysis for potential use
        this.pageAnalysis = analysis;
        
        // Check if this might be a good candidate for bookmarking
        if (analysis.importance > 0.7) {
            this.suggestBookmarking();
        }
    }

    getPageDescription() {
        // Try multiple sources for page description
        const selectors = [
            'meta[name="description"]',
            'meta[property="og:description"]',
            'meta[name="twitter:description"]',
            'meta[itemprop="description"]'
        ];
        
        for (const selector of selectors) {
            const meta = document.querySelector(selector);
            if (meta && meta.content && meta.content.trim()) {
                return meta.content.trim().substring(0, 300);
            }
        }
        
        // Fallback to first paragraph
        const firstParagraph = document.querySelector('p');
        if (firstParagraph && firstParagraph.textContent) {
            return firstParagraph.textContent.trim().substring(0, 300);
        }
        
        return '';
    }

    getPageKeywords() {
        const keywordsMeta = document.querySelector('meta[name="keywords"]');
        if (keywordsMeta && keywordsMeta.content) {
            return keywordsMeta.content.split(',').map(k => k.trim()).slice(0, 10);
        }
        
        // Extract keywords from headings
        const headings = document.querySelectorAll('h1, h2, h3');
        const keywords = Array.from(headings)
            .map(h => h.textContent.trim())
            .filter(text => text.length > 0)
            .slice(0, 5);
        
        return keywords;
    }

    getPageFavicon() {
        const selectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]'
        ];
        
        for (const selector of selectors) {
            const link = document.querySelector(selector);
            if (link && link.href) {
                return link.href;
            }
        }
        
        // Default favicon location
        return `${window.location.origin}/favicon.ico`;
    }

    categorizeContent() {
        const url = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();
        const description = this.getPageDescription().toLowerCase();
        const content = `${url} ${title} ${description}`;
        
        const categories = {
            'documentation': ['docs', 'documentation', 'api', 'guide', 'tutorial', 'manual'],
            'social': ['twitter', 'facebook', 'instagram', 'linkedin', 'social'],
            'news': ['news', 'article', 'blog', 'post', 'story'],
            'development': ['github', 'stackoverflow', 'code', 'programming', 'dev'],
            'productivity': ['calendar', 'email', 'task', 'project', 'manage'],
            'entertainment': ['video', 'music', 'game', 'entertainment', 'watch'],
            'shopping': ['shop', 'buy', 'cart', 'product', 'store', 'amazon'],
            'education': ['learn', 'course', 'education', 'university', 'school']
        };
        
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => content.includes(keyword))) {
                return category;
            }
        }
        
        return 'general';
    }

    calculateImportanceScore() {
        let score = 0;
        
        // URL patterns that suggest important content
        const importantPatterns = [
            /docs?\./, /api\./, /guide/, /tutorial/,
            /github\.com/, /stackoverflow\.com/,
            /\.edu/, /wiki/
        ];
        
        if (importantPatterns.some(pattern => pattern.test(window.location.href))) {
            score += 0.3;
        }
        
        // Title indicators
        const titleWords = document.title.toLowerCase();
        const importantTitleWords = ['documentation', 'guide', 'tutorial', 'reference', 'api'];
        if (importantTitleWords.some(word => titleWords.includes(word))) {
            score += 0.2;
        }
        
        // Page structure indicators
        if (document.querySelectorAll('h1, h2, h3').length > 3) {
            score += 0.1; // Well-structured content
        }
        
        if (document.querySelectorAll('code, pre').length > 0) {
            score += 0.2; // Contains code examples
        }
        
        // Content length
        const wordCount = this.getWordCount();
        if (wordCount > 500) {
            score += 0.2; // Substantial content
        }
        
        return Math.min(score, 1.0);
    }

    getWordCount() {
        const textContent = document.body.textContent || '';
        return textContent.trim().split(/\s+/).length;
    }

    observePageChanges() {
        // Watch for dynamic content changes that might affect bookmarkability
        if ('MutationObserver' in window) {
            const observer = new MutationObserver((mutations) => {
                let shouldReanalyze = false;
                
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Check if significant content was added
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                const element = node;
                                if (element.tagName && ['ARTICLE', 'MAIN', 'SECTION'].includes(element.tagName)) {
                                    shouldReanalyze = true;
                                }
                            }
                        });
                    }
                });
                
                if (shouldReanalyze) {
                    setTimeout(() => this.analyzePageContent(), 1000);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    suggestBookmarking() {
        // For now, just analyze silently
        // In the future, this could show a subtle UI hint
        // (Deprecated file - not injected into web pages)
    }

    highlightBookmarkableContent() {
        // Highlight elements that would make good bookmark candidates
        const selectors = [
            'article',
            'main',
            '[role="main"]',
            '.content',
            '.article',
            '.post'
        ];
        
        let highlighted = 0;
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (highlighted < 3) { // Limit to 3 highlights
                    element.style.outline = '2px solid #4CAF50';
                    element.style.outlineOffset = '2px';
                    highlighted++;
                    
                    // Remove highlight after 3 seconds
                    setTimeout(() => {
                        element.style.outline = '';
                        element.style.outlineOffset = '';
                    }, 3000);
                }
            });
        });
        
        if (highlighted > 0) {
            this.showNotification(`Highlighted ${highlighted} bookmarkable section(s)`, 'info');
        }
    }

    // ========================================
    // Floating Action Button (Optional)
    // ========================================

    createFloatingButton() {
        if (document.getElementById('hyper-launcher-fab') || this.shouldSkipInjection()) {
            return;
        }
        
        const fab = document.createElement('div');
        fab.id = 'hyper-launcher-fab';
        fab.innerHTML = '🚀';
        fab.title = 'Hyper Launcher - Add bookmark (Ctrl+Shift+A)';
        
        // Styles
        Object.assign(fab.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4CAF50, #45a049)',
            color: 'white',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: '999999',
            transition: 'all 0.3s ease',
            userSelect: 'none',
            opacity: '0.8'
        });
        
        // Hover effects
        fab.addEventListener('mouseenter', () => {
            fab.style.transform = 'scale(1.1)';
            fab.style.opacity = '1';
            fab.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
        });
        
        fab.addEventListener('mouseleave', () => {
            fab.style.transform = 'scale(1)';
            fab.style.opacity = '0.8';
            fab.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        });
        
        // Click handler
        fab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showFabMenu(fab);
        });
        
        document.body.appendChild(fab);
        this.isFloatingButtonVisible = true;
        
        // Auto-hide after inactivity
        this.setupAutoHide(fab);
    }

    showFabMenu(fab) {
        // Remove existing menu
        const existingMenu = document.getElementById('hyper-launcher-fab-menu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }
        
        const menu = document.createElement('div');
        menu.id = 'hyper-launcher-fab-menu';
        
        Object.assign(menu.style, {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.9)',
            borderRadius: '8px',
            padding: '8px',
            zIndex: '999998',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
        });
        
        const actions = [
            { text: 'Add to Launcher', action: () => this.addCurrentPage() },
            { text: 'Add to Sickbay', action: () => this.addToSickbay() },
            { text: 'Open Launcher', action: () => this.openLauncher() },
            { text: 'Open Full Page', action: () => this.openFullPage() }
        ];
        
        actions.forEach(({ text, action }) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.style.cssText = `
                display: block;
                width: 100%;
                padding: 8px 12px;
                margin: 2px 0;
                background: transparent;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            `;
            
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(76, 175, 80, 0.3)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.background = 'transparent';
            });
            
            button.addEventListener('click', () => {
                action();
                menu.remove();
            });
            
            menu.appendChild(button);
        });
        
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && !fab.contains(e.target)) {
                    menu.remove();
                }
            }, { once: true });
        }, 10);
    }

    setupAutoHide(fab) {
        let hideTimeout;
        let isHidden = false;
        
        const hideFab = () => {
            if (!isHidden) {
                fab.style.opacity = '0.3';
                fab.style.transform = 'scale(0.8)';
                isHidden = true;
            }
        };
        
        const showFab = () => {
            if (isHidden) {
                fab.style.opacity = '0.8';
                fab.style.transform = 'scale(1)';
                isHidden = false;
            }
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(hideFab, 5000);
        };
        
        // Show FAB on mouse movement
        document.addEventListener('mousemove', showFab);
        document.addEventListener('scroll', showFab);
        
        // Initial hide timeout
        hideTimeout = setTimeout(hideFab, 5000);
    }

    toggleFloatingButton(visible) {
        const fab = document.getElementById('hyper-launcher-fab');
        
        if (visible && !fab) {
            this.createFloatingButton();
        } else if (!visible && fab) {
            fab.remove();
            this.isFloatingButtonVisible = false;
        }
    }

    // ========================================
    // Notifications
    // ========================================

    showNotification(message, type = 'info', duration = 4000) {
        // Create notification element
        const notification = document.createElement('div');
        const notificationId = `hyper-launcher-notification-${Date.now()}`;
        notification.id = notificationId;
        
        // Styles based on type
        const typeStyles = {
            success: { backgroundColor: '#4CAF50', borderLeft: '4px solid #45a049' },
            error: { backgroundColor: '#f44336', borderLeft: '4px solid #d32f2f' },
            warning: { backgroundColor: '#FF9800', borderLeft: '4px solid #F57C00' },
            info: { backgroundColor: '#2196F3', borderLeft: '4px solid #1976D2' }
        };
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            minWidth: '300px',
            maxWidth: '400px',
            padding: '12px 16px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: '999999',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            opacity: '0',
            backdropFilter: 'blur(10px)',
            ...typeStyles[type]
        });
        
        // Add icon based on type
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">${icons[type] || icons.info}</span>
                <span style="flex: 1;">${message}</span>
                <button id="close-${notificationId}" style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0;
                    margin-left: 8px;
                    opacity: 0.7;
                " title="Close">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);
        
        // Close button
        const closeBtn = document.getElementById(`close-${notificationId}`);
        closeBtn.addEventListener('click', () => this.hideNotification(notification));
        
        // Auto-hide
        const hideTimeout = setTimeout(() => {
            this.hideNotification(notification);
        }, duration);
        
        // Store notification reference
        this.notifications.set(notificationId, {
            element: notification,
            timeout: hideTimeout
        });
        
        // Limit number of notifications
        if (this.notifications.size > 3) {
            const oldestId = this.notifications.keys().next().value;
            this.hideNotification(this.notifications.get(oldestId).element);
        }
    }

    hideNotification(notification) {
        if (!notification.parentNode) return;
        
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
        
        // Clean up from tracking
        this.notifications.forEach((data, id) => {
            if (data.element === notification) {
                clearTimeout(data.timeout);
                this.notifications.delete(id);
            }
        });
    }

    // ========================================
    // Analytics and Tracking
    // ========================================

    trackAction(actionType) {
        // Privacy-focused tracking - only track action types, not content
        try {
            chrome.runtime.sendMessage({
                action: 'trackUsage',
                type: actionType,
                timestamp: Date.now()
            });
        } catch (error) {
            // Silently fail - tracking should not break functionality
        }
    }

    // ========================================
    // Cleanup
    // ========================================

    cleanup() {
        // Clean up notifications
        this.notifications.forEach((data) => {
            clearTimeout(data.timeout);
            if (data.element.parentNode) {
                data.element.parentNode.removeChild(data.element);
            }
        });
        this.notifications.clear();
        
        // Remove floating button
        const fab = document.getElementById('hyper-launcher-fab');
        if (fab) {
            fab.remove();
        }
        
        // Remove FAB menu
        const menu = document.getElementById('hyper-launcher-fab-menu');
        if (menu) {
            menu.remove();
        }
    }
}

// Initialize content script
let hyperLauncherContent;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        hyperLauncherContent = new HyperLauncherContent();
    });
} else {
    hyperLauncherContent = new HyperLauncherContent();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (hyperLauncherContent) {
        hyperLauncherContent.cleanup();
    }
});