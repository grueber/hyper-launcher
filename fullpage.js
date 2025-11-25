// Hyper Launcher v3.2.5 - Complete Full Page Implementation - PRODUCTION BUG FIX
// Fixed: bookmarkAllTabs generating invalid decimal IDs
// Fixed: Null safety in utility functions (getIconForApp, getColorForApp, createAppTile)
// Fixed: First-run initialization race condition

class HyperLauncherFullPage {
    constructor() {
        this.apps = [];
        this.sickbayApps = [];
        this.currentView = 'grid';
        this.isShowingSickbay = false;
        this.draggedApp = null;
        this.appToDelete = null;
        this.isFirstTime = false;
        this.searchQuery = '';
        this.openInBackground = true;
        this.gridLayout = 'comfortable';
        this.undoStack = [];
        this.maxUndoStack = 10;
        this.isEditingText = false; // FIXED: Track text editing state

        // Quick add popup settings
        this.quickAddDestination = 'main';
        this.quickAddPlacement = 'front';

        // FAVICON UPDATE DETECTION SYSTEM
        this.faviconUpdates = []; // Apps with detected favicon changes: [{app, oldFaviconUrl, newFaviconUrl}]
        this.pendingFaviconChecks = new Map(); // Track ongoing checks to avoid duplicates

        // PREVIEW SYSTEM
        this.activePreviewTooltip = null; // Currently shown tooltip
        this.previewHoverTimers = new Map(); // Track hover timers for each app
        this.previewOutsideClickHandler = null; // Click-outside-to-close handler

        // SECURITY: Rate limiting for operations
        this.rateLimiters = {
            faviconRefresh: this.createRateLimiter(5, 1000), // 5 per second
            saveData: this.createRateLimiter(10, 1000), // 10 per second
            bulkFavicon: this.createRateLimiter(1, 5000) // 1 per 5 seconds
        };

        this.init();
    }

    // SECURITY: Rate limiter implementation
    createRateLimiter(maxCalls, timeWindow) {
        const calls = [];

        return {
            tryCall: () => {
                const now = Date.now();
                // Remove old calls outside the time window
                while (calls.length > 0 && calls[0] < now - timeWindow) {
                    calls.shift();
                }

                // Check if we're at the limit
                if (calls.length >= maxCalls) {
                    return false; // Rate limit exceeded
                }

                // Record this call
                calls.push(now);
                return true; // Allow the call
            },
            reset: () => {
                calls.length = 0;
            },
            getStatus: () => ({
                calls: calls.length,
                maxCalls: maxCalls,
                remaining: maxCalls - calls.length
            })
        };
    }

    async init() {
        try {
            await this.loadData();
            
            this.setupEventListeners();
            this.updateViewControls();
            this.render();
            this.updateStats();
            this.updateTabModeIndicator();
            this.updateSickbayBadge();
            
            // Check if we should show onboarding
            this.checkOnboarding();

            // FIXED: Migrate existing bookmark data for favicon preservation
            await this.migrateFaviconData();

            // Refresh favicons in the background
            setTimeout(() => this.refreshAllFavicons(), 1000);

            // Start periodic favicon update checks (once per day)
            this.startPeriodicFaviconUpdateChecks();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showToast('Failed to initialize', 'error');
        }
    }

