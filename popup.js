// Hyper Launcher v3.2.5 - FIXED Popup Implementation with Security & Full Functionality
// Fixed: First-run initialization race condition (waits for background worker)

class HyperLauncherPopup {
    constructor() {
        this.apps = [];
        this.sickbayApps = [];
        this.currentView = 'grid';
        this.isShowingSickbay = false;
        this.isSearchMode = false;
        this.searchQuery = '';
        this.draggedApp = null;
        this.openInBackground = true;
        this.appToDelete = null;
        this.isFirstTime = false;
        this.compactMode = true; // Default to compact mode
        this.compactDestination = 'main'; // Default destination for compact mode

        // FIXED: Undo system (ported from fullpage)
        this.undoStack = [];
        this.maxUndoStack = 10;

        // SECURITY: Rate limiting for operations
        this.rateLimiters = {
            saveData: this.createRateLimiter(10, 1000) // 10 per second
        };

        this.init();
    }

    // SECURITY: Rate limiter implementation
    createRateLimiter(maxCalls, timeWindow) {
        const calls = [];

        return {
            tryCall: () => {
                const now = Date.now();
                while (calls.length > 0 && calls[0] < now - timeWindow) {
                    calls.shift();
                }
                if (calls.length >= maxCalls) {
                    return false;
                }
                calls.push(now);
                return true;
            },
            reset: () => {
                calls.length = 0;
            }
        };
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.toggleCompactMode(); // Apply compact mode state
        this.render();
        this.checkOnboarding();
        this.updateSickbayBadge();
        this.updateStatusIndicator();
        this.restoreViewState();
    }

    updateSavedTodayCounter() {
        const counter = document.getElementById('compactSavedToday');
        if (!counter) return;

        const today = new Date().toDateString();
        const todayApps = this.apps.concat(this.sickbayApps).filter(app => {
            const appDate = new Date(app.createdAt).toDateString();
            return appDate === today;
        });

        const count = todayApps.length;
        counter.textContent = count === 1 ? '1 saved today' : `${count} saved today`;
    }

    setCompactDestination(destination) {
        this.compactDestination = destination;

        // Update toggle button states
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = destination === 'main' ?
            document.getElementById('compactDestMain') :
            document.getElementById('compactDestSickbay');

        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Save preference
        chrome.storage.local.set({ hyperLauncherLastDestination: destination });
    }

    toggleCompactMode() {
        const compactContainer = document.getElementById('compactContainer');
        const fullContainer = document.getElementById('fullContainer');

        if (compactContainer && fullContainer) {
            if (this.compactMode) {
                compactContainer.style.display = 'flex';
                fullContainer.style.display = 'none';
                this.updateSavedTodayCounter();
            } else {
                compactContainer.style.display = 'none';
                fullContainer.style.display = 'block';
            }
        }

        // Update toggle states
        const compactModeToggle = document.getElementById('compactModeToggle');
        const fullCompactModeToggle = document.getElementById('fullCompactModeToggle');
        const compactTabModeToggle = document.getElementById('compactTabModeToggle');
        const fullTabModeToggle = document.getElementById('fullTabModeToggle');

        if (compactModeToggle) compactModeToggle.checked = this.compactMode;
        if (fullCompactModeToggle) fullCompactModeToggle.checked = this.compactMode;
        if (compactTabModeToggle) compactTabModeToggle.checked = this.openInBackground;
        if (fullTabModeToggle) fullTabModeToggle.checked = this.openInBackground;
    }

    setCompactMode(enabled) {
        this.compactMode = enabled;
        this.toggleCompactMode();
        this.saveData();
    }

    setTabMode(enabled) {
        this.openInBackground = enabled;
        this.updateStatusIndicator();
        this.saveData();

        // Update all toggle states
        const compactTabModeToggle = document.getElementById('compactTabModeToggle');
        const fullTabModeToggle = document.getElementById('fullTabModeToggle');

        if (compactTabModeToggle) compactTabModeToggle.checked = enabled;
        if (fullTabModeToggle) fullTabModeToggle.checked = enabled;

        this.showToast(
            enabled ? 'Opening tabs in background' : 'Opening tabs in foreground',
            'info'
        );
    }

    // SECURITY: Safe URL validation
    isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;

        const dangerousProtocols = [
            'javascript:', 'data:', 'vbscript:', 'file:',
            'chrome:', 'chrome-extension:', 'moz-extension:'
        ];

