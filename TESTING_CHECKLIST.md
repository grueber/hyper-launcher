# Hyper Launcher v3.2.0 - Pre-Submission Testing Checklist

**Test Date**: _____________
**Tested By**: _____________
**Chrome Version**: _____________

---

## **Setup**

- [ ] Fresh Chrome install or clean profile
- [ ] Extension loaded unpacked from local directory
- [ ] No errors in console (F12 → Console tab)
- [ ] All icons load correctly (check chrome://extensions/)

---

## **1. POPUP - COMPACT MODE**

### Initial State
- [ ] Popup opens when clicking extension icon
- [ ] Compact mode is shown by default
- [ ] "Bookmark This Page" button visible
- [ ] Main/Sickbay toggle buttons visible
- [ ] "View All Bookmarks" button visible
- [ ] Footer shows branding and settings icon
- [ ] "0 saved today" counter shows

### Bookmark Button
- [ ] Click "Bookmark This Page" → bookmark added
- [ ] Toast notification appears: "Added [URL] to Main!"
- [ ] Counter updates to "1 saved today"
- [ ] Favicon loads (or emoji shows if no favicon)

### Toggle Buttons
- [ ] Main toggle button is active by default (blue)
- [ ] Click Sickbay toggle → button turns orange
- [ ] Click "Bookmark This Page" → bookmark goes to Sickbay
- [ ] Toast says "Added [URL] to Sickbay!"
- [ ] Toggle state persists when reopening popup

### Settings Dropdown
- [ ] Click settings icon (⚙️) → dropdown opens
- [ ] "Compact Mode" toggle is checked
- [ ] "Background Tabs" toggle visible
- [ ] Toggle "Background Tabs" → state changes
- [ ] Click "Export Data" → download JSON file
- [ ] Click outside dropdown → dropdown closes

### View All Button
- [ ] Click "View All Bookmarks" → full page opens
- [ ] Popup closes after opening full page

---

## **2. POPUP - FULL MODE**

### Toggle Compact Mode Off
- [ ] Open popup → Settings → Uncheck "Compact Mode"
- [ ] Popup switches to full mode immediately
- [ ] Full mode shows grid of bookmarks
- [ ] Header with action buttons visible
- [ ] Footer with view controls visible

### Action Buttons
- [ ] "⭐ Main" button adds bookmark to main
- [ ] "⭐ Sickbay" button adds bookmark to sickbay
- [ ] "🏥 Sickbay" button toggles sickbay view
- [ ] "Full Page" button opens full page view
- [ ] Sickbay badge shows count when > 0

### View Controls (Footer)
- [ ] Grid view button (⊞) switches to grid
- [ ] Thumbnail view button (⊟) switches to thumbnail
- [ ] List view button (☰) switches to list
- [ ] Active view button is highlighted
- [ ] View preference persists when reopening

### Search
- [ ] Click search icon (🔍) → search bar appears
- [ ] Type in search → results filter live
- [ ] Clear button (×) clears search
- [ ] Esc key clears search

### Bookmark Tiles
- [ ] Hover over tile → delete button (×) appears
- [ ] Click delete button → confirmation modal
- [ ] Confirm delete → bookmark removed
- [ ] Drag tile → can reorder bookmarks
- [ ] Click tile → opens URL in new tab
- [ ] Background tabs toggle works correctly

### More Menu (⋯)
- [ ] Click more button → dropdown opens
- [ ] "Add Custom URL" → opens modal
- [ ] "Undo" performs last action undo
- [ ] "Export Data" downloads JSON
- [ ] "Import Data" opens file picker

---

## **3. FULL PAGE MODE**

### Initial Load
- [ ] Open new tab → Hyper Launcher loads
- [ ] No console errors
- [ ] All bookmarks display correctly
- [ ] Search area visible at bottom (fixed footer)
- [ ] Header with all controls visible
- [ ] Footer with stats visible

### Header Controls

**Left Side:**
- [ ] "Add Custom" button opens quick-add popup
- [ ] "🏥 Sickbay" button with badge shows count
- [ ] "🏥 Sickbay" button toggles sickbay view
- [ ] Active state (orange glow) when viewing sickbay

**Center:**
- [ ] View controls (Grid/Thumbnail/List) work
- [ ] Grid size controls (Compact/Comfortable/Roomy) work
- [ ] Active states highlight correctly

**Right Side:**
- [ ] Tab mode toggle switch works
- [ ] "Background tabs" label updates
- [ ] Settings dropdown opens
- [ ] Undo button works

### Keyboard Shortcuts
- [ ] Press `1` → switches to grid view
- [ ] Press `2` → switches to thumbnail view
- [ ] Press `3` → switches to list view
- [ ] Press `S` → toggles Sickbay view
- [ ] Press `Cmd/Ctrl+Z` → undo last action
- [ ] Press `Cmd/Ctrl+Shift+D` → opens design system
- [ ] Press `Escape` → clears search
- [ ] Shortcuts DON'T fire when editing text

### Grid Layouts
- [ ] Select "Compact" → 9 columns at desktop
- [ ] Select "Comfortable" → 11 columns at desktop
- [ ] Select "Roomy" → 22 columns at ultra-wide
- [ ] Layout persists when refreshing tab
- [ ] Layout preference saved correctly

### View Modes

**Grid View:**
- [ ] Tiles show icon and title
- [ ] Square tiles with aspect ratio 1:1
- [ ] Hover shows delete and move buttons
- [ ] Double-click title → editable
- [ ] Edit title → Enter saves, Esc cancels
- [ ] Colored backgrounds for no-favicon tiles

**Thumbnail View:**
- [ ] Square tiles with icons only
- [ ] No titles visible
- [ ] Hover shows tooltip with title
- [ ] Larger icons than grid view
- [ ] Tiles maintain square aspect ratio

**List View:**
- [ ] Horizontal full-width tiles
- [ ] Icon on left, title on right
- [ ] Action buttons on far right
- [ ] Single column layout
- [ ] Max-width 4000px

### Search Area (Fixed Footer)
- [ ] Always visible at bottom of page
- [ ] Glassmorphism effect (translucent background)
- [ ] Blurred background shows bookmarks behind
- [ ] Search input works correctly
- [ ] Clear button (×) appears when typing
- [ ] "Bookmark All Tabs to Main" button works
- [ ] "Bookmark All Tabs to Sickbay" button works
- [ ] Both buttons are side-by-side

### Sickbay Operations
- [ ] Toggle Sickbay → view switches
- [ ] Sickbay badge updates count
- [ ] "Clear Sickbay" button appears when in sickbay
- [ ] Clear Sickbay → confirmation dialog
- [ ] Confirm → all sickbay items deleted
- [ ] Move to Main button (↑) on sickbay tiles
- [ ] Click Move to Main → item moves immediately
- [ ] Drag item from sickbay to main works

### Import/Export
- [ ] Export Data → JSON file downloads
- [ ] JSON contains all bookmarks + settings
- [ ] Import valid JSON → bookmarks restored
- [ ] Import invalid JSON → error message
- [ ] Import preserves view preferences

### Undo System
- [ ] Delete bookmark → Undo button enabled
- [ ] Click Undo → bookmark restored
- [ ] Clear Sickbay → Undo restores all
- [ ] Undo stack limited to 10 actions
- [ ] "Nothing to undo" message when empty

### Favicon Refresh
- [ ] Bookmarks with favicons load correctly
- [ ] Stale favicons refresh after 1 week
- [ ] Manual refresh works (if implemented)
- [ ] Preserved favicons don't refresh
- [ ] No-favicon bookmarks show emoji + color

### Drag and Drop
- [ ] Drag tile → visual feedback (opacity 0.6)
- [ ] Drop on another tile → reorders
- [ ] Drag from Main to Sickbay → moves
- [ ] Drag from Sickbay to Main → moves
- [ ] Drop outside grid → cancels

### Empty States
- [ ] New install → empty state with onboarding
- [ ] Empty main → "No bookmarks yet" message
- [ ] Empty sickbay → "Sickbay is empty" message
- [ ] Empty state actions work (Add Current Page)

---

## **4. MODALS & POPUPS**

### Quick Add Popup
- [ ] Click "Add Custom" → popup opens
- [ ] URL input accepts valid URLs
- [ ] Title input (optional) works
- [ ] Destination toggles (Main/Sickbay) work
- [ ] Placement toggles (Front/Back) work
- [ ] Submit → bookmark added
- [ ] Cancel → popup closes, no bookmark
- [ ] Esc key closes popup

### Delete Confirmation
- [ ] Click delete (×) → modal opens
- [ ] Shows bookmark title in message
- [ ] Cancel → closes modal, no delete
- [ ] Confirm → bookmark deleted
- [ ] Toast notification appears

### Onboarding (First Run)
- [ ] Fresh install → onboarding appears
- [ ] Step 1: Welcome message
- [ ] "Add Current Page" → adds bookmark, step 2
- [ ] Step 2: Sickbay introduction
- [ ] "Open Full Page" → opens full page, closes onboarding
- [ ] "Skip Tour" → closes onboarding immediately
- [ ] Onboarding doesn't show again

---

## **5. DESIGN SYSTEM PAGE**

- [ ] Press `Cmd/Ctrl+Shift+D` → design system opens
- [ ] Page loads at `_designsystem/index.html`
- [ ] All components render correctly
- [ ] Copy buttons work for code snippets
- [ ] Color swatches show correct values
- [ ] All states shown (hover, active, disabled)

---

## **6. BROWSER INTEGRATION**

### Extension Icon
- [ ] Icon appears in browser toolbar
- [ ] Badge count shows on icon (if applicable)
- [ ] Click icon → popup opens immediately

### Context Menu (Right-Click)
- [ ] Right-click on page → "Add to Hyper Launcher" option
- [ ] Click option → bookmark added
- [ ] Sub-menu for Main/Sickbay (if implemented)

### New Tab Override
- [ ] Open new tab → Hyper Launcher shows
- [ ] No flash of default new tab page
- [ ] Loads quickly (<500ms)

### Chrome Commands (Shortcuts)
- [ ] `Cmd/Ctrl+Shift+L` → opens popup
- [ ] `Cmd/Ctrl+Shift+A` → adds current page
- [ ] `Cmd/Ctrl+Shift+F` → opens full page
- [ ] `Cmd/Ctrl+Shift+D` → opens design system

---

## **7. DATA PERSISTENCE**

### Storage
- [ ] Add bookmarks → close browser → reopen → bookmarks persist
- [ ] View preference persists
- [ ] Grid layout persists
- [ ] Tab mode preference persists
- [ ] Compact mode preference persists
- [ ] Search clears on page reload

### Chrome Sync (if enabled)
- [ ] Bookmarks sync across devices (if sync enabled)
- [ ] Preferences sync across devices

---

## **8. PERFORMANCE**

- [ ] Popup opens in <100ms
- [ ] Full page loads in <500ms
- [ ] No lag when scrolling bookmarks (100+ items)
- [ ] Search filters instantly
- [ ] No memory leaks (check Task Manager after 30 min)
- [ ] Favicon loading doesn't block UI

---

## **9. EDGE CASES**

### Special URLs
- [ ] chrome:// URLs → warning/blocked
- [ ] file:// URLs → warning/blocked
- [ ] javascript: URLs → blocked
- [ ] data: URLs → blocked
- [ ] Invalid URLs → validation error

### Large Datasets
- [ ] Import 500+ bookmarks → loads correctly
- [ ] Scroll performance remains smooth
- [ ] Search still fast with many bookmarks
- [ ] Export/import works with large files

### Edge Behaviors
- [ ] Delete last bookmark → empty state shows
- [ ] Undo on empty stack → "Nothing to undo"
- [ ] Clear Sickbay when empty → "Already empty"
- [ ] Bookmark duplicate URL → "Already bookmarked"
- [ ] Edit title to empty string → defaults to "Bookmark"

---

## **10. CROSS-BROWSER TESTING**

### Chrome
- [ ] Latest stable version works
- [ ] All features functional

### Edge (Chromium)
- [ ] Extension loads
- [ ] All features functional

### Brave
- [ ] Extension loads
- [ ] All features functional

---

## **11. ACCESSIBILITY**

- [ ] Tab navigation works through all controls
- [ ] Focus indicators visible
- [ ] ARIA labels present on icon-only buttons
- [ ] Screen reader friendly (test with VoiceOver/NVDA)
- [ ] Keyboard shortcuts don't conflict with browser
- [ ] Skip links work (Tab from new page)

---

## **12. SECURITY**

- [ ] No XSS vulnerabilities (test with <script> in title)
- [ ] URL sanitization works
- [ ] No console errors about CSP violations
- [ ] No eval() or inline scripts
- [ ] All external resources properly loaded

---

## **13. FINAL CHECKS**

- [ ] manifest.json version is 3.2.0
- [ ] All permissions justified
- [ ] No TODO comments in code
- [ ] No console.log in production
- [ ] All icons load (16, 32, 48, 128)
- [ ] Privacy policy linked/accessible
- [ ] License file present (if applicable)

---

## **Issues Found**

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## **Sign-Off**

- [ ] All critical tests passed
- [ ] All issues resolved or documented
- [ ] Ready for Chrome Web Store submission

**Tester Signature**: _______________________
**Date**: _______________________