    async loadData() {
        try {
            const data = await chrome.storage.local.get([
                'hyperLauncherApps',
                'hyperLauncherSickbayApps',
                'hyperLauncherViewFullPage',
                'hyperLauncherFirstTime',
                'hyperLauncherTabMode',
                'hyperLauncherGridLayout'
            ]);

            // FIXED: Handle first-run initialization
            // On first run, storage keys won't exist yet - initialize them
            if (!data.hasOwnProperty('hyperLauncherApps') || !data.hasOwnProperty('hyperLauncherSickbayApps')) {
                // First run - initialize storage with defaults
                await this.initializeStorage();
                // Reload after initialization
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

            // Note: These fields have valid defaults, not defensive fallbacks
            // - Missing on first run is expected behavior
            // - Defaults are intentional feature, not bug hiding
            this.currentView = data.hyperLauncherViewFullPage || 'grid';
            this.isFirstTime = data.hyperLauncherFirstTime !== false;
            this.openInBackground = data.hyperLauncherTabMode !== false;
            this.gridLayout = data.hyperLauncherGridLayout || 'comfortable';

        } catch (error) {
            console.error('Failed to load data:', error);
            this.showToast('Failed to load bookmarks', 'error');
            // Re-throw to fail fast
            throw error;
        }
    }

    async initializeStorage() {
        // Initialize storage with empty defaults on first run
        const defaultSettings = {
            hyperLauncherApps: [],
            hyperLauncherSickbayApps: [],
            hyperLauncherViewFullPage: 'grid',
            hyperLauncherFirstTime: true,
            hyperLauncherTabMode: true,
            hyperLauncherGridLayout: 'comfortable'
        };

        try {
            await chrome.storage.local.set(defaultSettings);
            // Storage initialized successfully
        } catch (error) {
            console.error('Failed to initialize storage:', error);
            throw error;
        }
    }

    async saveData() {
        // SECURITY: Rate limit storage writes to prevent DOS
        if (!this.rateLimiters.saveData.tryCall()) {
            console.warn('Save data rate limit exceeded, queuing for later');
            // Queue the save for later using debouncing
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
                hyperLauncherViewFullPage: this.currentView,
                hyperLauncherTabMode: this.openInBackground,
                hyperLauncherGridLayout: this.gridLayout
            });
        } catch (error) {
            console.error('Failed to save data:', error);
            this.showToast('Failed to save changes', 'error');
        }
    }

    updateViewControls() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        
        const activeBtn = document.getElementById(`${this.currentView}ViewBtn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-selected', 'true');
        }
        
        document.querySelectorAll('.grid-size-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const layoutMap = {
            compact: '[data-size="compact"]',
            comfortable: '[data-size="comfortable"]', 
            roomy: '[data-size="roomy"]'
        };
        
        const activeLayoutBtn = document.querySelector(layoutMap[this.gridLayout]);
        if (activeLayoutBtn) {
            activeLayoutBtn.classList.add('active');
        }
    }

    // ========================================
    // BOOKMARK BAR FUNCTIONALITY
    // ========================================

    async addToBookmarkBar() {
        try {
            const result = await chrome.runtime.sendMessage({ action: 'addToBookmarkBar' });
            
            if (result && result.success) {
                this.showToast(result.message, 'success');
            } else {
                this.showToast(result?.message || 'Failed to add to bookmark bar', 'warning');
            }
        } catch (error) {
            console.error('Failed to add to bookmark bar:', error);
            this.showToast('Could not add to bookmark bar', 'error');
        }
    }

    // ========================================
    // EVENT LISTENERS SETUP
    // ========================================

    setupEventListeners() {
        try {
            // View controls
            document.getElementById('gridViewBtn')?.addEventListener('click', () => this.switchView('grid'));
            document.getElementById('thumbnailViewBtn')?.addEventListener('click', () => this.switchView('thumbnail'));
            document.getElementById('listViewBtn')?.addEventListener('click', () => this.switchView('list'));

            // Grid size controls
            document.querySelectorAll('.grid-size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.setGridLayout(btn.dataset.size);
                });
            });

            // FIXED: Tab mode toggle - changed from click to change event for checkbox
            document.getElementById('tabModeToggle')?.addEventListener('change', (e) => this.toggleTabMode(e));

            // Action buttons
            document.getElementById('addCustomBtn')?.addEventListener('click', () => this.showQuickAddPopup());
            document.getElementById('sickbayBtn')?.addEventListener('click', () => this.toggleSickbay());
            document.getElementById('clearSickbayBtn')?.addEventListener('click', () => this.clearSickbay());

            // Bookmark all tabs buttons
            document.getElementById('bookmarkAllTabsMain')?.addEventListener('click', () => this.bookmarkAllTabs('main'));
            document.getElementById('bookmarkAllTabsSickbay')?.addEventListener('click', () => this.bookmarkAllTabs('sickbay'));

            // FIXED: Settings menu actions WITHOUT new tab override
            document.getElementById('settingsBtn')?.addEventListener('click', () => this.toggleSettingsDropdown());

            // DISABLED v3.3.4: Undo button removed from UI (add back in future version)
            // document.getElementById('undoBtn')?.addEventListener('click', () => {
            //     this.closeAllDropdowns();
            //     this.performUndo();
            // });

            // Import/Export functionality
            const importBtn = document.getElementById('importBtn');
            const exportBtn = document.getElementById('exportBtn');
            const clearAllSickbayBtn = document.getElementById('clearAllSickbayBtn');
            // DISABLED v3.3.4: Bookmark bar feature removed (add back in future version)
            // const addToBookmarkBarBtn = document.getElementById('addToBookmarkBarBtn');

            if (importBtn) {
                importBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeAllDropdowns();
                    setTimeout(() => this.importData(), 100);
                });
            }
            
            if (exportBtn) {
                exportBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeAllDropdowns();
                    setTimeout(() => this.exportData(), 100);
                });
            }
            
            if (clearAllSickbayBtn) {
                clearAllSickbayBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeAllDropdowns();
                    setTimeout(() => this.clearSickbay(), 100);
                });
            }

            // DISABLED v3.3.4: Bookmark bar button removed from UI (add back in future version)
            // if (addToBookmarkBarBtn) {
            //     addToBookmarkBarBtn.addEventListener('click', (e) => {
            //         e.preventDefault();
            //         e.stopPropagation();
            //         this.closeAllDropdowns();
            //         setTimeout(() => this.addToBookmarkBar(), 100);
            //     });
            // }

            // Close dropdowns when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown-container')) {
                    this.closeAllDropdowns();
                }
            });

            // Search functionality
            const searchInput = document.getElementById('searchInput');
            const searchClear = document.getElementById('searchClear');
            
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
                searchInput.addEventListener('input', (e) => {
                    const clearBtn = document.getElementById('searchClear');
                    if (clearBtn) clearBtn.style.display = e.target.value ? 'flex' : 'none';
                });
            }

            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) searchInput.value = '';
                    this.handleSearch('');
                    searchClear.style.display = 'none';
                });
            }

            // Quick Add Popup handlers
            document.getElementById('quickAddCancel')?.addEventListener('click', () => this.hideQuickAddPopup());
            document.getElementById('quickAddSubmit')?.addEventListener('click', () => this.handleQuickAddSubmit());
            document.getElementById('quickAddForm')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleQuickAddSubmit();
            });

            // Quick add toggles
            document.querySelectorAll('.destination-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.destination-toggle').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.quickAddDestination = btn.dataset.destination;
                });
            });

            document.querySelectorAll('.placement-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.placement-toggle').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.quickAddPlacement = btn.dataset.placement;
                });
            });

            // Empty state buttons
            document.getElementById('emptyStateAddBtn')?.addEventListener('click', () => this.showQuickAddPopup());
            document.getElementById('addToSickbayEmptyBtn')?.addEventListener('click', () => this.addCurrentPage('sickbay'));
            document.getElementById('backToMainBtn')?.addEventListener('click', () => this.toggleSickbay());

            // Enhanced onboarding
            document.getElementById('onboardingNext')?.addEventListener('click', () => this.handleOnboardingNext());
            document.getElementById('onboardingSkip')?.addEventListener('click', () => this.skipOnboarding());
            document.getElementById('onboardingFinish')?.addEventListener('click', () => this.finishOnboarding());

            // Modal handlers
            this.setupModalHandlers();

            // Title input clear button
            const titleInput = document.getElementById('titleInput');
            const titleClearBtn = document.getElementById('titleClearBtn');
            
            if (titleInput && titleClearBtn) {
                titleInput.addEventListener('input', (e) => {
                    titleClearBtn.style.display = e.target.value ? 'flex' : 'none';
                });
                
                titleClearBtn.addEventListener('click', () => {
                    titleInput.value = '';
                    titleClearBtn.style.display = 'none';
                    titleInput.focus();
                });
            }

            // FIXED: Track text editing state
            document.addEventListener('focusin', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
                    this.isEditingText = true;
                }
            });
            
            document.addEventListener('focusout', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
                    this.isEditingText = false;
                }
            });

            // FIXED: Keyboard shortcuts with text editing check
            document.addEventListener('keydown', (e) => this.handleKeydown(e));

            // FIXED: Auto-refresh when storage changes (from popup, context menu, etc.)
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local') {
                    // Check if bookmarks were modified
                    if (changes.hyperLauncherApps || changes.hyperLauncherSickbayApps) {
                        this.loadData().then(() => {
                            this.render();
                            this.updateStats();
                            this.updateSickbayBadge();
                        }).catch(error => {
                            console.error('Failed to refresh after storage change:', error);
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Failed to setup event listeners:', error);
        }
    }

    // ========================================
    // SEARCH AREA - FIXED FOOTER APPROACH
    // ========================================

    // IMPLEMENTATION NOTE: Fixed Footer vs Dynamic Positioning
    //
    // Current implementation: Search area is a fixed footer (always visible at bottom)
    // This ensures search/bookmark buttons are always accessible.
    //
    // Alternative approaches considered but not implemented:
    // 1. Sticky positioning - scrolls with content but sticks to bottom when reached
    // 2. Collapsible panel - user can toggle search area visibility
    // 3. Dynamic absolute positioning - centers between content and footer
    //
    // The dynamic positioning approach was intentionally removed in favor of simplicity.
    // See commit history (commit 3c58427) for the full dynamic positioning implementation
    // if needed for future reference.
    //
    // Current approach prioritizes:
    // - Always-accessible search (ADHD-friendly)
    // - Predictable UI (no movement/surprises)
    // - Simple, maintainable code
    // - Mobile-friendly layout

    // ========================================
    // ENHANCED ONBOARDING
    // ========================================

    handleOnboardingNext() {
        const step1 = document.querySelector('[data-step="1"]');
        const step2 = document.querySelector('[data-step="2"]');
        
        if (step1) step1.classList.remove('active');
        if (step2) step2.classList.add('active');
        
        // Add all browser tabs instead of just current page
        this.bookmarkAllTabs('main');
    }

    skipOnboarding() {
        this.finishOnboarding();
    }

    async finishOnboarding() {
        const onboardingOverlay = document.getElementById('onboardingOverlay');
        if (onboardingOverlay) onboardingOverlay.classList.remove('visible');
        
        await chrome.storage.local.set({ hyperLauncherFirstTime: false });
        this.isFirstTime = false;
    }

    // ========================================
    // FIXED: KEYBOARD SHORTCUTS
    // ========================================
    
    handleKeydown(e) {
        // FIXED: Don't process shortcuts when editing text
        if (this.isEditingText) return;
        
        if (e.key >= '1' && e.key <= '3') {
            e.preventDefault();
            const views = ['grid', 'thumbnail', 'list'];
            const index = parseInt(e.key) - 1;
            if (index < views.length) {
                this.switchView(views[index]);
            }
        }

        if (e.key === 'Escape') {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            this.handleSearch('');
        }

        if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            this.toggleSickbay();
        }

        // DISABLED v3.3.4: Undo keyboard shortcut removed (add back in future version)
        // if (e.ctrlKey || e.metaKey) {
        //     if (e.key === 'z' || e.key === 'Z') {
        //         e.preventDefault();
        //         this.performUndo();
        //     }
        // }
    }

    // ========================================
    // VIEW MANAGEMENT
    // ========================================

    switchView(viewName) {
        this.currentView = viewName;
        this.updateViewControls();

        const currentViewStat = document.getElementById('currentViewStat');
        if (currentViewStat) {
            currentViewStat.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
        }

        this.render();
        this.saveData();
        this.showToast(`Switched to ${viewName} view`, 'success');
    }

    // STEP 1 FIX: Properly apply grid layout classes to container
    setGridLayout(layout) {
        this.gridLayout = layout;
        this.updateViewControls();
        
        // Apply layout class to apps container
        const appsContainer = document.getElementById('appsContainer');
        if (appsContainer) {
            // Remove existing layout classes
            appsContainer.classList.remove('compact', 'comfortable', 'roomy');
            // Add new layout class
            appsContainer.classList.add(layout);
        }
        
        this.render();
        this.saveData();
    }

    // FIXED: Tab mode toggle - updated for checkbox
    toggleTabMode(e) {
        // Get state from checkbox if event provided, otherwise toggle
        if (e && e.target) {
            this.openInBackground = e.target.checked;
        } else {
            this.openInBackground = !this.openInBackground;
        }

        this.updateTabModeIndicator();
        this.saveData();

        const status = this.openInBackground ? 'background' : 'active';
        this.showToast(`Opening links in ${status} tabs`, 'info');
    }

    // FIXED: Update tab mode indicator - updated for checkbox toggle switch
    updateTabModeIndicator() {
        const toggleCheckbox = document.getElementById('tabModeToggle');
        const tabModeStat = document.getElementById('tabModeStat');

        // Update checkbox state
        if (toggleCheckbox) {
            toggleCheckbox.checked = this.openInBackground;
        }

        // Update footer stat text
        if (tabModeStat) {
            tabModeStat.textContent = this.openInBackground ? 'Background' : 'Active';
        }
    }

    toggleSickbay() {
        this.isShowingSickbay = !this.isShowingSickbay;

        const sickbayBtn = document.getElementById('sickbayBtn');
        if (sickbayBtn) {
            if (this.isShowingSickbay) {
                sickbayBtn.classList.add('active');
            } else {
                sickbayBtn.classList.remove('active');
            }
        }

        const clearSickbayBtn = document.getElementById('clearSickbayBtn');
        if (clearSickbayBtn) {
            if (this.isShowingSickbay) {
                clearSickbayBtn.classList.add('visible');
            } else {
                clearSickbayBtn.classList.remove('visible');
            }
        }
        
        this.render();
        this.updateStats();
        
        const message = this.isShowingSickbay ? 'Viewing Sickbay' : 'Back to Main Launcher';
        this.showToast(message, 'info');
    }

    updateSickbayBadge() {
        const sickbayCount = document.getElementById('sickbayCount');
        if (sickbayCount) {
            sickbayCount.textContent = this.sickbayApps.length;
            if (this.sickbayApps.length > 0) {
                sickbayCount.style.display = 'flex';
                sickbayCount.classList.add('visible');
            } else {
                sickbayCount.style.display = 'none';
                sickbayCount.classList.remove('visible');
            }
        }
    }

    // ========================================
    // RENDERING ENGINE
    // ========================================

    render() {
        const grid = document.getElementById('appsGrid');
        const emptyState = document.getElementById('emptyState');
        const sickbayEmptyState = document.getElementById('sickbayEmptyState');
        
        if (!grid || !emptyState || !sickbayEmptyState) {
            console.error('Required DOM elements not found');
            return;
        }
        
        const appsToShow = this.isShowingSickbay ? this.sickbayApps : this.apps;
        
        if (this.searchQuery) {
            const filteredApps = appsToShow.filter(app =>
                app.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                app.url.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
            this.renderApps(grid, filteredApps);
            return;
        }
        
        emptyState.style.display = (!this.isShowingSickbay && appsToShow.length === 0) ? 'block' : 'none';
        emptyState.classList.toggle('visible', !this.isShowingSickbay && appsToShow.length === 0);
        
        sickbayEmptyState.style.display = (this.isShowingSickbay && appsToShow.length === 0) ? 'block' : 'none';
        sickbayEmptyState.classList.toggle('visible', this.isShowingSickbay && appsToShow.length === 0);
        
        if (appsToShow.length === 0) {
            grid.innerHTML = '';
            return;
        }

        this.renderApps(grid, appsToShow);
    }

    renderApps(grid, apps) {
        this.renderGridView(grid, apps);
    }

    renderGridView(container, apps) {
        if (!container) return;

        // FIXED: Apply correct grid layout classes
        container.className = 'apps-grid';
        container.classList.add(this.gridLayout);

        // FIXED: Apply view-specific classes with proper responsive behavior
        if (this.currentView === 'thumbnail') {
            container.classList.add('thumbnail-view');
        } else if (this.currentView === 'list') {
            container.classList.add('list-view');
        }

        container.innerHTML = apps.map((app, index) => this.createAppTile(app, index)).join('');

        // Add event listeners after HTML is created
        // FIXED: Use data-app-id to find correct app instead of relying on index
        container.querySelectorAll('.app-tile').forEach((tile) => {
            const appId = parseInt(tile.getAttribute('data-app-id'));
            const app = apps.find(a => a.id === appId);
            if (app) {
                const index = apps.indexOf(app);
                this.setupTileEventListeners(tile, app, index);
            }
        });
    }

    createAppTile(app, index) {
        // FIXED: Validate app object before rendering
        if (!app || !app.url || !app.title) {
            console.error('Invalid app data in createAppTile:', app);
            return ''; // Return empty string to skip rendering this tile
        }

        // SECURITY FIX: Validate favicon URL to prevent CSS injection
        const shouldShowIcon = app.favIconUrl &&
                               !this.isLocalDomain(app.url) &&
                               this.isSafeFaviconUrl(app.favIconUrl);

        let iconStyle = 'background-color: ' + this.getColorForApp(app) + ';';
        if (shouldShowIcon) {
            try {
                const safeUrl = this.escapeCssUrl(app.favIconUrl);
                iconStyle = `background-image: url('${safeUrl}'); background-size: contain; background-repeat: no-repeat; background-position: center; background-color: transparent;`;
            } catch (error) {
                // Fail-fast: Log error and fall back to emoji icon with colored background
                console.error('Failed to set favicon for app:', app.title, error);
                iconStyle = 'background-color: ' + this.getColorForApp(app) + ';';
            }
        }

        const iconContent = !shouldShowIcon ? this.getIconForApp(app) : '';
        const iconClass = shouldShowIcon ? 'app-icon has-favicon' : 'app-icon';
        
        // Favicon update badge HTML (if applicable)
        const faviconUpdateBadge = app.pendingFaviconUpdate ? `
            <button class="favicon-update-badge"
                    aria-label="Favicon update available"
                    title="Favicon update available - Click to review"
                    style="
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #4CAF50;
                        border: 2px solid #2a2a2a;
                        color: white;
                        font-size: 10px;
                        font-weight: bold;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        z-index: 10;
                        transition: all 0.2s;
                    ">⬆</button>
        ` : '';

        // FIXED: Thumbnail view - clean square tiles with just the icon
        if (this.currentView === 'thumbnail') {
            return `
                <div class="app-tile thumbnail-tile"
                     draggable="true"
                     data-app-id="${app.id}"
                     tabindex="0"
                     title="${this.escapeHtml(app.title)}">
                    <div class="${iconClass}" style="${iconStyle}">${iconContent}</div>
                    <button class="edit-btn" aria-label="Edit bookmark" title="Edit bookmark">✎</button>
                    <button class="delete-btn" aria-label="Delete bookmark">×</button>
                    ${this.isShowingSickbay ? '<button class="move-to-main-btn" aria-label="Move to main" title="Move to main bookmarks (irreversible)">↑</button>' : ''}
                    ${faviconUpdateBadge}
                </div>
            `;
        }

        // Regular grid and list view with full styling
        return `
            <div class="app-tile"
                 draggable="true"
                 data-app-id="${app.id}"
                 tabindex="0">
                <button class="edit-btn" aria-label="Edit bookmark" title="Edit bookmark">✎</button>
                <button class="delete-btn" aria-label="Delete bookmark">×</button>
                ${this.isShowingSickbay ? '<button class="move-to-main-btn" aria-label="Move to main" title="Move to main bookmarks (irreversible)">↑</button>' : ''}
                ${faviconUpdateBadge}
                <div class="${iconClass}" style="${iconStyle}">${iconContent}</div>
                <div class="app-title">${this.escapeHtml(app.title)}</div>
            </div>
        `;
    }

    setupTileEventListeners(tile, app, index) {
        // Click to open
        const handleTileClick = (e) => {
            // For thumbnail view, any click opens the app (no delete/move buttons issue)
            if (this.currentView === 'thumbnail') {
                // Skip if clicking action buttons
                if (e.target.closest('.delete-btn') ||
                    e.target.closest('.move-to-main-btn') ||
                    e.target.closest('.edit-btn')) {
                    return;
                }
                this.openApp(app);
                return;
            }

            // For other views, avoid opening if clicking action buttons
            if (!e.target.closest('.delete-btn') &&
                !e.target.closest('.move-to-main-btn') &&
                !e.target.closest('.edit-btn') &&
                !e.target.classList.contains('app-title')) {
                this.openApp(app);
            }
        };
        
        tile.addEventListener('click', handleTileClick);

        // Edit button
        const editBtn = tile.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEditModal(app);
            });
        }

        // Delete button
        const deleteBtn = tile.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDeleteModal(app);
            });
        }

        // Move to main button
        const moveBtn = tile.querySelector('.move-to-main-btn');
        if (moveBtn) {
            moveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveToMain(app);
            });
        }

        // Favicon update badge
        const faviconUpdateBadge = tile.querySelector('.favicon-update-badge');
        if (faviconUpdateBadge) {
            faviconUpdateBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showFaviconUpdateModal(app);
            });

            // Add hover effect
            faviconUpdateBadge.addEventListener('mouseenter', () => {
                faviconUpdateBadge.style.transform = 'scale(1.1)';
                faviconUpdateBadge.style.background = '#45a049';
            });
            faviconUpdateBadge.addEventListener('mouseleave', () => {
                faviconUpdateBadge.style.transform = 'scale(1)';
                faviconUpdateBadge.style.background = '#4CAF50';
            });
        }

        // Preview on hover
        tile.addEventListener('mouseenter', () => {
            this.handleTileHoverStart(tile, app);
        });

        tile.addEventListener('mouseleave', () => {
            this.handleTileHoverEnd(tile, app);
        });

        // FIXED: Title editing only for non-thumbnail views
        if (this.currentView !== 'thumbnail') {
            const titleEl = tile.querySelector('.app-title');
            if (titleEl) {
                this.setupTitleEditing(titleEl, app);
            }
        }

        // Dragging
        this.setupGridDragging(tile, app, index);
    }

    setupTitleEditing(titleEl, app) {
        titleEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.isEditingText = true; // FIXED: Set editing state
            titleEl.contentEditable = true;
            titleEl.focus();
            
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
        
        const saveTitle = () => {
            const newTitle = titleEl.textContent.trim();
            titleEl.contentEditable = false;
            this.isEditingText = false; // FIXED: Clear editing state
            
            if (newTitle !== app.title) {
                app.title = newTitle || 'Bookmark';
                this.saveData();
            }
            
            titleEl.textContent = app.title;
        };
        
        titleEl.addEventListener('blur', saveTitle);
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveTitle();
            } else if (e.key === 'Escape') {
                titleEl.textContent = app.title;
                titleEl.contentEditable = false;
                this.isEditingText = false; // FIXED: Clear editing state
            }
        });
    }

    setupGridDragging(tile, app, index) {
        tile.addEventListener('dragstart', (e) => {
            this.draggedApp = { app, index, isSickbay: this.isShowingSickbay };
            tile.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        tile.addEventListener('dragend', (e) => {
            tile.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        tile.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedApp || this.draggedApp.app.id === app.id) return;
            tile.classList.add('drag-over');
        });

        tile.addEventListener('dragleave', () => {
            tile.classList.remove('drag-over');
        });

        tile.addEventListener('drop', (e) => {
            e.preventDefault();
            tile.classList.remove('drag-over');
            
            if (!this.draggedApp || this.draggedApp.app.id === app.id) return;
            
            const targetArray = this.isShowingSickbay ? this.sickbayApps : this.apps;
            const draggedArray = this.draggedApp.isSickbay ? this.sickbayApps : this.apps;
            
            if (targetArray === draggedArray) {
                // Reorder within same array
                const draggedIndex = this.draggedApp.index;
                const targetIndex = index;
                
                const [removed] = targetArray.splice(draggedIndex, 1);
                targetArray.splice(targetIndex, 0, removed);
            } else {
                // Move between arrays
                const [removed] = draggedArray.splice(this.draggedApp.index, 1);
                targetArray.splice(index, 0, removed);
            }
            
            this.draggedApp = null;
            this.saveData();
            this.render();
            this.updateSickbayBadge();
        });
    }

    // ========================================
    // MODAL HANDLERS
    // ========================================

    setupModalHandlers() {
        // Add modal
        document.getElementById('addModalClose')?.addEventListener('click', () => this.hideAddModal());
        document.getElementById('addModalCancel')?.addEventListener('click', () => this.hideAddModal());
        document.getElementById('addModalSubmit')?.addEventListener('click', () => this.handleAddSubmit());
        document.getElementById('addForm')?.addEventListener('submit', (e) => this.handleAddSubmit(e));

        // Delete modal
        document.getElementById('deleteModalCancel')?.addEventListener('click', () => this.hideDeleteModal());
        document.getElementById('deleteModalConfirm')?.addEventListener('click', () => this.confirmDelete());

        // Edit modal
        document.getElementById('editModalCancel')?.addEventListener('click', () => this.hideEditModal());
        document.getElementById('editModalSave')?.addEventListener('click', () => this.saveEditedBookmark());
        document.getElementById('editForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditedBookmark();
        });
    }

    showAddModal() {
        const modal = document.getElementById('addModalOverlay');
        if (modal) {
            modal.classList.add('visible');
            setTimeout(() => {
                document.getElementById('urlInput')?.focus();
            }, 100);
        }
        this.closeAllDropdowns();
    }

    hideAddModal() {
        const modal = document.getElementById('addModalOverlay');
        if (modal) {
            modal.classList.remove('visible');
        }
        
        // Reset form
        const form = document.getElementById('addForm');
        if (form) {
            form.reset();
        }
    }

    async handleAddSubmit(e) {
        if (e) e.preventDefault();
        
        const urlInput = document.getElementById('urlInput');
        const titleInput = document.getElementById('titleInput');
        const destinationRadio = document.querySelector('input[name="destination"]:checked');
        
        if (!urlInput || !destinationRadio) return;
        
        let url = urlInput.value.trim();
        const title = titleInput ? titleInput.value.trim() : '';
        const destination = destinationRadio.value;
        
        if (!url) return;

        // Auto-add https if no protocol
        if (!url.match(/^https?:\/\//)) {
            url = 'https://' + url;
        }

        await this.addBookmark(url, title, destination);
        this.hideAddModal();
    }

    showDeleteModal(app) {
        this.appToDelete = app;
        const deleteBookmarkName = document.getElementById('deleteBookmarkName');
        const deleteModalOverlay = document.getElementById('deleteModalOverlay');
        
        if (deleteBookmarkName) deleteBookmarkName.textContent = app.title;
        if (deleteModalOverlay) deleteModalOverlay.classList.add('visible');
    }

    hideDeleteModal() {
        const deleteModalOverlay = document.getElementById('deleteModalOverlay');
        if (deleteModalOverlay) deleteModalOverlay.classList.remove('visible');
        this.appToDelete = null;
    }

    confirmDelete() {
        if (!this.appToDelete) return;

        const targetArray = this.isShowingSickbay ? this.sickbayApps : this.apps;
        const index = targetArray.findIndex(app => app.id === this.appToDelete.id);

        if (index !== -1) {
            targetArray.splice(index, 1);

            this.saveData();
            this.render();
            this.updateSickbayBadge();
            this.updateStats();
            this.showToast(`Deleted ${this.appToDelete.title}`, 'success');
        }

        this.hideDeleteModal();
    }

    // ========================================
    // EDIT BOOKMARK MODAL
    // ========================================

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

    // ========================================
    // VALIDATION ERROR MODAL
    // ========================================

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

    // ========================================
    // QUICK ADD POPUP
    // ========================================

    showQuickAddPopup() {
        const popup = document.getElementById('quickAddPopup');
        if (popup) {
            popup.classList.add('visible');
            setTimeout(() => {
                document.getElementById('quickAddUrl')?.focus();
            }, 100);
        }
        this.closeAllDropdowns();
    }

    hideQuickAddPopup() {
        const popup = document.getElementById('quickAddPopup');
        if (popup) {
            popup.classList.remove('visible');
        }
        
        // Reset form
        const form = document.getElementById('quickAddForm');
        if (form) {
            form.reset();
        }
    }

    async handleQuickAddSubmit() {
        const urlInput = document.getElementById('quickAddUrl');
        const nameInput = document.getElementById('quickAddName');
        
        if (!urlInput) return;
        
        let url = urlInput.value.trim();
        const title = nameInput ? nameInput.value.trim() : '';
        
        if (!url) return;

        // Auto-add https if no protocol
        if (!url.match(/^https?:\/\//)) {
            url = 'https://' + url;
        }

        await this.addBookmark(url, title, this.quickAddDestination, this.quickAddPlacement);
        this.hideQuickAddPopup();
    }

    // ========================================
    // APP MANAGEMENT
    // ========================================

    async bookmarkAllTabs(destination = 'main') {
        try {
            // Only get tabs from current window
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const targetArray = destination === 'sickbay' ? this.sickbayApps : this.apps;
            let added = 0;
            let baseTimestamp = Date.now();

            for (const tab of tabs) {
                if (this.isSpecialPage(tab.url)) continue;

                // Check if already exists
                if (targetArray.some(app => app.url === tab.url)) continue;

                // FIXED: Generate unique integer IDs by incrementing timestamp
                const newApp = {
                    id: baseTimestamp++,
                    url: tab.url,
                    title: tab.title || this.extractTitleFromUrl(tab.url),
                    createdAt: Date.now(),
                    favIconUrl: tab.favIconUrl,
                    faviconLastUpdated: Date.now(),
                    preserveOriginal: true, // FIXED: Mark browser tab favicons as preserved
                    faviconSource: 'browser_tab'
                };

                targetArray.unshift(newApp);
                added++;
            }

            if (added > 0) {
                await this.saveData();
                this.render();
                this.updateStats();
                this.updateSickbayBadge();

                const dest = destination === 'sickbay' ? 'Sickbay' : 'Main Launcher';
                this.showToast(`Added ${added} tab${added > 1 ? 's' : ''} to ${dest}`, 'success');
            } else {
                this.showToast('No new tabs to add', 'info');
            }

        } catch (error) {
            console.error('Failed to bookmark all tabs:', error);
            this.showToast('Failed to bookmark tabs', 'error');
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
            
            // Check if already exists
            if (targetArray.some(app => app.url === tab.url)) {
                this.showToast('Page already bookmarked', 'warning');
                return;
            }
            
            const newApp = {
                id: Date.now(),
                url: tab.url,
                title: tab.title || this.extractTitleFromUrl(tab.url),
                createdAt: Date.now(),
                favIconUrl: tab.favIconUrl,
                faviconLastUpdated: Date.now(),
                preserveOriginal: true, // FIXED: Mark browser tab favicons as preserved
                faviconSource: 'browser_tab'
            };
            
            targetArray.unshift(newApp);
            await this.saveData();
            this.render();
            this.updateStats();
            this.updateSickbayBadge();
            
            const dest = destination === 'sickbay' ? 'Sickbay' : 'Main Launcher';
            this.showToast(`Added to ${dest}!`, 'success');
            
        } catch (error) {
            console.error('Failed to add current page:', error);
            this.showToast('Failed to add bookmark', 'error');
        }
    }

    async addBookmark(url, title = '', destination = 'main', placement = 'front') {
        if (!this.isValidUrl(url)) {
            this.showToast('Invalid URL', 'error');
            return;
        }
        
        const targetArray = destination === 'sickbay' ? this.sickbayApps : this.apps;
        
        // Check if already exists
        if (targetArray.some(app => app.url === url)) {
            this.showToast('URL already bookmarked', 'warning');
            return;
        }
        
        const newApp = {
            id: Date.now(),
            url: url,
            title: title || this.extractTitleFromUrl(url),
            createdAt: Date.now(),
            favIconUrl: null,
            faviconLastUpdated: Date.now(),
            preserveOriginal: false, // FIXED: Custom added bookmarks can be refreshed
            faviconSource: 'none'
        };
        
        // Try to get favicon
        await this.refreshFavicon(newApp);
        
        // Add to array
        if (placement === 'front') {
            targetArray.unshift(newApp);
        } else {
            targetArray.push(newApp);
        }
        
        await this.saveData();
        this.render();
        this.updateStats();
        this.updateSickbayBadge();
        
        const dest = destination === 'sickbay' ? 'Sickbay' : 'Main Launcher';
        this.showToast(`Added ${newApp.title} to ${dest}`, 'success');
    }

    async openApp(app) {
        try {
            let tabId;

            // Feature 2: Open in current tab when background mode is OFF
            if (!this.openInBackground) {
                // Get current tab and navigate to bookmark URL
                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (currentTab) {
                    await chrome.tabs.update(currentTab.id, { url: app.url });
                    tabId = currentTab.id;
                } else {
                    // Fallback: create new tab if no current tab found
                    const tab = await chrome.tabs.create({ url: app.url, active: true });
                    tabId = tab.id;
                }
            } else {
                // Normal behavior: create new background tab
                const tab = await chrome.tabs.create({
                    url: app.url,
                    active: false
                });
                tabId = tab.id;
            }

            // Feature 1: Monitor tab for favicon if bookmark has no favicon or needs regeneration
            if (!app.favIconUrl || app.needsRegeneration) {
                this.monitorTabForFavicon(tabId, app);

                // Clear needsRegeneration flag
                if (app.needsRegeneration) {
                    app.needsRegeneration = false;
                }
            }

            // Update last used timestamp
            app.lastUsed = Date.now();
            await this.saveData();
        } catch (error) {
            console.error('Failed to open app:', error);
            this.showToast('Failed to open bookmark', 'error');
        }
    }

    /**
     * Monitor a tab for favicon capture
     * Once tab loads, capture the real favicon from browser
     */
    monitorTabForFavicon(tabId, app) {
        const listener = (updatedTabId, changeInfo, tab) => {
            // Only process the tab we're monitoring
            if (updatedTabId !== tabId) return;

            // Wait for tab to complete loading
            if (changeInfo.status === 'complete' && tab.favIconUrl) {
                // Capture favicon from loaded tab
                app.favIconUrl = tab.favIconUrl;
                app.faviconLastUpdated = Date.now();
                app.faviconSource = 'browser_tab';
                app.preserveOriginal = true; // Mark as preserved since it came from browser

                // Save and re-render
                this.saveData();
                this.render();

                // Remove listener after capturing
                chrome.tabs.onUpdated.removeListener(listener);
            }
        };

        // Add listener
        chrome.tabs.onUpdated.addListener(listener);

        // Auto-cleanup listener after 30 seconds (in case tab never loads)
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
        }, 30000);
    }

    moveToMain(app) {
        const index = this.sickbayApps.findIndex(a => a.id === app.id);
        if (index !== -1) {
            const [movedApp] = this.sickbayApps.splice(index, 1);
            this.apps.unshift(movedApp);
            
            this.saveData();
            this.render();
            this.updateStats();
            this.updateSickbayBadge();
            this.showToast(`Moved ${app.title} to main launcher`, 'success');
        }
    }

    clearSickbay() {
        if (this.sickbayApps.length === 0) {
            this.showToast('Sickbay is already empty', 'info');
            return;
        }

        const confirmed = confirm(`Clear all ${this.sickbayApps.length} items from Sickbay?`);
        if (!confirmed) return;

        this.sickbayApps = [];
        this.saveData();
        this.render();
        this.updateStats();
        this.updateSickbayBadge();
        this.showToast('Sickbay cleared', 'success');
        this.closeAllDropdowns();
    }

    handleSearch(query) {
        this.searchQuery = query.trim();
        this.render();
    }

    // ========================================
    // STATS AND UI UPDATES
    // ========================================

    updateStats() {
        const totalBookmarks = document.getElementById('totalBookmarks');
        const sickbayBookmarks = document.getElementById('sickbayBookmarks');
        const currentViewStat = document.getElementById('currentViewStat');
        const tabModeStat = document.getElementById('tabModeStat');
        
        if (totalBookmarks) totalBookmarks.textContent = this.apps.length;
        if (sickbayBookmarks) {
            sickbayBookmarks.textContent = this.sickbayApps.length;
            sickbayBookmarks.classList.toggle('has-sickbay', this.sickbayApps.length > 0);
        }
        if (currentViewStat) currentViewStat.textContent = this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1);
        if (tabModeStat) tabModeStat.textContent = this.openInBackground ? 'Background' : 'Active';
    }

    // ========================================
    // FIXED: FAVICON MANAGEMENT
    // ========================================

    async refreshFavicon(app) {
        // SECURITY: Rate limit individual favicon refreshes
        if (!this.rateLimiters.faviconRefresh.tryCall()) {
            console.warn('Favicon refresh rate limit exceeded for:', app.title);
            return false; // Indicate rate limit hit
        }

        try {
            // FIXED: Don't refresh favicons that are marked as preserved
            if (app.preserveOriginal && app.favIconUrl) {
                app.faviconLastUpdated = Date.now(); // Update timestamp without changing URL
                return true;
            }

            const hostname = new URL(app.url).hostname;
            const faviconUrl = `https://${hostname}/favicon.ico`;

            // Test if favicon exists
            const response = await fetch(faviconUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'force-cache'
            });

            app.favIconUrl = faviconUrl;
            app.faviconLastUpdated = Date.now();
            app.faviconSource = 'direct_favicon';
            return true;

        } catch (error) {
            // Favicon not available, keep as null
            app.favIconUrl = null;
            app.faviconLastUpdated = Date.now();
            app.faviconSource = 'none';
            return true;
        }
    }

    async refreshAllFavicons() {
        // SECURITY: Rate limit bulk favicon operations
        if (!this.rateLimiters.bulkFavicon.tryCall()) {
            console.warn('Bulk favicon refresh rate limit exceeded, skipping');
            return;
        }

        const allApps = [...this.apps, ...this.sickbayApps];
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        let refreshed = 0;
        let rateLimited = 0;

        for (const app of allApps) {
            if (!app.faviconLastUpdated || app.faviconLastUpdated < oneWeekAgo) {
                // FIXED: Preserve original browser favicons
                if (app.preserveOriginal && app.favIconUrl) {
                    app.faviconLastUpdated = Date.now(); // Update timestamp only
                } else {
                    const success = await this.refreshFavicon(app);
                    if (success) {
                        refreshed++;
                    } else {
                        rateLimited++;
                    }
                }

                // Additional rate limiting: pause every 5 requests
                if (refreshed % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        if (refreshed > 0) {
            await this.saveData();
            this.render();
        }
    }

    // FIXED: Add data migration for existing bookmarks
    async migrateFaviconData() {
        const allApps = [...this.apps, ...this.sickbayApps];
        let migrated = 0;
        
        for (const app of allApps) {
            if (!app.hasOwnProperty('preserveOriginal')) {
                // Mark existing bookmarks as preserved if they have favicons
                app.preserveOriginal = !!(app.favIconUrl && app.faviconSource === 'browser_tab');
                migrated++;
            }
        }
        
        if (migrated > 0) {
            await this.saveData();
        }
    }

    isLocalDomain(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname === 'localhost' ||
                   hostname === '127.0.0.1' ||
                   hostname === '0.0.0.0' ||
                   hostname.includes('.local') ||
                   hostname.includes('.dev');
        } catch (error) {
            console.warn(`Local domain check failed for "${url}":`, error.message);
            return false;
        }
    }

    // ========================================
    // FAVICON UPDATE DETECTION
    // ========================================

    /**
     * Check if a specific app has a favicon update available
     * Compares current favicon with live favicon from website
     */
    async checkForFaviconUpdate(app) {
        // Prevent duplicate checks for same app
        if (this.pendingFaviconChecks.has(app.id)) {
            return;
        }

        // Don't check apps that explicitly preserve their favicon
        if (app.preserveOriginal) {
            return;
        }

        // Must have existing favicon to detect changes
        if (!app.favIconUrl) {
            return;
        }

        this.pendingFaviconChecks.set(app.id, true);

        try {
            const hostname = new URL(app.url).hostname;
            const newFaviconUrl = `https://${hostname}/favicon.ico`;

            // Skip if it's already the same URL
            if (app.favIconUrl === newFaviconUrl) {
                return;
            }

            // Verify new favicon exists and is accessible
            const response = await fetch(newFaviconUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'reload' // Force fresh check, don't use cache
            });

            // Check if we already have this update pending
            const existingUpdate = this.faviconUpdates.find(update => update.app.id === app.id);
            if (existingUpdate) {
                // Update the newFaviconUrl if it changed again
                existingUpdate.newFaviconUrl = newFaviconUrl;
                existingUpdate.detectedAt = Date.now();
            } else {
                // Add new update to queue
                this.faviconUpdates.push({
                    app: app,
                    oldFaviconUrl: app.favIconUrl,
                    newFaviconUrl: newFaviconUrl,
                    detectedAt: Date.now()
                });

                // Mark app as having pending update
                app.pendingFaviconUpdate = true;
            }

            this.render(); // Re-render to show badge
            this.showToast(`Favicon update available for ${app.title}`, 'info');

        } catch (error) {
            // Failed to fetch new favicon - not an error, just no update available
            console.warn(`Favicon check failed for ${app.title}:`, error.message);
        } finally {
            this.pendingFaviconChecks.delete(app.id);
        }
    }

    /**
     * Check all bookmarks for favicon updates
     * Rate limited to prevent overwhelming the network
     */
    async checkAllFaviconsForUpdates() {
        const allApps = [...this.apps, ...this.sickbayApps];
        let checked = 0;

        this.showToast('Checking for favicon updates...', 'info');

        for (const app of allApps) {
            // Skip apps without favicons or with preserved favicons
            if (!app.favIconUrl || app.preserveOriginal) {
                continue;
            }

            await this.checkForFaviconUpdate(app);
            checked++;

            // Rate limiting: pause every 5 checks
            if (checked % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        if (this.faviconUpdates.length > 0) {
            this.showToast(`Found ${this.faviconUpdates.length} favicon updates`, 'success');
        } else {
            this.showToast('All favicons are up to date', 'success');
        }
    }

    /**
     * Apply a favicon update (user accepted)
     */
    async applyFaviconUpdate(update) {
        const app = update.app;
        app.favIconUrl = update.newFaviconUrl;
        app.faviconLastUpdated = Date.now();
        app.faviconSource = 'direct_favicon';
        delete app.pendingFaviconUpdate;

        // Remove from updates queue
        const index = this.faviconUpdates.findIndex(u => u.app.id === app.id);
        if (index !== -1) {
            this.faviconUpdates.splice(index, 1);
        }

        await this.saveData();
        this.render();
        this.showToast(`Updated favicon for ${app.title}`, 'success');
    }

    /**
     * Reject a favicon update (user wants to keep current)
     */
    rejectFaviconUpdate(update) {
        const app = update.app;
        delete app.pendingFaviconUpdate;

        // Remove from updates queue
        const index = this.faviconUpdates.findIndex(u => u.app.id === app.id);
        if (index !== -1) {
            this.faviconUpdates.splice(index, 1);
        }

        // Mark as preserved so it won't be checked again
        app.preserveOriginal = true;

        this.saveData();
        this.render();
        this.showToast(`Keeping current favicon for ${app.title}`, 'info');
    }

    /**
     * Show modal comparing old vs new favicon
     */
    showFaviconUpdateModal(app) {
        const update = this.faviconUpdates.find(u => u.app.id === app.id);
        if (!update) return;

        // Create modal dynamically
        const modal = document.createElement('div');
        modal.className = 'modal-overlay favicon-update-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: #2a2a2a;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            ">
                <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px;">
                    Favicon Update Available
                </h3>

                <p style="margin: 0 0 20px 0; color: #b0b0b0;">
                    <strong>${this.escapeHtml(app.title)}</strong> has a new favicon. Would you like to update?
                </p>

                <div style="display: flex; gap: 40px; justify-content: center; margin-bottom: 24px;">
                    <div style="text-align: center;">
                        <div style="color: #888; margin-bottom: 8px; font-size: 12px;">CURRENT</div>
                        <div style="
                            width: 80px;
                            height: 80px;
                            border-radius: 8px;
                            background: url('${this.escapeCssUrl(update.oldFaviconUrl)}') center/contain no-repeat;
                            border: 2px solid #444;
                        "></div>
                    </div>

                    <div style="text-align: center;">
                        <div style="color: #888; margin-bottom: 8px; font-size: 12px;">NEW</div>
                        <div style="
                            width: 80px;
                            height: 80px;
                            border-radius: 8px;
                            background: url('${this.escapeCssUrl(update.newFaviconUrl)}') center/contain no-repeat;
                            border: 2px solid #4CAF50;
                        "></div>
                    </div>
                </div>

                <div style="display: flex; gap: 12px;">
                    <button id="faviconUpdateReject" style="
                        flex: 1;
                        padding: 12px;
                        border-radius: 8px;
                        border: 1px solid #555;
                        background: #3a3a3a;
                        color: #ffffff;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">Keep Current</button>

                    <button id="faviconUpdateAccept" style="
                        flex: 1;
                        padding: 12px;
                        border-radius: 8px;
                        border: none;
                        background: #4CAF50;
                        color: #ffffff;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">Update Favicon</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add hover effects
        const acceptBtn = modal.querySelector('#faviconUpdateAccept');
        const rejectBtn = modal.querySelector('#faviconUpdateReject');

        acceptBtn.addEventListener('mouseenter', () => acceptBtn.style.background = '#45a049');
        acceptBtn.addEventListener('mouseleave', () => acceptBtn.style.background = '#4CAF50');

        rejectBtn.addEventListener('mouseenter', () => rejectBtn.style.background = '#4a4a4a');
        rejectBtn.addEventListener('mouseleave', () => rejectBtn.style.background = '#3a3a3a');

        // Event handlers
        acceptBtn.addEventListener('click', () => {
            this.applyFaviconUpdate(update);
            document.body.removeChild(modal);
        });

        rejectBtn.addEventListener('click', () => {
            this.rejectFaviconUpdate(update);
            document.body.removeChild(modal);
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    /**
     * Start periodic background checks for favicon updates
     * Runs once per day
     */
    startPeriodicFaviconUpdateChecks() {
        const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        // Check immediately after 5 minutes (to avoid slowing down initial load)
        setTimeout(() => {
            this.checkAllFaviconsForUpdates();
        }, 5 * 60 * 1000); // 5 minutes

        // Then check once per day
        setInterval(() => {
            this.checkAllFaviconsForUpdates();
        }, ONE_DAY);
    }

    // ========================================
    // PREVIEW SYSTEM
    // ========================================

    /**
     * Handle tile hover start - initiate preview display after delay
     */
    handleTileHoverStart(tile, app) {
        // Cancel any existing timer for this app
        if (this.previewHoverTimers.has(app.id)) {
            clearTimeout(this.previewHoverTimers.get(app.id));
        }

        // Start 500ms timer to show preview
        const timer = setTimeout(() => {
            this.showPreviewTooltip(tile, app);
        }, 500);

        this.previewHoverTimers.set(app.id, timer);
    }

    /**
     * Handle tile hover end - cancel preview display and hide tooltip
     */
    handleTileHoverEnd(tile, app) {
        // Cancel timer if it hasn't fired yet
        if (this.previewHoverTimers.has(app.id)) {
            clearTimeout(this.previewHoverTimers.get(app.id));
            this.previewHoverTimers.delete(app.id);
        }

        // Hide tooltip if it's currently shown
        this.hidePreviewTooltip();
    }

    /**
     * Show preview tooltip for a bookmark
     */
    async showPreviewTooltip(tile, app) {
        // Hide any existing tooltip
        this.hidePreviewTooltip();

        // Get tile position for tooltip placement
        const rect = tile.getBoundingClientRect();

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'preview-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            top: ${rect.top + rect.height + 10}px;
            left: ${rect.left}px;
            background: #2a2a2a;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
            z-index: 10001;
            width: 320px;
        `;

        // Format URL for display (remove protocol, truncate if needed)
        let displayUrl = app.url.replace(/^https?:\/\//, '');
        if (displayUrl.length > 50) {
            displayUrl = displayUrl.substring(0, 47) + '...';
        }

        // Format last used time
        let lastUsedText = 'Never visited';
        if (app.lastUsed) {
            const now = Date.now();
            const diff = now - app.lastUsed;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor(diff / (1000 * 60));

            if (days > 0) {
                lastUsedText = `${days} day${days > 1 ? 's' : ''} ago`;
            } else if (hours > 0) {
                lastUsedText = `${hours} hour${hours > 1 ? 's' : ''} ago`;
            } else if (minutes > 0) {
                lastUsedText = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            } else {
                lastUsedText = 'Just now';
            }
        }

        // Create preview card with metadata
        tooltip.innerHTML = `
            <div style="position: relative;">
                <button class="preview-close-btn" style="
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: none;
                    background: #444;
                    color: #fff;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    z-index: 1;
                    padding: 0;
                    line-height: 1;
                ">×</button>

                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #444;
                ">
                    ${app.favIconUrl ? `
                        <img src="${app.favIconUrl}"
                             style="width: 32px; height: 32px; border-radius: 4px;"
                             alt="Favicon">
                    ` : `
                        <div style="
                            width: 32px;
                            height: 32px;
                            border-radius: 4px;
                            background: #1a1a1a;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #666;
                            font-size: 16px;
                            font-weight: 600;
                        ">${this.escapeHtml(app.title.charAt(0).toUpperCase())}</div>
                    `}
                    <div style="flex: 1; min-width: 0;">
                        <div style="
                            color: #fff;
                            font-size: 14px;
                            font-weight: 500;
                            margin-bottom: 4px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        ">${this.escapeHtml(app.title)}</div>
                        <div style="
                            color: #888;
                            font-size: 11px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        ">${this.escapeHtml(displayUrl)}</div>
                    </div>
                </div>

                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 12px;
                    padding: 12px;
                    background: #1a1a1a;
                    border-radius: 6px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #888; font-size: 12px;">Last visited</span>
                        <span style="color: #b0b0b0; font-size: 12px;">${lastUsedText}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #888; font-size: 12px;">Created</span>
                        <span style="color: #b0b0b0; font-size: 12px;">${new Date(app.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <button class="preview-open-btn" style="
                    width: 100%;
                    padding: 10px;
                    border-radius: 6px;
                    border: none;
                    background: #4CAF50;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Open Bookmark</button>
            </div>
        `;

        // Wire up close button
        const closeBtn = tooltip.querySelector('.preview-close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hidePreviewTooltip();
        });
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#555');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = '#444');

        // Wire up open button
        const openBtn = tooltip.querySelector('.preview-open-btn');
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hidePreviewTooltip();
            this.openApp(app);
        });
        openBtn.addEventListener('mouseenter', () => openBtn.style.background = '#45a049');
        openBtn.addEventListener('mouseleave', () => openBtn.style.background = '#4CAF50');

        // Prevent tooltip from closing when clicking inside it
        tooltip.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.body.appendChild(tooltip);
        this.activePreviewTooltip = tooltip;

        // Add click-outside-to-close listener
        this.setupPreviewOutsideClick();
    }

    /**
     * Setup click-outside-to-close functionality for preview tooltip
     */
    setupPreviewOutsideClick() {
        // Remove existing listener if any
        if (this.previewOutsideClickHandler) {
            document.removeEventListener('click', this.previewOutsideClickHandler);
        }

        // Create new handler
        this.previewOutsideClickHandler = (e) => {
            // Check if click is outside the tooltip
            if (this.activePreviewTooltip && !this.activePreviewTooltip.contains(e.target)) {
                // Check if click is on a tile (to prevent immediate re-opening)
                const clickedTile = e.target.closest('.app-tile');
                if (!clickedTile) {
                    this.hidePreviewTooltip();
                }
            }
        };

        // Add listener with slight delay to prevent immediate triggering
        setTimeout(() => {
            document.addEventListener('click', this.previewOutsideClickHandler);
        }, 100);
    }

    /**
     * Hide the active preview tooltip
     */
    hidePreviewTooltip() {
        if (this.activePreviewTooltip && this.activePreviewTooltip.parentNode) {
            this.activePreviewTooltip.parentNode.removeChild(this.activePreviewTooltip);
            this.activePreviewTooltip = null;
        }

        // Remove outside click listener
        if (this.previewOutsideClickHandler) {
            document.removeEventListener('click', this.previewOutsideClickHandler);
            this.previewOutsideClickHandler = null;
        }
    }


    // ========================================
    // SECURITY: Prototype Pollution Protection
    // ========================================

    // SECURITY: Safe deep clone to prevent prototype pollution
    // Removes dangerous keys (__proto__, constructor, prototype)
    safeDeepClone(obj, maxDepth = 10, currentDepth = 0) {
        // Prevent infinite recursion
        if (currentDepth >= maxDepth) {
            throw new Error('Max depth exceeded in object cloning');
        }

        // Handle primitives and null
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        // Use structuredClone if available (modern browsers)
        if (typeof structuredClone === 'function' && currentDepth === 0) {
            try {
                const cloned = structuredClone(obj);
                return this.stripDangerousKeys(cloned);
            } catch (e) {
                // Fallback to manual cloning
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
            // Skip dangerous keys
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                console.warn('Blocked dangerous key during import:', key);
                continue;
            }

            // Only copy own properties
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
        // Fail-fast validation
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

        // Optional fields validation
        if (bookmark.favIconUrl !== null && bookmark.favIconUrl !== undefined) {
            if (typeof bookmark.favIconUrl !== 'string') {
                throw new TypeError('Bookmark.favIconUrl must be a string or null');
            }
        }

        // Return sanitized bookmark with only allowed fields
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

    // ========================================
    // IMPORT/EXPORT
    // ========================================

    async exportData() {
        try {
            const data = {
                version: chrome.runtime.getManifest().version,
                exportDate: new Date().toISOString(),
                apps: this.apps,
                sickbayApps: this.sickbayApps,
                settings: {
                    currentView: this.currentView,
                    gridLayout: this.gridLayout,
                    openInBackground: this.openInBackground
                }
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `hyper-launcher-backup-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showToast('Data exported successfully!', 'success');
            this.closeAllDropdowns();
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
                    const validLayouts = ['compact', 'comfortable', 'roomy'];

                    this.currentView = validViews.includes(data.settings.currentView)
                        ? data.settings.currentView
                        : 'grid';
                    this.gridLayout = validLayouts.includes(data.settings.gridLayout)
                        ? data.settings.gridLayout
                        : 'comfortable';
                    this.openInBackground = data.settings.openInBackground !== false;
                }

                await this.saveData();
                this.render();
                this.updateStats();
                this.updateSickbayBadge();
                this.updateViewControls();

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
                // Show specific error message for better debugging
                this.showToast(`Failed to import: ${error.message}`, 'error');
            }
        });

        input.click();
        this.closeAllDropdowns();
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    getIconForApp(app) {
        // FIXED: Validate app.url exists before using it
        if (!app || !app.url || typeof app.url !== 'string') {
            console.error('Invalid app data in getIconForApp:', app);
            return '🔗'; // Default fallback icon
        }

        const domain = app.url.toLowerCase();

        const icons = {
            'google.com': '🔍',
            'github.com': '🐙',
            'stackoverflow.com': '💻',
            'youtube.com': '📺',
            'facebook.com': '📘',
            'linkedin.com': '💼',
            'twitter.com': '🐦',
            'instagram.com': '📷',
            'netflix.com': '🎬',
            'amazon.com': '📦',
            'gmail.com': '📧',
            'outlook.com': '📧',
            'slack.com': '💬',
            'discord.com': '💬',
            'spotify.com': '🎵',
            'apple.com': '🍎',
            'microsoft.com': '🪟',
            'wikipedia.org': '📚',
            'reddit.com': '🔴',
            'twitch.tv': '🎮',
            'pinterest.com': '📌',
            'dropbox.com': '📁',
            'drive.google.com': '💾',
            'notion.so': '📝',
            'figma.com': '🎨',
            'canva.com': '🎨',
            'adobe.com': '🎨',
            'developer.mozilla.org': '🔧',
            'stackoverflow.com': '💻',
            'codepen.io': '✏️',
            'jsbin.com': '✏️'
        };

        for (const [key, icon] of Object.entries(icons)) {
            if (domain.includes(key)) {
                return icon;
            }
        }

        // Fallback based on URL patterns
        if (domain.includes('blog') || domain.includes('medium')) return '📝';
        if (domain.includes('news') || domain.includes('cnn') || domain.includes('bbc')) return '📰';
        if (domain.includes('shop') || domain.includes('store')) return '🛒';
        if (domain.includes('bank') || domain.includes('finance')) return '🏦';
        if (domain.includes('edu') || domain.includes('university')) return '🎓';
        if (domain.includes('gov')) return '🏛️';
        if (domain.includes('doc') || domain.includes('pdf')) return '📄';

        return '🔗';
    }

    // Generate a unique color for tiles without favicons based on URL
    getColorForApp(app) {
        // FIXED: Validate app data exists before using it
        if (!app) {
            console.error('Invalid app data in getColorForApp:', app);
            return 'hsl(200, 50%, 40%)'; // Default blue color
        }

        // Create a simple hash from the URL or title
        let hash = 0;
        const str = app.url || app.title || 'default';
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash; // Convert to 32bit integer
        }

        // Generate a pleasant color palette (avoiding too dark or too bright colors)
        const hue = Math.abs(hash % 360);
        const saturation = 45 + (Math.abs(hash) % 25); // 45-70%
        const lightness = 35 + (Math.abs(hash >> 8) % 15); // 35-50%

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    getTitleFromUrl(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
            const hostname = urlObj.hostname.replace('www.', '');
            return hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
        } catch (error) {
            console.warn(`Title extraction failed for "${url}":`, error.message);
            return 'Bookmark';
        }
    }

    extractTitleFromUrl(url) {
        return this.getTitleFromUrl(url);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // SECURITY: Sanitize text to prevent XSS
    sanitizeText(text) {
        if (typeof text !== 'string') {
            return '';
        }
        // Replace potentially dangerous characters with HTML entities
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    isValidUrl(url) {
        if (!url) return false;

        const invalidPatterns = [
            /^chrome:\/\//,
            /^chrome-extension:\/\//,
            /^edge:\/\//,
            /^about:/,
            /^file:\/\//,
            /^data:/,
            /^blob:/
        ];

        if (invalidPatterns.some(pattern => pattern.test(url))) {
            return false;
        }

        try {
            new URL(url.match(/^https?:\/\//) ? url : 'https://' + url);
            return true;
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

    // ========================================
    // DROPDOWN AND UI MANAGEMENT
    // ========================================

    toggleSettingsDropdown() {
        const dropdown = document.getElementById('settingsDropdown');
        if (dropdown) {
            dropdown.classList.toggle('visible');
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.dropdown-content').forEach(dropdown => {
            dropdown.classList.remove('visible');
        });
    }

    // ========================================
    // FIXED: TOAST NOTIFICATIONS
    // ========================================

    showToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.toast-notification').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        
        const typeColors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800',
            info: '#2196F3'
        };
        
        const typeIcons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        // Create simple, working toast
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = '#2a2a2a';
        toast.style.color = 'white';
        toast.style.padding = '12px 16px';
        toast.style.borderRadius = '8px';
        toast.style.borderLeft = `4px solid ${typeColors[type]}`;
        toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        toast.style.zIndex = '999999';
        toast.style.minWidth = '250px';
        toast.style.maxWidth = '400px';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '500';
        toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '8px';
        toast.style.transform = 'translateX(calc(100% + 40px))';
        toast.style.transition = 'transform 0.3s ease';
        
        // Simple content
        toast.innerHTML = `
            <span style="font-size: 16px;">${typeIcons[type] || typeIcons.info}</span>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Auto-hide
        setTimeout(() => {
            toast.style.transform = 'translateX(calc(100% + 40px))';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // ========================================
    // UNDO SYSTEM
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
        this.updateStats();
        this.updateSickbayBadge();
        
        this.showToast(`Undid: ${lastState.action}`, 'success');
    }

    // ========================================
    // ONBOARDING CHECK
    // ========================================

    checkOnboarding() {
        if (this.isFirstTime && this.apps.length === 0) {
            const onboardingOverlay = document.getElementById('onboardingOverlay');
            if (onboardingOverlay) {
                onboardingOverlay.classList.add('visible');
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new HyperLauncherFullPage();
});