        const lowerUrl = url.toLowerCase();
        if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
            return false;
        }

        try {
            const urlObj = new URL(url.match(/^https?:\/\//) ? url : 'https://' + url);
            return ['http:', 'https:'].includes(urlObj.protocol);
        } catch (error) {
            console.warn(`URL validation failed for "${url}":`, error.message);
            return false;
        }
    }

    // SECURITY: Safe favicon URL validation for CSS
    // Prevents CSS injection via malformed URLs
    isSafeFaviconUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        // Allow data:image/* URLs (safe base64-encoded images from browser tabs)
        if (url.startsWith('data:image/')) {
            // Only allow specific safe image types
            const safeImageTypes = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/gif', 'data:image/webp', 'data:image/svg+xml'];
            if (!safeImageTypes.some(type => url.startsWith(type))) {
                console.warn('Blocked unsafe data: image type:', url.substring(0, 50));
                return false;
            }
            // No need for CSS injection checks on data URIs - they're base64 encoded
            return true;
        }

        // Check for CSS injection patterns on regular URLs
        const cssInjectionPatterns = [
            /['"(){};<>]/,  // CSS breaking characters
            /\\(?![0-9a-f]{1,6}\s?)/i,  // Backslash not part of valid CSS escape
            /url\s*\(/i,    // Nested url()
            /expression\s*\(/i,  // IE expression()
            /import\s/i,    // @import
        ];

        if (cssInjectionPatterns.some(pattern => pattern.test(url))) {
            console.warn('Blocked potentially malicious favicon URL:', url);
            return false;
        }

        // Must be http(s) or chrome-extension (for extension icons)
        try {
            const urlObj = new URL(url);
            return ['http:', 'https:', 'chrome-extension:'].includes(urlObj.protocol);
        } catch (error) {
            console.warn(`Favicon URL validation failed for "${url}":`, error.message);
            return false;
        }
    }

    // SECURITY: Safely escape URL for CSS
    // Uses CSS.escape() if available, otherwise manual escaping
    escapeCssUrl(url) {
        if (!this.isSafeFaviconUrl(url)) {
            throw new Error('Invalid favicon URL: ' + url);
        }

        // CSS.escape() is widely supported in modern browsers
        if (typeof CSS !== 'undefined' && CSS.escape) {
            return CSS.escape(url);
        }

        // Fallback: manual escaping
        return url.replace(/['"\\]/g, '\\$&');
    }

    // SECURITY: Redact sensitive information from URLs for display
    // Redacts query parameters, userinfo (credentials), and fragments
    redactSensitiveUrl(url) {
        if (!url || typeof url !== 'string') {
            return '[invalid URL]';
        }

        try {
            const urlObj = new URL(url);

            // Redact userinfo (username:password@)
            if (urlObj.username || urlObj.password) {
                urlObj.username = '[REDACTED]';
                urlObj.password = '';
            }

            // Redact query parameters (may contain tokens, session IDs, etc.)
            if (urlObj.search) {
                urlObj.search = '?[REDACTED]';
            }

            // Redact fragment (may contain sensitive data)
            if (urlObj.hash) {
                urlObj.hash = '#[REDACTED]';
            }

            return urlObj.toString();
        } catch (error) {
            // If URL parsing fails, return a safe placeholder
            return '[invalid URL format]';
        }
    }

    // SECURITY: Safe text sanitization
    sanitizeText(text) {
        if (typeof text !== 'string') return '';
        return text.replace(/[<>\"'&]/g, (match) => {
            const entities = {'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'};
            return entities[match];
        }).substring(0, 200);
    }

    // SECURITY: Safe toast notifications
    showToast(message, type = 'info') {
        document.querySelectorAll('.toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const typeColors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800',
            info: '#2196F3'
        };
        
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--surface-elevated);
            border: 2px solid var(--border);
            border-left: 4px solid ${typeColors[type] || typeColors.info};
            border-radius: 8px;
            padding: 12px 16px;
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            min-width: 200px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        toast.textContent = this.sanitizeText(message);
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.transform = 'translateX(0)', 10);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async loadData() {
        try {
            const data = await chrome.storage.local.get([
                'hyperLauncherApps',
                'hyperLauncherSickbayApps',
                'hyperLauncherViewPopup',
                'hyperLauncherTabMode',
                'hyperLauncherFirstTime',
                'hyperLauncherCompactMode',
                'hyperLauncherLastDestination'
            ]);

            // FIXED: Handle first-run initialization
            // On first run, storage keys won't exist yet - initialize them
            if (!data.hasOwnProperty('hyperLauncherApps') || !data.hasOwnProperty('hyperLauncherSickbayApps')) {
                // First run detected - wait for background worker to initialize, then retry
                await new Promise(resolve => setTimeout(resolve, 100));
                return this.loadData();
            }

            // Validate data types after confirming keys exist
            if (!Array.isArray(data.hyperLauncherApps)) {
                throw new TypeError(`hyperLauncherApps must be an array, got ${typeof data.hyperLauncherApps}`);
            }
            if (!Array.isArray(data.hyperLauncherSickbayApps)) {
                throw new TypeError(`hyperLauncherSickbayApps must be an array, got ${typeof data.hyperLauncherSickbayApps}`);
            }

            this.apps = data.hyperLauncherApps;
            this.sickbayApps = data.hyperLauncherSickbayApps;
            this.currentView = data.hyperLauncherViewPopup || 'grid';
            this.openInBackground = data.hyperLauncherTabMode !== false;
            this.isFirstTime = data.hyperLauncherFirstTime !== false;
            this.compactMode = data.hyperLauncherCompactMode !== false; // Default to true

            // Restore last destination preference
            this.compactDestination = data.hyperLauncherLastDestination || 'main';
            // Update toggle UI to match restored preference (after DOM is ready)
            setTimeout(() => this.setCompactDestination(this.compactDestination), 0);

        } catch (error) {
            console.error('Failed to load data:', error);
            this.showToast('Failed to load bookmarks', 'error');
            throw error; // Re-throw to fail fast
        }
    }

    async saveData() {
        // SECURITY: Rate limit storage writes to prevent DOS
        if (!this.rateLimiters.saveData.tryCall()) {
            console.warn('Save data rate limit exceeded, queuing for later');
            if (this.saveDataTimeout) {
                clearTimeout(this.saveDataTimeout);
            }
            this.saveDataTimeout = setTimeout(() => this.saveData(), 1000);
            return;
        }

        try {
            await chrome.storage.local.set({
                hyperLauncherApps: this.apps,
                hyperLauncherSickbayApps: this.sickbayApps,
                hyperLauncherViewPopup: this.currentView,
                hyperLauncherTabMode: this.openInBackground,
                hyperLauncherCompactMode: this.compactMode
            });
        } catch (error) {
            console.error('Failed to save data:', error);
            this.showToast('Failed to save changes', 'error');
        }
    }

    setupEventListeners() {
        // Compact mode event listeners
        document.getElementById('compactBookmarkBtn')?.addEventListener('click', () => this.addCurrentPage(this.compactDestination));
        document.getElementById('compactViewAllBtn')?.addEventListener('click', () => this.openFullPage());
        document.getElementById('compactSettingsBtn')?.addEventListener('click', () => this.toggleCompactDropdown());
        document.getElementById('compactExportBtn')?.addEventListener('click', () => {
            this.exportData();
            this.closeCompactDropdown();
        });
        document.getElementById('compactImportBtn')?.addEventListener('click', () => {
            this.importData();
            this.closeCompactDropdown();
        });

        // Destination toggle buttons
        document.getElementById('compactDestMain')?.addEventListener('click', () => this.setCompactDestination('main'));
        document.getElementById('compactDestSickbay')?.addEventListener('click', () => this.setCompactDestination('sickbay'));

        // Compact mode toggle
        document.getElementById('compactModeToggle')?.addEventListener('change', (e) => {
            this.setCompactMode(e.target.checked);
        });
        document.getElementById('fullCompactModeToggle')?.addEventListener('change', (e) => {
            this.setCompactMode(e.target.checked);
        });

        // Tab mode toggles
        document.getElementById('compactTabModeToggle')?.addEventListener('change', (e) => {
            this.setTabMode(e.target.checked);
        });
        document.getElementById('fullTabModeToggle')?.addEventListener('change', (e) => {
            this.setTabMode(e.target.checked);
        });

        // View controls
        document.getElementById('gridViewBtn')?.addEventListener('click', () => this.switchView('grid'));
        document.getElementById('canvasViewBtn')?.addEventListener('click', () => {
            this.showToast('Canvas view coming soon!', 'info');
        });
        document.getElementById('thumbnailViewBtn')?.addEventListener('click', () => this.switchView('thumbnail'));
        document.getElementById('listViewBtn')?.addEventListener('click', () => this.switchView('list'));
        
        // Main actions
        document.getElementById('addMainBtn')?.addEventListener('click', () => this.addCurrentPage());
        document.getElementById('addSickbayBtn')?.addEventListener('click', () => this.addCurrentPage('sickbay'));
        document.getElementById('sickbayBtn')?.addEventListener('click', () => this.toggleSickbay());
        document.getElementById('fullPageBtn')?.addEventListener('click', () => this.openFullPage());
        
        // Dropdown menu
        document.getElementById('moreBtn')?.addEventListener('click', () => this.toggleDropdown());
        document.getElementById('addCustomBtn')?.addEventListener('click', () => this.showAddModal());
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('importBtn')?.addEventListener('click', () => this.importData());
        document.getElementById('clearSickbayBtn')?.addEventListener('click', () => this.clearSickbay());

        // FIXED: Undo button
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            this.closeDropdown();
            this.performUndo();
        });
        
        // Search functionality
        document.getElementById('searchToggleBtn')?.addEventListener('click', () => this.toggleSearch());
        document.getElementById('searchInput')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('searchClearBtn')?.addEventListener('click', () => this.clearSearch());
        
        // Modal handlers
        document.getElementById('addModalClose')?.addEventListener('click', () => this.hideAddModal());
        document.getElementById('addModalCancel')?.addEventListener('click', () => this.hideAddModal());
        document.getElementById('addModalSubmit')?.addEventListener('click', () => this.handleAddSubmit());
        document.getElementById('deleteModalCancel')?.addEventListener('click', () => this.hideDeleteModal());
        document.getElementById('deleteModalConfirm')?.addEventListener('click', () => this.confirmDelete());

        // Edit modal
        document.getElementById('editModalCancel')?.addEventListener('click', () => this.hideEditModal());
        document.getElementById('editModalSave')?.addEventListener('click', () => this.saveEditedBookmark());
        document.getElementById('editForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditedBookmark();
        });

        // Status indicator click
        document.getElementById('statusIndicator')?.addEventListener('click', () => this.toggleTabMode());
        
        // Empty state actions
        document.getElementById('emptyStateAddBtn')?.addEventListener('click', () => this.addCurrentPage());
        document.getElementById('addToSickbayEmptyBtn')?.addEventListener('click', () => this.addCurrentPage('sickbay'));
        document.getElementById('backToMainBtn')?.addEventListener('click', () => this.showMain());
        
        // Onboarding
        document.getElementById('onboardingNext')?.addEventListener('click', () => this.handleOnboardingNext());
        document.getElementById('onboardingSkip')?.addEventListener('click', () => this.skipOnboarding());
        document.getElementById('onboardingToFullPage')?.addEventListener('click', () => this.finishOnboarding());
        
        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown') && !e.target.closest('.compact-settings-container')) {
                this.closeDropdown();
                this.closeCompactDropdown();
            }
        });
        
        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.hideAddModal();
                this.hideDeleteModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAddModal();
                this.hideDeleteModal();
                this.closeDropdown();
            }
        });
    }

    restoreViewState() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        
        const activeBtn = document.getElementById(`${this.currentView}ViewBtn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-selected', 'true');
        }
        
        // Apply view class to container
        const appsContainer = document.getElementById('appsContainer');
        if (appsContainer) {
            appsContainer.className = `main-content ${this.currentView}-view`;
        }
    }

    switchView(view) {
        if (view === 'canvas') {
            this.showToast('Canvas view coming soon!', 'info');
            return;
        }
        
        this.currentView = view;
        this.restoreViewState();
        this.render();
        this.saveData();
    }

    render() {
        const grid = document.getElementById('appsGrid');
        if (!grid) return;
        
        const appsToShow = this.isShowingSickbay ? this.sickbayApps : this.apps;
        let filteredApps = appsToShow;
        
        // Apply search filter
        if (this.searchQuery) {
            filteredApps = appsToShow.filter(app => 
                app.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                app.url.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        }
        
        // Clear and rebuild safely
        grid.innerHTML = '';
        
        filteredApps.forEach(app => {
            const tile = this.createAppTile(app);
            grid.appendChild(tile);
        });
        
        this.updateEmptyStates(filteredApps.length);
    }

    createAppTile(app) {
        const tile = document.createElement('div');
        tile.className = 'app-tile';
        tile.setAttribute('draggable', 'true');
        tile.setAttribute('data-app-id', app.id);
        tile.setAttribute('tabindex', '0');

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.setAttribute('aria-label', 'Edit bookmark');
        editBtn.setAttribute('title', 'Edit bookmark');
        editBtn.textContent = '✎';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showEditModal(app);
        });
        tile.appendChild(editBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', 'Delete bookmark');
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDeleteModal(app);
        });
        tile.appendChild(deleteBtn);

        // Move button (for sickbay)
        if (this.isShowingSickbay) {
            const moveBtn = document.createElement('button');
            moveBtn.className = 'move-to-main-btn';
            moveBtn.setAttribute('aria-label', 'Move to main');
            moveBtn.setAttribute('title', 'Move to main bookmarks (irreversible)');
            moveBtn.textContent = '↑';
            moveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveToMain(app);
            });
            tile.appendChild(moveBtn);
        }

        // Icon
        const icon = document.createElement('div');
        icon.className = 'app-icon';
        // SECURITY FIX: Validate and escape favicon URL to prevent CSS injection
        if (app.favIconUrl && this.isSafeFaviconUrl(app.favIconUrl)) {
            try {
                const safeUrl = this.escapeCssUrl(app.favIconUrl);
                icon.style.backgroundImage = `url('${safeUrl}')`;
                icon.style.backgroundSize = 'contain';
                icon.style.backgroundRepeat = 'no-repeat';
                icon.style.backgroundPosition = 'center';
                icon.style.backgroundColor = 'transparent';
                icon.classList.add('has-favicon');
            } catch (error) {
                // Fail-fast: Log error and fall back to emoji icon
                console.error('Failed to set favicon:', error);
                icon.textContent = this.getIconForApp(app);
                icon.style.backgroundColor = '#333';
            }
        } else {
            icon.textContent = this.getIconForApp(app);
            icon.style.backgroundColor = '#333';
        }
        tile.appendChild(icon);

        // Title
        const title = document.createElement('div');
        title.className = 'app-title';
        title.textContent = this.sanitizeText(app.title);
        
        // Add tooltip for thumbnail view
        if (this.currentView === 'thumbnail') {
            const tooltip = document.createElement('div');
            tooltip.className = 'thumbnail-tooltip';
            tooltip.textContent = app.title;
            tile.appendChild(tooltip);
        }
        
        tile.appendChild(title);
        
        // Click handler
        tile.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-btn') &&
                !e.target.closest('.move-to-main-btn') &&
                !e.target.closest('.edit-btn')) {
                this.openApp(app);
            }
        });

        return tile;
    }

    updateEmptyStates(appCount) {
        const emptyState = document.getElementById('emptyState');
        const sickbayEmptyState = document.getElementById('sickbayEmptyState');
        
        if (emptyState) {
            emptyState.classList.toggle('visible', !this.isShowingSickbay && appCount === 0);
        }
        if (sickbayEmptyState) {
            sickbayEmptyState.classList.toggle('visible', this.isShowingSickbay && appCount === 0);
        }
    }

    async addCurrentPage(destination = 'main') {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                this.showToast('No active tab found', 'error');
                return;
            }
            
            if (this.isSpecialPage(tab.url)) {
                this.showToast('Cannot bookmark special pages', 'warning');
                return;
            }
            
            const targetArray = destination === 'sickbay' ? this.sickbayApps : this.apps;
            
            if (targetArray.some(app => app.url === tab.url)) {
                this.showToast('Page already bookmarked', 'warning');
                return;
            }
            
            const newApp = {
                id: Date.now(),
                url: tab.url,
                title: tab.title || this.getTitleFromUrl(tab.url),
                createdAt: Date.now(),
                favIconUrl: tab.favIconUrl,
                faviconLastUpdated: Date.now(),
                faviconSource: 'browser_tab'
            };
            
            targetArray.unshift(newApp);
            await this.saveData();
            this.render();
            this.updateSickbayBadge();
            this.updateSavedTodayCounter();

            // Show toast with URL
            const displayUrl = tab.url.length > 50 ? tab.url.substring(0, 50) + '...' : tab.url;
            this.showToast(`Added ${displayUrl} to ${destination === 'sickbay' ? 'Sickbay' : 'Main'}!`, 'success');
            
        } catch (error) {
            console.error('Failed to add current page:', error);
            this.showToast('Failed to add bookmark', 'error');
        }
    }

    openApp(app) {
        const active = !this.openInBackground;
        chrome.tabs.create({ url: app.url, active: active })
            .then(() => {
                app.lastUsed = Date.now();

                // Clear needsRegeneration flag if set (favicon will be captured by background.js)
                if (app.needsRegeneration) {
                    app.needsRegeneration = false;
                }

                this.saveData();
                window.close();
            })
            .catch((error) => {
                console.error('Failed to open app:', error);
                this.showToast('Failed to open bookmark', 'error');
            });
    }

    // Search functionality
    toggleSearch() {
        this.isSearchMode = !this.isSearchMode;
        const searchBar = document.getElementById('searchBar');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBar) {
            searchBar.style.display = this.isSearchMode ? 'flex' : 'none';
            
            if (this.isSearchMode && searchInput) {
                searchInput.focus();
            } else {
                this.clearSearch();
            }
        }
    }

    handleSearch(query) {
        this.searchQuery = query.trim();
        
        const clearBtn = document.getElementById('searchClearBtn');
        if (clearBtn) {
            clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
        }
        
        this.render();
    }

    clearSearch() {
        this.searchQuery = '';
        const searchInput = document.getElementById('searchInput');
        const clearBtn = document.getElementById('searchClearBtn');
        
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        
        this.render();
    }

    // Modal functionality
    showAddModal() {
        const modal = document.getElementById('addModalOverlay');
        if (modal) {
            modal.classList.add('visible');
            const urlInput = document.getElementById('urlInput');
            if (urlInput) urlInput.focus();
        }
        this.closeDropdown();
    }

    hideAddModal() {
        const modal = document.getElementById('addModalOverlay');
        if (modal) modal.classList.remove('visible');
        
        // Clear form
        const urlInput = document.getElementById('urlInput');
        const titleInput = document.getElementById('titleInput');
        if (urlInput) urlInput.value = '';
        if (titleInput) titleInput.value = '';
    }

    async handleAddSubmit() {
        const urlInput = document.getElementById('urlInput');
        const titleInput = document.getElementById('titleInput');
        const destinationRadio = document.querySelector('input[name="destination"]:checked');
        
        if (!urlInput || !urlInput.value.trim()) {
            this.showToast('Please enter a URL', 'warning');
            return;
        }
        
        const url = urlInput.value.trim();
        const title = titleInput?.value.trim() || this.getTitleFromUrl(url);
        const destination = destinationRadio?.value || 'main';
        
        if (!this.isValidUrl(url)) {
            this.showToast('Please enter a valid URL', 'error');
            return;
        }
        
        const targetArray = destination === 'sickbay' ? this.sickbayApps : this.apps;
        
        if (targetArray.some(app => app.url === url)) {
            this.showToast('URL already bookmarked', 'warning');
            return;
        }
        
        const newApp = {
            id: Date.now(),
            url: url.startsWith('http') ? url : 'https://' + url,
            title: title,
            createdAt: Date.now(),
            favIconUrl: null,
            faviconLastUpdated: Date.now(),
            faviconSource: 'manual'
        };
        
        targetArray.unshift(newApp);
        await this.saveData();
        this.render();
        this.updateSickbayBadge();
        this.hideAddModal();
        
        this.showToast(`Added to ${destination === 'sickbay' ? 'Sickbay' : 'Launcher'}!`, 'success');
    }

    showDeleteModal(app) {
        this.appToDelete = app;
        const modal = document.getElementById('deleteModalOverlay');
        const nameSpan = document.getElementById('deleteBookmarkName');
        
        if (modal) modal.classList.add('visible');
        if (nameSpan) nameSpan.textContent = app.title;
    }

    hideDeleteModal() {
        const modal = document.getElementById('deleteModalOverlay');
        if (modal) modal.classList.remove('visible');
        this.appToDelete = null;
    }

    confirmDelete() {
        if (!this.appToDelete) return;

        // FIXED: Save undo state before deleting
        this.saveUndoState(`Delete ${this.appToDelete.title}`);

        const targetArray = this.isShowingSickbay ? this.sickbayApps : this.apps;
        const index = targetArray.findIndex(app => app.id === this.appToDelete.id);

        if (index !== -1) {
            const deletedApp = targetArray.splice(index, 1)[0];
            this.saveData();
            this.render();
            this.updateSickbayBadge();
            this.showToast(`Deleted ${deletedApp.title}`, 'success');
        }

        this.hideDeleteModal();
    }

    // Edit Bookmark Modal
    showEditModal(app) {
        this.appToEdit = app;
        const modal = document.getElementById('editModalOverlay');
        const urlInput = document.getElementById('editUrl');
        const titleInput = document.getElementById('editTitle');
        const faviconInput = document.getElementById('editFavicon');
        const preserveCheckbox = document.getElementById('editPreserveOriginal');

        if (modal && urlInput && titleInput) {
            urlInput.value = app.url;
            titleInput.value = app.title;
            faviconInput.value = app.favIconUrl || '';
            preserveCheckbox.checked = app.preserveOriginal || false;

            modal.classList.add('visible');

            // Focus URL input
            setTimeout(() => urlInput.focus(), 100);
        }
    }

    hideEditModal() {
        const modal = document.getElementById('editModalOverlay');
        if (modal) modal.classList.remove('visible');
        this.appToEdit = null;
    }

    async saveEditedBookmark() {
        if (!this.appToEdit) return;

        const urlInput = document.getElementById('editUrl');
        const titleInput = document.getElementById('editTitle');
        const faviconInput = document.getElementById('editFavicon');
        const preserveCheckbox = document.getElementById('editPreserveOriginal');

        const newUrl = urlInput.value.trim();
        const newTitle = titleInput.value.trim();
        const newFavicon = faviconInput.value.trim();
        const newPreserveOriginal = preserveCheckbox.checked;

        // Validate
        if (!newUrl || !newTitle) {
            this.showToast('URL and Title are required', 'error');
            return;
        }

        if (!this.isValidUrl(newUrl)) {
            this.showToast('Invalid URL', 'error');
            return;
        }

        // SECURITY: Validate favicon URL if provided
        if (newFavicon && !this.isSafeFaviconUrl(newFavicon)) {
            this.showToast('Invalid favicon URL. Please use a valid http/https/data URL.', 'error');
            return;
        }

        // Find the app in the appropriate array
        const targetArray = this.isShowingSickbay ? this.sickbayApps : this.apps;
        const appIndex = targetArray.findIndex(a => a.id === this.appToEdit.id);

        if (appIndex !== -1) {
            const app = targetArray[appIndex];
            const urlChanged = app.url !== newUrl;

            // Update properties
            app.url = newUrl;
            app.title = newTitle;
            app.preserveOriginal = newPreserveOriginal;

            // Handle favicon
            if (newFavicon) {
                app.favIconUrl = newFavicon;
                app.faviconLastUpdated = Date.now();
            }

            // If URL changed, mark for regeneration
            if (urlChanged) {
                app.needsRegeneration = true;
                app.favIconUrl = null; // Clear favicon to force regeneration
                app.faviconLastUpdated = Date.now();
                this.showToast('URL updated. Favicon will refresh when you open this bookmark.', 'info');
            }

            await this.saveData();
            this.render();
            this.showToast('Bookmark updated', 'success');
        }

        this.hideEditModal();
    }

    // Validation Error Modal
    showValidationErrorsModal(validationErrors, filename) {
        return new Promise((resolve) => {
            const modalOverlay = document.getElementById('importValidationModalOverlay');
            const errorsList = document.getElementById('validationErrorsList');
            const cancelBtn = document.getElementById('importValidationModalCancel');
            const skipBtn = document.getElementById('importValidationModalSkip');

            if (!modalOverlay || !errorsList) {
                console.error('Validation modal elements not found');
                resolve(false);
                return;
            }

            // Clear previous errors
            errorsList.innerHTML = '';

            // Create error items
            validationErrors.forEach((error) => {
                const errorItem = document.createElement('div');
                errorItem.className = 'validation-error-item';

                const title = document.createElement('h4');
                title.textContent = `${error.type === 'main' ? 'Main' : 'Sickbay'} Bookmark #${error.index + 1}`;
                errorItem.appendChild(title);

                // SECURITY: Redact sensitive information from bookmark before displaying
                const redactedBookmark = { ...error.bookmark };
                if (redactedBookmark.url) {
                    redactedBookmark.url = this.redactSensitiveUrl(redactedBookmark.url);
                }
                // Also redact favicon URLs if they contain data URIs (can be large)
                if (redactedBookmark.favIconUrl && redactedBookmark.favIconUrl.startsWith('data:')) {
                    redactedBookmark.favIconUrl = '[data URI redacted]';
                }

                const bookmarkData = document.createElement('pre');
                bookmarkData.textContent = JSON.stringify(redactedBookmark, null, 2);
                errorItem.appendChild(bookmarkData);

                const reason = document.createElement('div');
                reason.className = 'error-reason';
                reason.textContent = `Error: ${error.error}`;
                errorItem.appendChild(reason);

                errorsList.appendChild(errorItem);
            });

            // Show modal
            modalOverlay.classList.add('visible');

            // Handle cancel
            const handleCancel = () => {
                modalOverlay.classList.remove('visible');
                cancelBtn.removeEventListener('click', handleCancel);
                skipBtn.removeEventListener('click', handleSkip);
                resolve(false);
            };

            // Handle skip
            const handleSkip = () => {
                modalOverlay.classList.remove('visible');
                cancelBtn.removeEventListener('click', handleCancel);
                skipBtn.removeEventListener('click', handleSkip);
                resolve(true);
            };

            // Add event listeners
            cancelBtn.addEventListener('click', handleCancel);
            skipBtn.addEventListener('click', handleSkip);

            // Close modal on overlay click
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    handleCancel();
                }
            });
        });
    }

    showImportModeModal() {
        return new Promise((resolve) => {
            const modalOverlay = document.getElementById('importModeModalOverlay');
            const cancelBtn = document.getElementById('importModeCancel');
            const replaceBtn = document.getElementById('importModeReplace');
            const mergeBtn = document.getElementById('importModeMerge');

            if (!modalOverlay) {
                console.error('Import mode modal elements not found');
                resolve(null);
                return;
            }

            // Show modal
            modalOverlay.classList.add('visible');

            // Handle cancel
            const handleCancel = () => {
                modalOverlay.classList.remove('visible');
                cancelBtn.removeEventListener('click', handleCancel);
                replaceBtn.removeEventListener('click', handleReplace);
                mergeBtn.removeEventListener('click', handleMerge);
                resolve(null);
            };

            // Handle replace
            const handleReplace = () => {
                modalOverlay.classList.remove('visible');
                cancelBtn.removeEventListener('click', handleCancel);
                replaceBtn.removeEventListener('click', handleReplace);
                mergeBtn.removeEventListener('click', handleMerge);
                resolve('replace');
            };

            // Handle merge
            const handleMerge = () => {
                modalOverlay.classList.remove('visible');
                cancelBtn.removeEventListener('click', handleCancel);
                replaceBtn.removeEventListener('click', handleReplace);
                mergeBtn.removeEventListener('click', handleMerge);
                resolve('merge');
            };

            // Add event listeners
            cancelBtn.addEventListener('click', handleCancel);
            replaceBtn.addEventListener('click', handleReplace);
            mergeBtn.addEventListener('click', handleMerge);

            // Close modal on overlay click
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    handleCancel();
                }
            });
        });
    }

    // Navigation
    toggleSickbay() {
        this.isShowingSickbay = !this.isShowingSickbay;
        this.render();
        
        // Update button appearance
        const sickbayBtn = document.getElementById('sickbayBtn');
        if (sickbayBtn) {
            sickbayBtn.style.background = this.isShowingSickbay ? 'var(--primary)' : '';
        }
    }

    showMain() {
        this.isShowingSickbay = false;
        this.render();
        
        const sickbayBtn = document.getElementById('sickbayBtn');
        if (sickbayBtn) {
            sickbayBtn.style.background = '';
        }
    }

    moveToMain(app) {
        const index = this.sickbayApps.findIndex(a => a.id === app.id);
        if (index !== -1) {
            const [removed] = this.sickbayApps.splice(index, 1);
            this.apps.unshift(removed);
            
            this.saveData();
            this.render();
            this.updateSickbayBadge();
            this.showToast(`Moved ${app.title} to main launcher`, 'success');
        }
    }

    // Status and badges
    updateSickbayBadge() {
        const sickbayCount = document.getElementById('sickbayCount');
        if (sickbayCount) {
            sickbayCount.textContent = this.sickbayApps.length;
            sickbayCount.classList.toggle('visible', this.sickbayApps.length > 0);
        }
    }

    updateStatusIndicator() {
        const statusText = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        
        if (statusText) {
            statusText.textContent = this.openInBackground ? 'background tabs' : 'active tabs';
        }
        
        if (statusDot) {
            statusDot.classList.toggle('inactive', !this.openInBackground);
        }
    }

    toggleTabMode() {
        this.openInBackground = !this.openInBackground;
        this.updateStatusIndicator();
        this.saveData();
        
        this.showToast(
            this.openInBackground ? 'Opening tabs in background' : 'Opening tabs in foreground',
            'info'
        );
    }

    // Dropdown
    toggleDropdown() {
        const dropdown = document.getElementById('moreMenu');
        if (dropdown) {
            dropdown.classList.toggle('visible');
        }
    }

    closeDropdown() {
        const dropdown = document.getElementById('moreMenu');
        if (dropdown) {
            dropdown.classList.remove('visible');
        }
    }

    toggleCompactDropdown() {
        const dropdown = document.getElementById('compactSettingsMenu');
        if (dropdown) {
            dropdown.classList.toggle('visible');
        }
    }

    closeCompactDropdown() {
        const dropdown = document.getElementById('compactSettingsMenu');
        if (dropdown) {
            dropdown.classList.remove('visible');
        }
    }

    clearSickbay() {
        if (this.sickbayApps.length === 0) {
            this.showToast('Sickbay is already empty', 'info');
            return;
        }

        // FIXED: Save undo state before clearing
        this.saveUndoState('Clear Sickbay');

        this.sickbayApps = [];
        this.saveData();
        this.render();
        this.updateSickbayBadge();
        this.showToast('Sickbay cleared', 'success');
        this.closeDropdown();
    }

    // ========================================
    // FIXED: UNDO SYSTEM (ported from fullpage)
    // ========================================

    saveUndoState(action, data = {}) {
        const undoState = {
            action: action,
            timestamp: Date.now(),
            apps: JSON.parse(JSON.stringify(this.apps)),
            sickbayApps: JSON.parse(JSON.stringify(this.sickbayApps)),
            data: data
        };

        this.undoStack.push(undoState);

        // Keep only last N undo states
        if (this.undoStack.length > this.maxUndoStack) {
            this.undoStack.shift();
        }
    }

    performUndo() {
        if (this.undoStack.length === 0) {
            this.showToast('Nothing to undo', 'info');
            return;
        }

        const lastState = this.undoStack.pop();

        // Restore previous state
        this.apps = lastState.apps;
        this.sickbayApps = lastState.sickbayApps;

        this.saveData();
        this.render();
        this.updateSickbayBadge();

        this.showToast(`Undid: ${lastState.action}`, 'success');
    }

    // ========================================
    // SECURITY: Prototype Pollution Protection
    // ========================================

    // SECURITY: Safe deep clone to prevent prototype pollution
    safeDeepClone(obj, maxDepth = 10, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
            throw new Error('Max depth exceeded in object cloning');
        }

        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        // Use structuredClone if available
        if (typeof structuredClone === 'function' && currentDepth === 0) {
            try {
                const cloned = structuredClone(obj);
                return this.stripDangerousKeys(cloned);
            } catch (e) {
                console.warn('structuredClone failed, using manual clone:', e);
            }
        }

        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.safeDeepClone(item, maxDepth, currentDepth + 1));
        }

        // Handle objects
        const cloned = {};
        for (const key in obj) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                console.warn('Blocked dangerous key during import:', key);
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = this.safeDeepClone(obj[key], maxDepth, currentDepth + 1);
            }
        }

        return cloned;
    }

    // SECURITY: Remove dangerous keys from object tree
    stripDangerousKeys(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

        if (Array.isArray(obj)) {
            return obj.map(item => this.stripDangerousKeys(item));
        }

        for (const key of dangerousKeys) {
            delete obj[key];
        }

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                obj[key] = this.stripDangerousKeys(obj[key]);
            }
        }

        return obj;
    }

    // SECURITY: Validate imported bookmark object
    validateBookmarkObject(bookmark) {
        if (!bookmark || typeof bookmark !== 'object') {
            throw new TypeError('Bookmark must be an object');
        }

        if (typeof bookmark.id !== 'number' || bookmark.id <= 0) {
            throw new TypeError('Bookmark.id must be a positive number');
        }

        // FIX: Convert decimal IDs to integers (v3.2.5 bug - some exports have decimal IDs)
        if (!Number.isInteger(bookmark.id)) {
            bookmark.id = Math.floor(bookmark.id);
        }

        if (typeof bookmark.url !== 'string' || !this.isValidUrl(bookmark.url)) {
            throw new TypeError('Bookmark.url must be a valid URL string');
        }

        if (typeof bookmark.title !== 'string' || bookmark.title.length === 0) {
            throw new TypeError('Bookmark.title must be a non-empty string');
        }

        // Return sanitized bookmark
        return {
            id: bookmark.id,
            url: bookmark.url,
            title: this.sanitizeText(bookmark.title),
            createdAt: typeof bookmark.createdAt === 'number' ? bookmark.createdAt : Date.now(),
            favIconUrl: bookmark.favIconUrl || null,
            faviconLastUpdated: typeof bookmark.faviconLastUpdated === 'number' ? bookmark.faviconLastUpdated : Date.now(),
            faviconSource: typeof bookmark.faviconSource === 'string' ? bookmark.faviconSource : 'none',
            preserveOriginal: Boolean(bookmark.preserveOriginal),
            lastUsed: typeof bookmark.lastUsed === 'number' ? bookmark.lastUsed : undefined
        };
    }

    // Import/Export
    async exportData() {
        try {
            const data = {
                version: chrome.runtime.getManifest().version,
                exportDate: new Date().toISOString(),
                apps: this.apps,
                sickbayApps: this.sickbayApps,
                settings: {
                    openInBackground: this.openInBackground,
                    currentView: this.currentView
                }
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // Use DOM download instead of chrome.downloads API (no permission required)
            const a = document.createElement('a');
            a.href = url;
            a.download = `hyper-launcher-backup-${Date.now()}.json`;
            a.click();

            URL.revokeObjectURL(url);
            this.showToast('Data exported successfully!', 'success');
            this.closeDropdown();
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Failed to export data', 'error');
        }
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();

                // SECURITY FIX: Parse with prototype pollution protection
                const rawData = JSON.parse(text);

                // Fail-fast validation
                if (!rawData || typeof rawData !== 'object') {
                    throw new TypeError('Invalid backup file: root must be an object');
                }

                if (!rawData.version || typeof rawData.version !== 'string') {
                    throw new TypeError('Invalid backup file: missing or invalid version');
                }

                if (!Array.isArray(rawData.apps)) {
                    throw new TypeError('Invalid backup file: apps must be an array');
                }

                // SECURITY: Safe clone to prevent prototype pollution
                const data = this.safeDeepClone(rawData);

                // Collect validation errors instead of throwing
                const validationErrors = [];
                const validatedApps = [];
                const validatedSickbayApps = [];

                // Validate main apps
                data.apps.forEach((app, index) => {
                    try {
                        validatedApps.push(this.validateBookmarkObject(app));
                    } catch (error) {
                        console.error(`Invalid bookmark at index ${index}:`, error);
                        validationErrors.push({
                            type: 'main',
                            index,
                            bookmark: app,
                            error: error.message
                        });
                    }
                });

                // Validate sickbay apps
                if (Array.isArray(data.sickbayApps)) {
                    data.sickbayApps.forEach((app, index) => {
                        try {
                            validatedSickbayApps.push(this.validateBookmarkObject(app));
                        } catch (error) {
                            console.error(`Invalid sickbay bookmark at index ${index}:`, error);
                            validationErrors.push({
                                type: 'sickbay',
                                index,
                                bookmark: app,
                                error: error.message
                            });
                        }
                    });
                }

                // If there are validation errors, show modal and ask user
                if (validationErrors.length > 0) {
                    const shouldProceed = await this.showValidationErrorsModal(validationErrors, file.name);
                    if (!shouldProceed) {
                        this.showToast('Import cancelled', 'info');
                        return;
                    }
                    // User chose to skip invalid bookmarks, proceed with valid ones
                }

                // Ask user for import mode (Replace or Merge)
                const importMode = await this.showImportModeModal();
                if (!importMode) {
                    this.showToast('Import cancelled', 'info');
                    return;
                }

                // Import validated data based on mode
                if (importMode === 'replace') {
                    // Replace mode: clear existing and use imported data
                    this.apps = validatedApps;
                    this.sickbayApps = validatedSickbayApps;
                } else if (importMode === 'merge') {
                    // Merge mode: add only new bookmarks (check by URL)
                    let addedCount = 0;
                    let skippedCount = 0;

                    // Merge main apps
                    validatedApps.forEach(importedApp => {
                        const exists = this.apps.some(app => app.url === importedApp.url);
                        if (!exists) {
                            this.apps.push(importedApp);
                            addedCount++;
                        } else {
                            skippedCount++;
                        }
                    });

                    // Merge sickbay apps
                    validatedSickbayApps.forEach(importedApp => {
                        const exists = this.sickbayApps.some(app => app.url === importedApp.url);
                        if (!exists) {
                            this.sickbayApps.push(importedApp);
                            addedCount++;
                        } else {
                            skippedCount++;
                        }
                    });
                }

                // Import settings with validation
                if (data.settings && typeof data.settings === 'object') {
                    const validViews = ['grid', 'thumbnail', 'list'];

                    this.openInBackground = data.settings.openInBackground !== false;
                    this.currentView = validViews.includes(data.settings.currentView)
                        ? data.settings.currentView
                        : 'grid';
                }

                await this.saveData();
                this.render();
                this.updateSickbayBadge();
                this.restoreViewState();

                // Build success message based on mode and validation errors
                let successMessage;
                if (importMode === 'replace') {
                    successMessage = validationErrors.length > 0
                        ? `Replaced all bookmarks! ${validatedApps.length} valid, ${validationErrors.length} skipped`
                        : `Replaced all bookmarks! (${validatedApps.length} bookmarks)`;
                } else if (importMode === 'merge') {
                    successMessage = validationErrors.length > 0
                        ? `Merged bookmarks! ${addedCount} added, ${skippedCount} duplicates, ${validationErrors.length} invalid`
                        : `Merged bookmarks! ${addedCount} added, ${skippedCount} duplicates`;
                }
                this.showToast(successMessage, 'success');

            } catch (error) {
                console.error('Import failed:', error);
                this.showToast(`Failed to import: ${error.message}`, 'error');
            }
        });

        input.click();
        this.closeDropdown();
    }

    // Onboarding
    checkOnboarding() {
        if (this.isFirstTime && this.apps.length === 0) {
            const onboardingOverlay = document.getElementById('onboardingOverlay');
            if (onboardingOverlay) onboardingOverlay.classList.add('visible');
        }
    }

    async handleOnboardingNext() {
        await this.addCurrentPage();
        
        // Move to step 2
        const steps = document.querySelectorAll('.onboarding-step');
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === 1);
        });
    }

    skipOnboarding() {
        this.finishOnboarding();
    }

    async finishOnboarding() {
        this.isFirstTime = false;
        await chrome.storage.local.set({ hyperLauncherFirstTime: false });
        
        const onboardingOverlay = document.getElementById('onboardingOverlay');
        if (onboardingOverlay) onboardingOverlay.classList.remove('visible');
        
        this.openFullPage();
    }

    // Utilities
    async openFullPage() {
        try {
            await chrome.runtime.sendMessage({ action: 'openFullPage' });
            window.close();
        } catch (error) {
            console.error('Failed to open full page:', error);
            this.showToast('Failed to open full page', 'error');
        }
    }

    isSpecialPage(url) {
        const specialPatterns = [
            /^chrome:\/\//,
            /^chrome-extension:\/\//,
            /^edge:\/\//,
            /^moz-extension:\/\//,
            /^about:/,
            /^file:\/\//,
            /^data:/,
            /^blob:/
        ];
        
        return specialPatterns.some(pattern => pattern.test(url));
    }

    getIconForApp(app) {
        const domain = app.url.toLowerCase();
        
        const icons = {
            'github.com': '🔗',
            'gmail.com': '📧',
            'youtube.com': '📺',
            'google.com': '🔍',
            'stackoverflow.com': '💬',
            'netflix.com': '🎬',
            'linkedin.com': '💼',
            'twitter.com': '🐦'
        };
        
        for (const [key, icon] of Object.entries(icons)) {
            if (domain.includes(key)) return icon;
        }
        
        return '🔗';
    }

    getTitleFromUrl(url) {
        try {
            if (!url.match(/^https?:\/\//)) {
                url = 'https://' + url;
            }
            
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');
            return hostname.split('.')[0].charAt(0).toUpperCase() +
                   hostname.split('.')[0].slice(1);
        } catch (error) {
            console.warn(`Title extraction failed for "${url}":`, error.message);
            return 'Bookmark';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new HyperLauncherPopup();
});
