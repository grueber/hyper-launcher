// Background Service Worker for Hyper Launcher v3.2.5 - PRODUCTION BUG FIX
// Fixed: Popup first-run initialization (waits for background worker)
// Fixed: bookmarkAllTabs generating invalid decimal IDs
// Fixed: Null safety in utility functions (getIconForApp, getColorForApp, createAppTile)
// Fixed: First-run initialization race condition
// Fixed: chrome.alarms moved to required permissions
// Fixed: chrome.contextMenus API availability check
// Enhanced with Optional New Tab Override and Bookmark Bar functionality

class HyperLauncherBackground {
    constructor() {
        this.isInitialized = false;
        this.contextMenusCreated = false;
        this.analytics = {
            sessionsCount: 0,
            bookmarksAdded: 0,
            viewsSwitched: 0,
            errorsEncountered: 0
        };
        this.recentEvents = [];
        this.maxRecentEvents = 50;
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            await this.loadAnalytics();
            this.setupEventListeners();
            this.createContextMenus();
            this.setupAlarms();
            this.isInitialized = true;

            this.trackEvent('background_initialized');
        } catch (error) {
            console.error('Failed to initialize background service worker:', error);
            this.trackError('initialization_failed', error);
        }
    }

    setupEventListeners() {
        chrome.runtime.onInstalled.addListener((details) => this.handleInstall(details));
        chrome.runtime.onStartup.addListener(() => this.handleStartup());
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        // Only setup context menus listener if API is available
        if (chrome.contextMenus) {
            chrome.contextMenus.onClicked.addListener((info, tab) => this.handleContextMenu(info, tab));
        }

        chrome.commands.onCommand.addListener((command) => this.handleCommand(command));
        chrome.tabs.onCreated.addListener((tab) => this.handleTabCreated(tab));
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => this.handleTabUpdated(tabId, changeInfo, tab));
        chrome.storage.onChanged.addListener((changes, namespace) => this.handleStorageChange(changes, namespace));
    }

    // ========================================
    // Installation and Startup
    // ========================================

    async handleInstall(details) {
        if (details.reason === 'install') {
            await this.setupInitialData();
            this.trackEvent('extension_installed');
            
            this.showNotification({
                title: 'Hyper Launcher Installed!',
                message: 'Click the extension icon to get started with your new bookmark manager.',
                iconUrl: 'icons/icon48.png'
            });
            
        } else if (details.reason === 'update') {
            await this.handleUpdate(details.previousVersion);
            this.trackEvent('extension_updated', { previousVersion: details.previousVersion });
        }
    }

    async setupInitialData() {
        const defaultSettings = {
            hyperLauncherFirstTime: true,
            hyperLauncherTabMode: true,
            hyperLauncherViewPopup: 'grid',
            hyperLauncherViewFullPage: 'grid',
            hyperLauncherGridLayout: 'comfortable',
            hyperLauncherInstallDate: new Date().toISOString(),
            hyperLauncherApps: [],
            hyperLauncherSickbayApps: [],
            
            hyperLauncherNewTabSettings: {
                enabled: false,
                askedDuringOnboarding: false,
                reminderCount: 0,
                lastReminderDate: null,
                bookmarkBarAdded: false
            }
        };

        await chrome.storage.local.set(defaultSettings);
    }

    async handleUpdate(previousVersion) {
        if (previousVersion && this.shouldMigrate(previousVersion)) {
            await this.migrateData(previousVersion);
        }
        
        await this.migrateSyncToLocal();
        
        this.contextMenusCreated = false;
        this.createContextMenus();
    }

    // ========================================
    // SECURITY FIX: Safe Data Migration
    // ========================================

    async migrateSyncToLocal() {
        try {
            const syncData = await chrome.storage.sync.get();

            if (Object.keys(syncData).length > 0) {
                // Sanitize data before migration
                const sanitizedData = this.sanitizeStorageData(syncData);
                await chrome.storage.local.set(sanitizedData);
                await chrome.storage.sync.clear();
            }
        } catch (error) {
            console.error('Failed to migrate from sync to local storage:', error);
        }
    }

    // SECURITY FIX: Sanitize storage data
    sanitizeStorageData(data) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof key !== 'string' || key.length > 100) continue;
            
            // Sanitize based on expected data types
            if (key.includes('Apps') && Array.isArray(value)) {
                sanitized[key] = value.map(app => this.sanitizeAppData(app));
            } else if (typeof value === 'string' && value.length < 1000) {
                sanitized[key] = this.sanitizeText(value);
            } else if (typeof value === 'boolean' || typeof value === 'number') {
                sanitized[key] = value;
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value);
            }
        }
        
        return sanitized;
    }

    sanitizeAppData(app) {
        if (!app || typeof app !== 'object') return null;
        
        return {
            id: parseInt(app.id) || Date.now(),
            url: this.sanitizeUrl(app.url),
            title: this.sanitizeText(app.title),
            createdAt: parseInt(app.createdAt) || Date.now(),
            favIconUrl: app.favIconUrl ? this.sanitizeUrl(app.favIconUrl) : null,
            preserveOriginal: Boolean(app.preserveOriginal),
            faviconLastUpdated: parseInt(app.faviconLastUpdated) || Date.now(),
            faviconSource: this.sanitizeText(app.faviconSource || 'none')
        };
    }

    sanitizeText(text) {
        if (typeof text !== 'string') return '';
        return text.replace(/[<>\"'&]/g, (match) => {
            const entities = {'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'};
            return entities[match];
        }).substring(0, 200);
    }

    sanitizeUrl(url) {
        if (!this.isValidUrl(url)) return null;
        return url.substring(0, 2000);
    }

    // SECURITY FIX: Deep recursive object sanitization with prototype pollution protection
    sanitizeObject(obj, maxDepth = 5, currentDepth = 0) {
        // Prevent infinite recursion
        if (currentDepth >= maxDepth) {
            console.warn('Max depth exceeded in object sanitization');
            return {};
        }

        // Handle null and primitives
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, maxDepth, currentDepth + 1));
        }

        // Sanitize objects
        const sanitized = {};
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

        for (const [key, value] of Object.entries(obj)) {
            // Skip dangerous keys
            if (dangerousKeys.includes(key)) {
                console.warn('Blocked dangerous key during sanitization:', key);
                continue;
            }

            // Validate key
            if (typeof key !== 'string' || key.length > 50) {
                console.warn('Skipped invalid key:', key);
                continue;
            }

            // Only process own properties
            if (!Object.prototype.hasOwnProperty.call(obj, key)) {
                continue;
            }

            // Sanitize value based on type
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeText(value);
            } else if (typeof value === 'boolean') {
                sanitized[key] = Boolean(value);
            } else if (typeof value === 'number') {
                // Validate number is safe
                if (Number.isFinite(value)) {
                    sanitized[key] = value;
                }
            } else if (typeof value === 'object' && value !== null) {
                // Recursively sanitize nested objects/arrays
                sanitized[key] = this.sanitizeObject(value, maxDepth, currentDepth + 1);
            }
            // Skip functions, symbols, undefined, etc.
        }

        return sanitized;
    }

    // ========================================
    // SECURITY FIX: Safe URL Validation
    // ========================================

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

            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return false;
            }

            return true;
        } catch (error) {
            console.warn(`URL validation failed for "${url}":`, error.message);
            return false;
        }
    }

    shouldMigrate(previousVersion) {
        const [major, minor] = previousVersion.split('.').map(Number);
        return major < 3;
    }

    async migrateData(previousVersion) {
        try {
            const data = await chrome.storage.local.get();
            
            if (data.hyperLauncherBookmarks) {
                const migratedApps = data.hyperLauncherBookmarks
                    .filter(bookmark => this.isValidUrl(bookmark.url))
                    .map((bookmark, index) => ({
                        id: index + 1,
                        url: this.sanitizeUrl(bookmark.url),
                        title: this.sanitizeText(bookmark.title) || this.extractTitleFromUrl(bookmark.url),
                        createdAt: Date.now(),
                        favIconUrl: bookmark.favIconUrl ? this.sanitizeUrl(bookmark.favIconUrl) : null,
                        faviconLastUpdated: Date.now()
                    }));
                
                await chrome.storage.local.set({
                    hyperLauncherApps: migratedApps
                });

                await chrome.storage.local.remove(['hyperLauncherBookmarks']);
            }

            const updates = {};
            
            if (!data.hyperLauncherGridLayout) {
                updates.hyperLauncherGridLayout = 'comfortable';
            }
            
            if (!data.hyperLauncherNewTabSettings) {
                updates.hyperLauncherNewTabSettings = {
                    enabled: false,
                    askedDuringOnboarding: false,
                    reminderCount: 0,
                    lastReminderDate: null,
                    bookmarkBarAdded: false
                };
            }
            
            if (Object.keys(updates).length > 0) {
                await chrome.storage.local.set(updates);
            }
            
        } catch (error) {
            console.error('Migration failed:', error);
            this.trackError('migration_failed', error);
        }
    }

    extractTitleFromUrl(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        } catch (error) {
            console.warn(`Title extraction failed for "${url}":`, error.message);
            return 'Bookmark';
        }
    }

    handleStartup() {
        this.analytics.sessionsCount++;
        this.saveAnalytics();
        this.trackEvent('extension_startup');
    }

    // ========================================
    // Message Handling
    // ========================================

    async handleMessage(request, sender, sendResponse) {
        try {
            // SECURITY FIX: Validate sender origin
            // Accept messages from:
            // 1. Our extension's content scripts (sender.id matches)
            // 2. Our extension's pages (sender.url starts with extension URL)
            // 3. Our extension context (sender.origin matches)
            const extensionUrl = chrome.runtime.getURL('');
            const isValidSender =
                (sender.id && sender.id === chrome.runtime.id) ||
                (sender.url && sender.url.startsWith(extensionUrl)) ||
                (sender.origin && sender.origin === new URL(extensionUrl).origin) ||
                (!sender.id && !sender.url); // Service worker self-messaging

            if (!isValidSender) {
                console.warn('Rejected message from unauthorized sender:', sender);
                sendResponse({
                    success: false,
                    message: 'Unauthorized: Invalid message origin'
                });
                return;
            }

            // SECURITY FIX: Validate message structure
            if (!request || typeof request !== 'object' || !request.action) {
                sendResponse({ success: false, message: 'Invalid request structure' });
                return;
            }

            // SECURITY FIX: Validate action is a string
            if (typeof request.action !== 'string' || request.action.length === 0) {
                sendResponse({ success: false, message: 'Invalid action' });
                return;
            }

            switch (request.action) {
                case 'openLauncher':
                    await this.openLauncher();
                    sendResponse({ success: true });
                    break;
                
                case 'openFullPage':
                    await this.openFullPage();
                    sendResponse({ success: true });
                    break;
                
                case 'addCurrentPage':
                    const result = await this.addCurrentPage(request.destination);
                    sendResponse(result);
                    break;
                
                case 'getPageInfo':
                    const pageInfo = await this.getPageInfo(sender.tab);
                    sendResponse(pageInfo);
                    break;
                
                case 'trackUsage':
                    this.trackEvent(request.type, request.data);
                    sendResponse({ success: true });
                    break;
                
                case 'showNotification':
                    this.showNotification({
                        title: 'Hyper Launcher',
                        message: this.sanitizeText(request.message),
                        iconUrl: 'icons/icon48.png'
                    });
                    sendResponse({ success: true });
                    break;
                
                case 'updateBadge':
                    await this.updateBadge(parseInt(request.count) || 0);
                    sendResponse({ success: true });
                    break;
                
                case 'addToBookmarkBar':
                    const bookmarkResult = await this.addToBookmarkBar();
                    sendResponse(bookmarkResult);
                    break;
                
                default:
                    sendResponse({ success: false, message: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.trackError('message_handling_failed', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // ========================================
    // Core Functionality
    // ========================================

    async openLauncher() {
        try {
            const views = chrome.extension.getViews({ type: 'popup' });
            if (views.length > 0) {
                views[0].focus();
                return;
            }
            
            await chrome.action.openPopup();
            this.trackEvent('launcher_opened');
        } catch (error) {
            console.warn('Failed to open popup, opening full page:', error);
            await this.openFullPage();
        }
    }

    async openFullPage() {
        const url = chrome.runtime.getURL('fullpage.html');

        const tabs = await chrome.tabs.query({ url: url });

        if (tabs.length > 0) {
            await chrome.tabs.update(tabs[0].id, { active: true });
            await chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
            await chrome.tabs.create({ url: url });
        }

        this.trackEvent('fullpage_opened');
    }

    async openDesignSystem() {
        const url = chrome.runtime.getURL('designsystem/index.html');

        const tabs = await chrome.tabs.query({ url: url });

        if (tabs.length > 0) {
            await chrome.tabs.update(tabs[0].id, { active: true });
            await chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
            await chrome.tabs.create({ url: url });
        }

        this.trackEvent('design_system_opened');
    }

    async addCurrentPage(destination = 'main') {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                throw new Error('No active tab found');
            }

            if (this.isSpecialPage(tab.url)) {
                return { success: false, message: 'Cannot bookmark special pages' };
            }

            const storageKey = destination === 'sickbay' ? 'hyperLauncherSickbayApps' : 'hyperLauncherApps';
            const result = await chrome.storage.local.get([storageKey]);

            // FIXED: Fail-fast validation instead of defensive fallback
            if (!result.hasOwnProperty(storageKey)) {
                throw new TypeError(`Storage missing ${storageKey} - possible corruption or first run`);
            }
            if (!Array.isArray(result[storageKey])) {
                throw new TypeError(`${storageKey} must be an array, got ${typeof result[storageKey]}`);
            }

            const apps = result[storageKey];
            
            const existing = apps.find(app => app.url === tab.url);
            if (existing) {
                return { success: false, message: 'Page already bookmarked' };
            }
            
            const newApp = this.sanitizeAppData({
                id: Math.max(...apps.map(app => app.id), 0) + 1,
                url: tab.url,
                title: tab.title || this.extractTitleFromUrl(tab.url),
                createdAt: Date.now(),
                favIconUrl: tab.favIconUrl,
                faviconLastUpdated: Date.now(),
                faviconSource: 'browser_tab',
                preserveOriginal: true
            });
            
            if (!newApp) {
                return { success: false, message: 'Invalid bookmark data' };
            }
            
            apps.unshift(newApp);
            await chrome.storage.local.set({ [storageKey]: apps });
            
            if (destination === 'sickbay') {
                await this.updateBadge(apps.length);
            }
            
            this.analytics.bookmarksAdded++;
            this.saveAnalytics();
            this.trackEvent('bookmark_added', { destination, url: tab.url });
            
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'showNotification',
                    message: `Added to ${destination === 'sickbay' ? 'Sickbay' : 'Launcher'}!`,
                    type: 'success'
                }).catch(() => {});
            }
            
            return { success: true, app: newApp };
            
        } catch (error) {
            console.error('Failed to add current page:', error);
            this.trackError('add_page_failed', error);
            return { success: false, error: error.message };
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

    async getPageInfo(tab) {
        if (!tab) return null;
        
        return {
            title: this.sanitizeText(tab.title),
            url: this.sanitizeUrl(tab.url),
            favIconUrl: tab.favIconUrl ? this.sanitizeUrl(tab.favIconUrl) : null,
            isSpecialPage: this.isSpecialPage(tab.url)
        };
    }

    async updateBadge(count) {
        try {
            const safeCount = parseInt(count) || 0;
            if (safeCount > 0) {
                await chrome.action.setBadgeText({ text: safeCount.toString() });
                await chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
            } else {
                await chrome.action.setBadgeText({ text: '' });
            }
        } catch (error) {
            console.error('Failed to update badge:', error);
        }
    }

    // ========================================
    // Context Menus
    // ========================================

    createContextMenus() {
        // Check if contextMenus API is available
        if (!chrome.contextMenus) {
            console.warn('Context Menus API not available');
            return;
        }

        if (this.contextMenusCreated) return;

        chrome.contextMenus.removeAll(() => {
            if (chrome.runtime.lastError) {
                console.error('Error removing context menus:', chrome.runtime.lastError);
                return;
            }

            try {
                chrome.contextMenus.create({
                    id: 'addToHyperLauncher',
                    title: 'Add to Hyper Launcher',
                    contexts: ['page'],
                    documentUrlPatterns: ['http://*/*', 'https://*/*']
                });

                chrome.contextMenus.create({
                    id: 'addToSickbay',
                    title: 'Add to Sickbay',
                    contexts: ['page'],
                    documentUrlPatterns: ['http://*/*', 'https://*/*']
                });

                chrome.contextMenus.create({
                    id: 'openFullPageLauncher',
                    title: 'Open Hyper Launcher (Full Page)',
                    contexts: ['page']
                });

                this.contextMenusCreated = true;
            } catch (error) {
                console.error('Failed to create context menus:', error);
                this.trackError('context_menu_creation_failed', error);
            }
        });
    }

    async handleContextMenu(info, tab) {
        try {
            switch (info.menuItemId) {
                case 'addToHyperLauncher':
                    await this.addCurrentPage('main');
                    break;
                
                case 'addToSickbay':
                    await this.addCurrentPage('sickbay');
                    break;
                
                case 'openFullPageLauncher':
                    await this.openFullPage();
                    break;
            }
        } catch (error) {
            console.error('Context menu action failed:', error);
            this.trackError('context_menu_action_failed', error);
        }
    }

    // ========================================
    // Bookmark Bar Functionality
    // ========================================

    async addToBookmarkBar() {
        try {
            if (!chrome.bookmarks) {
                return {
                    success: false,
                    message: 'Bookmarks permission not available'
                };
            }

            const bookmarkBar = await chrome.bookmarks.get('1');
            
            if (!bookmarkBar || bookmarkBar.length === 0) {
                return {
                    success: false,
                    message: 'Could not access bookmark bar'
                };
            }

            const existingBookmarks = await chrome.bookmarks.getChildren('1');
            const hyperLauncherBookmark = existingBookmarks.find(bookmark => 
                bookmark.title === 'Hyper Launcher' || 
                bookmark.url === chrome.runtime.getURL('fullpage.html')
            );

            if (hyperLauncherBookmark) {
                return {
                    success: false,
                    message: 'Hyper Launcher is already in your bookmark bar'
                };
            }

            const newBookmark = await chrome.bookmarks.create({
                parentId: '1',
                index: 0,
                title: 'Hyper Launcher',
                url: chrome.runtime.getURL('fullpage.html')
            });

            this.trackEvent('bookmark_bar_added');

            const data = await chrome.storage.local.get(['hyperLauncherNewTabSettings']);
            const settings = data.hyperLauncherNewTabSettings || {};
            settings.bookmarkBarAdded = true;
            
            await chrome.storage.local.set({
                hyperLauncherNewTabSettings: settings
            });

            return {
                success: true,
                message: 'Hyper Launcher added to bookmark bar!',
                bookmark: newBookmark
            };

        } catch (error) {
            console.error('Failed to add to bookmark bar:', error);
            this.trackError('bookmark_bar_failed', error);
            
            return {
                success: false,
                message: 'Failed to add to bookmark bar. Please add manually.',
                error: error.message
            };
        }
    }

    // ========================================
    // Keyboard Commands
    // ========================================

    async handleCommand(command) {
        try {
            switch (command) {
                case 'open-launcher':
                    await this.openLauncher();
                    break;

                case 'add-current-page':
                    await this.addCurrentPage('main');
                    break;

                case 'open-design-system':
                    await this.openDesignSystem();
                    break;
            }

            this.trackEvent('keyboard_command_used', { command });
        } catch (error) {
            console.error('Command execution failed:', error);
            this.trackError('command_execution_failed', error);
        }
    }

    // ========================================
    // Tab Management
    // ========================================

    handleTabCreated(tab) {
        this.trackEvent('tab_created');
    }

    async handleTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.url) {
            this.trackEvent('tab_navigation');
        }

        // Auto-update favicon for bookmarks when visiting the site
        if (changeInfo.status === 'complete' && tab.url && tab.favIconUrl) {
            await this.updateBookmarkFavicon(tab.url, tab.favIconUrl);
        }
    }

    async updateBookmarkFavicon(url, favIconUrl) {
        try {
            // Get all bookmarks
            const result = await chrome.storage.local.get(['hyperLauncherApps', 'hyperLauncherSickbayApps']);
            let updated = false;

            // Check main apps
            if (Array.isArray(result.hyperLauncherApps)) {
                for (const app of result.hyperLauncherApps) {
                    // Update if URL matches and bookmark doesn't have a favicon
                    if (app.url === url && !app.favIconUrl && favIconUrl) {
                        app.favIconUrl = favIconUrl;
                        app.faviconLastUpdated = Date.now();
                        app.faviconSource = 'browser_tab';
                        updated = true;
                    }
                }
            }

            // Check sickbay apps
            if (Array.isArray(result.hyperLauncherSickbayApps)) {
                for (const app of result.hyperLauncherSickbayApps) {
                    // Update if URL matches and bookmark doesn't have a favicon
                    if (app.url === url && !app.favIconUrl && favIconUrl) {
                        app.favIconUrl = favIconUrl;
                        app.faviconLastUpdated = Date.now();
                        app.faviconSource = 'browser_tab';
                        updated = true;
                    }
                }
            }

            // Save if any updates were made
            if (updated) {
                await chrome.storage.local.set({
                    hyperLauncherApps: result.hyperLauncherApps || [],
                    hyperLauncherSickbayApps: result.hyperLauncherSickbayApps || []
                });
            }
        } catch (error) {
            console.error('Failed to update bookmark favicon:', error);
        }
    }

    // ========================================
    // Alarms and Maintenance
    // ========================================

    setupAlarms() {
        chrome.alarms.create('dailyAnalytics', {
            delayInMinutes: 1,
            periodInMinutes: 24 * 60
        });
        
        chrome.alarms.create('weeklyCleanup', {
            delayInMinutes: 60,
            periodInMinutes: 7 * 24 * 60
        });
    }

    handleStorageChange(changes, namespace) {
        if (namespace === 'local') {
            if (changes.hyperLauncherApps || changes.hyperLauncherSickbayApps) {
                this.trackEvent('bookmarks_modified');
            }
            
            if (changes.hyperLauncherViewPopup || changes.hyperLauncherViewFullPage) {
                this.analytics.viewsSwitched++;
                this.saveAnalytics();
                this.trackEvent('view_switched');
            }
        }
    }

    // ========================================
    // Notifications
    // ========================================

    async showNotification(options) {
        try {
            const notificationId = `hyper-launcher-${Date.now()}`;
            
            await chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: options.iconUrl || 'icons/icon48.png',
                title: this.sanitizeText(options.title || 'Hyper Launcher'),
                message: this.sanitizeText(options.message || ''),
                silent: options.silent || false
            });
            
            setTimeout(() => {
                chrome.notifications.clear(notificationId);
            }, 5000);
            
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }

    // ========================================
    // Analytics and Tracking
    // ========================================

    async loadAnalytics() {
        try {
            const result = await chrome.storage.local.get(['hyperLauncherAnalytics']);
            if (result.hyperLauncherAnalytics) {
                this.analytics = { ...this.analytics, ...result.hyperLauncherAnalytics };
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    async saveAnalytics() {
        try {
            await chrome.storage.local.set({
                hyperLauncherAnalytics: {
                    ...this.analytics,
                    lastUpdated: Date.now()
                }
            });
        } catch (error) {
            console.error('Failed to save analytics:', error);
        }
    }

    trackEvent(eventType, data = {}) {
        const event = {
            type: this.sanitizeText(eventType),
            timestamp: Date.now(),
            data: this.sanitizeObject(data)
        };

        this.recentEvents.push(event);
        if (this.recentEvents.length > this.maxRecentEvents) {
            this.recentEvents.shift();
        }
        
        chrome.storage.local.set({
            hyperLauncherRecentEvents: this.recentEvents
        }).catch(error => {
            console.error('Failed to store recent events:', error);
        });
    }

    trackError(errorType, error) {
        console.error(`Error [${errorType}]:`, error);
        
        this.analytics.errorsEncountered++;
        
        const errorLog = {
            type: this.sanitizeText(errorType),
            message: this.sanitizeText(error.message || 'Unknown error'),
            timestamp: Date.now()
        };
        
        chrome.storage.local.get(['errorLogs'], (result) => {
            const logs = result.errorLogs || [];
            logs.push(errorLog);
            
            if (logs.length > 100) {
                logs.shift();
            }
            
            chrome.storage.local.set({ errorLogs: logs });
        });
    }
}

// Initialize background service worker
const hyperLauncherBackground = new HyperLauncherBackground();
