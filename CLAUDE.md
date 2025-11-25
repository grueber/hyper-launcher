# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyper Launcher is a Chrome extension (Manifest V3) designed as an ADHD-friendly bookmark manager and app launcher. It replaces the new tab page with a customizable launcher interface featuring multiple view modes (grid, thumbnail, list) and a "Sickbay" for temporary bookmarks.

## Version Policy

**Current Version: 3.3.4 (Bug Fixes - Chrome Web Store Submission Ready)**

**IMPORTANT: Version 3.2.x is in production on Chrome Web Store. Version 3.3.x is the next minor release series.**

**Recent Changes (November 14, 2025):**
- **v3.3.4** - Bug fixes: Decimal ID import handling, modal z-index issues, empty state centering, edit modal styling, removed undo/bookmark bar features
- **v3.3.3** - Bug fixes: Export from popup now works (switched to DOM download), dynamic version numbers in exports
- **v3.3.2** - Security patches: URL redaction in validation modal, favicon URL validation in edit modal
- **v3.3.1** - Bug fix: Edit button click handler (edit button now works correctly)
- **v3.3.0** - Feature release: Edit Bookmark metadata, Import Mode Selection (Replace/Merge), Import Validation modal

### Versioning Rules (Semantic Versioning)
- **Major (3.x.x)**: Breaking changes, major architectural rewrites
- **Minor (x.2.x)**: New features, non-breaking enhancements
- **Patch (x.x.1)**: Bug fixes, security patches, production hotfixes

### Production Version Policy (3.2.x)
**MANDATORY: All changes to production version 3.2.x MUST increment the patch version.**

- **3.2.0** → Initial release to Chrome Web Store
- **3.2.1** → Fixed chrome.contextMenus API initialization error
- **3.2.2** → Fixed chrome.alarms API initialization error
- **3.2.3** → Fixed first-run initialization race condition
- **3.2.4** → Fixed null safety in utility functions (getIconForApp, getColorForApp, createAppTile)
- **3.2.5** → Fixed popup first-run initialization & bookmarkAllTabs decimal ID bug
- **3.2.6** → Import validation modal with skip invalid bookmarks option
- **3.2.7** → Fixed tabs permission, tooltip misalignment, favicon auto-update, dropdown positioning
- **3.2.8** → Future bug fix or patch (if needed)
- **3.3.0** → Edit bookmark metadata, import mode selection (Replace/Merge), import validation
- **3.3.1** → Fixed edit button click handler (edit button now works correctly)
- **3.3.2** → Security patches: URL redaction in validation modal, favicon URL validation
- **3.3.3** → Fixed export from popup, dynamic version numbers in exports
- **3.3.4** → Fixed decimal ID import, modal z-index, empty state centering, edit modal styling, removed undo/bookmark bar (current)
- etc.

### When to Increment Version
1. **Before ANY code changes** intended for Chrome Web Store submission
2. **After fixing bugs** discovered in production
3. **When updating** manifest.json, create-package.sh, or any production files

### Version Update Checklist
When incrementing version (e.g., 3.2.0 → 3.2.1):
1. Update `manifest.json` → `"version": "3.2.1"`
2. Update `create-package.sh` → Version comment header and package name
3. Update CLAUDE.md → Current Version line above
4. Document changes in implementation.md or CHANGELOG (if applicable)
5. Test thoroughly before running `create-package.sh`

### Development Versions
- **3.3.4**: Current patch release (bug fixes on top of 3.3.0 features)
- **3.4.x**: Next minor release (new features)
- **4.0.x**: Next major release (breaking changes)

After production testing, 3.3.4 can be deployed to Chrome Web Store as the next feature release.

## DEVELOPMENT PRINCIPLES

**IMPORTANT**: These principles OVERRIDE default behavior and must be followed on EVERY task, EVERY query, EVERY code change.

### Test-Driven Development

**MANDATORY: Always write unit tests FIRST, then implement the feature.**

- **Before Writing Any Code**: Write the test that defines expected behavior
- **Red → Green → Refactor**: Watch test fail → Make it pass → Improve code
- **No Exceptions**: Every new feature, bug fix, or refactor requires tests first

**Testing Infrastructure Status**:
- **Current**: Zero test coverage, no testing framework (documented in implementation.md as CRITICAL technical debt)
- **Required Setup**:
  1. Add `package.json` with Jest dependencies
  2. Install Jest + Chrome extension testing utilities (e.g., `jest-chrome`, `@types/chrome`)
  3. Configure Jest with Chrome API mocks
  4. Create `__tests__/` directory structure mirroring source files
  5. Set up npm scripts for `npm test`, `npm run test:watch`, `npm run test:coverage`

**What to Test**:
- Background service worker logic (background.js)
- Popup UI logic (popup.js)
- Fullpage UI logic (fullpage.js)
- Utility functions (sanitization, validation, URL parsing)
- Chrome API interactions (mocked)
- Data transformations and state management

**Acknowledge Challenges**:
- Chrome extension testing requires mocking Chrome APIs (storage, tabs, runtime, etc.)
- DOM manipulation requires JSDOM or similar
- Service worker testing is more complex than regular web apps
- Use `jest-chrome` or similar for Chrome API mocks

**When TDD Applies**:
- New features: Write test describing feature behavior first
- Bug fixes: Write test that reproduces bug, then fix it
- Refactoring: Ensure tests pass before and after refactor

### Code Completeness Standards

**MANDATORY: Ship complete, production-ready code only. No placeholders, no workarounds, no "we'll fix this later".**

#### Fail Fast
- **Stop and Ask**: If blocked or uncertain, STOP immediately and ask the user rather than guessing
- **Throw Explicit Errors**: Throw errors immediately when something is wrong; never suppress or silently fail
- **Never Guess**: Don't implement speculative solutions when requirements are unclear
- **Log Errors**: All caught errors must be logged with context

#### No Placeholders
- **NEVER Commit**: `TODO`, `FIXME`, `HACK`, `XXX`, or similar comments
- **No Stub Functions**: Never create functions with `// implement later` or empty implementations
- **No Temporary Code**: If a feature isn't complete, don't include it in the codebase
- **Exception**: Code can reference implementation.md for documented future features, but no inline TODOs

**Existing TODOs**: There are currently 2 TODO comments in the codebase (fullpage.js:378, fullpage.css:535). These are documented in implementation.md as technical debt and should be removed per new standards.

#### No Workarounds
- **Research First**: If the API doesn't support what you need, research alternatives or ask the user
- **Never Quick-Fix**: Never implement a "temporary solution" with a comment saying "this is temporary"
- **Do It Right**: If the proper solution is complex, implement it properly or don't implement it at all
- **Ask When Blocked**: If you can't find a proper solution, stop and ask rather than adding a workaround

#### No Fallbacks (for "Maybe This Breaks" Scenarios)
- **Fix Root Cause**: Don't add fallback logic for hypothetical failures; fix the root cause instead
- **No Defensive Fallbacks**: Don't add `|| defaultValue` everywhere "just in case"; ensure data is valid upstream
- **EXCEPTION - Proper Error Handling IS Required**:
  - Network errors (fetch failures, timeouts)
  - User input validation (invalid URLs, empty fields)
  - Chrome API errors (permissions denied, API unavailable)
  - File parsing errors (invalid JSON during import)

**Example - Good Error Handling**:
```javascript
try {
  const data = await chrome.storage.local.get('hyperLauncherApps');
  if (!Array.isArray(data.hyperLauncherApps)) {
    throw new TypeError('Invalid data format');
  }
  return data.hyperLauncherApps;
} catch (error) {
  console.error('Failed to load apps:', error);
  throw error; // Fail fast, don't return empty array silently
}
```

**Example - Bad Fallback**:
```javascript
// DON'T DO THIS - hiding potential bugs
const apps = data.hyperLauncherApps || []; // What if data is undefined? Why? Fix that!
```

### API Integration Requirements

**MANDATORY: Find and read official API documentation FIRST before implementing ANY API integration.**

**Before Writing Any API Code**:
1. **Find Official Docs**: Locate the official API documentation (never use unofficial sources)
2. **Read Relevant Sections**: Read docs for the specific endpoints/methods you plan to use
3. **Verify Capabilities**: Confirm the API supports what you need (don't assume)
4. **Check Constraints**:
   - Rate limits
   - Authentication requirements
   - Required headers/parameters
   - Error response formats
   - Pagination, if applicable
5. **State Your Findings**: Explicitly tell the user: "I found the official docs at [URL] and verified [specific capability]"

**For Chrome Extension APIs**:
- **Official Reference**: https://developer.chrome.com/docs/extensions/reference/
- **Always Check**: Manifest V3 compatibility (this project uses Manifest V3)
- **Verify Permissions**: Ensure required permissions are in manifest.json
- **Example Statement**: "I found the official Chrome Storage API docs at https://developer.chrome.com/docs/extensions/reference/api/storage and verified that `chrome.storage.local.set()` supports storing arrays of objects up to 10MB per key."

**NEVER**:
- Guess at API structure or available methods
- Assume an API works a certain way based on similar APIs
- Use API code from Stack Overflow without verifying against official docs
- Implement API calls without stating where you verified the information

### Project State Management (implementation.md)

**MANDATORY: Always maintain implementation.md as the living project context.**

**What is implementation.md?**
- Single source of truth for project status, bugs, technical debt, and architectural decisions
- Updated continuously as the project evolves
- Read at the start of complex tasks to understand current state

**When to Update implementation.md**:
1. **After Completing Features**: Add to "Current State" section with ✅
2. **When Discovering Bugs**: Document in "Known Bugs" with reproduction steps
3. **When Making Architectural Decisions**: Add to "Architecture Decisions" with reasoning
4. **When Adding Technical Debt**: Document in "Technical Debt" with priority and solution needed
5. **When Planning Features**: Add to "Future Features"
6. **When Finding Non-Obvious Details**: Add to "Important Context"

**What to Document**:
- **Current State**: What's implemented and working (keep updated as features are added)
- **Known Bugs**: Issues with reproduction steps, expected vs actual behavior, workarounds
- **Technical Debt**: Code that works but needs improvement, why it's debt, priority, solution
- **Future Features**: Planned additions, ideas to explore
- **Architecture Decisions**: Why certain approaches were chosen, trade-offs made, constraints
- **Important Context**: Non-obvious implementation details, critical gotchas, "why it works this way"

**When to Read implementation.md**:
- At the start of any complex task (3+ steps)
- Before making architectural changes
- When debugging unfamiliar code
- Before proposing new features (to understand existing context)

**Example Update**:
```markdown
## Technical Debt

### 5. **New Issue Discovered**
- **Issue**: Favicon refresh can overwhelm network in large imports
- **Location**: `fullpage.js:866-906`
- **Impact**: Importing 100+ bookmarks causes rate limiter to block many favicon refreshes
- **Solution**: Implement background queue with retry logic
- **Priority**: MEDIUM
```

### Design System Maintenance

**MANDATORY: Update design system when modifying UI components in fullpage.html, popup.html, or CSS files.**

**When to Update Design System**:
- Adding new UI components (buttons, inputs, modals, etc.)
- Modifying existing component HTML structure
- Changing component CSS classes or styling
- Adding new states to components (hover, active, disabled, error)
- Updating design tokens (colors, spacing, typography)

**Files That Require Design System Updates**:
- `fullpage.html` → Update `_designsystem/index.html`
- `popup.html` → Update `_designsystem/index.html`
- `design-system.css` → Update `_designsystem/index.html` (tokens section)
- `fullpage.css` → Update `_designsystem/index.html` (component styles)
- `popup.css` → Update `_designsystem/index.html` (component styles)

**How to Update Design System**:
1. **Add Component Card** to appropriate atomic design section:
   - **Atoms**: Single elements (icons, badges, dividers, status dots)
   - **Molecules**: Simple combinations (buttons, form groups, toggle groups)
   - **Organisms**: Complex components (modals, tiles, headers, dropdowns)
   - **Templates**: Full page layouts
2. **Include All States**: Show default, hover, active, disabled, error states where applicable
3. **Add Code Snippet**: Provide copy-paste ready HTML in `<pre><code id="code-...">` block
4. **Add Copy Button**: Use `<button class="ds-copy-btn" data-copy="...">Copy HTML</button>`
5. **Verify Visually**: State "Verify changes by opening `_designsystem/index.html` in browser"

**Example**:
```html
<div class="ds-card">
  <h4 class="ds-card-title">New Button Variant</h4>
  <button class="ds-copy-btn" data-copy="new-button">Copy HTML</button>

  <div class="ds-preview">
    <button class="btn btn-new-variant">New Variant</button>
  </div>

  <pre><code id="code-new-button">&lt;button class="btn btn-new-variant"&gt;New Variant&lt;/button&gt;</code></pre>
</div>
```

**Verification Statement**:
After updating design system, always state: "Verify changes by opening `_designsystem/index.html` in browser. The [component name] should render with [expected appearance]."

### Communication & Workflow

**How to Work Effectively**:

#### Use TodoWrite for Multi-Step Tasks
- **When**: Tasks with 3+ steps, complex implementations, multiple files
- **Why**: Gives user visibility into progress, prevents forgetting steps
- **How**: Create todo list at start of task, update as you progress

#### Mark Todos Complete IMMEDIATELY
- **NEVER batch completions**: Mark each todo as completed RIGHT AFTER finishing it
- **Why**: User sees real-time progress, accurate task tracking
- **Bad**: Complete 3 tasks, then mark all 3 complete at once
- **Good**: Complete task 1 → mark complete → complete task 2 → mark complete

#### Explicitly State Actions
- **Before Doing**: Say "I'm going to [action]" before using tools
- **Why**: User knows what you're doing, can stop you if needed
- **Example**: "I'm going to read fullpage.js to check the current implementation"

#### Fix Issues Autonomously (Ultrathink Mode)
- **When User Says "ultrathink"**: Fix issues you discover without asking for permission
- **What to Fix**: Bugs, inconsistencies, missing features discovered during work
- **When to Ask**: Architectural changes, deleting functionality, multiple valid approaches

#### When to Ask vs. Autonomously Fix
**ALWAYS ASK**:
- Before making architectural changes (changing data structures, file organization)
- Before deleting existing functionality
- When multiple valid approaches exist and choice is non-obvious
- When requirements are unclear or ambiguous
- Before making changes that affect user data

**FIX AUTONOMOUSLY** (especially in "ultrathink" mode):
- Obvious bugs discovered during work
- Inconsistencies in code style or naming
- Missing error handling
- Incomplete implementations you discover
- Documentation updates

#### Communication Style
- Be concise and direct (this is a CLI interface)
- No unnecessary superlatives or praise
- State facts, provide technical info
- Disagree when necessary (prioritize accuracy over validation)
- Ask clarifying questions when uncertain

## Core Architecture

The extension follows a standard Chrome extension architecture with three main components:

### 1. Background Service Worker (`background.js`)
- Class: `HyperLauncherBackground`
- Handles extension lifecycle, installation, and updates
- Manages context menus, keyboard commands, and message passing
- Implements data migration from older versions
- **Security**: All user input is sanitized via `sanitizeText()`, `sanitizeUrl()`, and `sanitizeAppData()` methods
- **Data Migration**: Uses `migrateSyncToLocal()` to move data from chrome.storage.sync to chrome.storage.local
- Storage keys: `hyperLauncherApps`, `hyperLauncherSickbayApps`, `hyperLauncherViewPopup`, `hyperLauncherViewFullPage`, `hyperLauncherTabMode`, `hyperLauncherGridLayout`, `hyperLauncherFirstTime`

### 2. Popup Interface (`popup.js`, `popup.html`)
- Class: `HyperLauncherPopup`
- Browser action popup (accessible via extension icon)
- Supports grid, thumbnail, and list views
- Drag-and-drop reordering
- Search functionality
- Import/export data as JSON

### 3. Full Page Launcher (`fullpage.js`, `fullpage.html`)
- Class: `HyperLauncherFullPage`
- Replaces Chrome's new tab page via `chrome_url_overrides.newtab`
- All features from popup plus:
  - Fixed footer search area with glassmorphism effect (translucent background with blur)
  - Grid size controls (compact, comfortable, roomy)
  - Keyboard shortcuts (1-3 for view switching, S for Sickbay, Cmd/Ctrl+Z for undo)
  - "Bookmark all tabs" functionality (side-by-side buttons)
  - Undo system with stack of previous states
  - Enhanced onboarding flow
  - **Critical**: Tracks `isEditingText` state to prevent keyboard shortcuts from firing during text input
  - **Responsive**: Tile math-based breakpoints prevent viewport overflow at all screen sizes

### 4. Content Script (`content.js`)
- **DEPRECATED in v3.2**: No longer injected (removed from manifest.json)
- **Security Improvement**: Removed `<all_urls>` permission for Chrome Store compliance
- File kept for reference only

## Data Structure

Bookmarks are stored as app objects with this structure:
```javascript
{
  id: Number,              // Timestamp-based unique ID
  url: String,             // Full URL
  title: String,           // Display title
  createdAt: Number,       // Timestamp
  favIconUrl: String|null, // Favicon URL
  faviconLastUpdated: Number,
  faviconSource: String,   // 'browser_tab', 'direct_favicon', 'manual', 'none'
  preserveOriginal: Boolean, // If true, don't refresh favicon
  needsRegeneration: Boolean, // If true, favicon will refresh on next open (v3.3.0+)
  lastUsed: Number         // Timestamp of last access
}
```

## Key Features & Implementation Details

### Dual Storage System
- **Main Launcher**: `hyperLauncherApps` - Primary bookmarks
- **Sickbay**: `hyperLauncherSickbayApps` - Temporary/read-later items
- Items can be moved between arrays via drag-and-drop or move button

### View Modes
- **Grid**: Standard tile grid with icons and titles
- **Thumbnail**: Square tiles showing only favicons (no titles visible, shown on hover)
- **List**: Horizontal list view
- View state persists separately for popup (`hyperLauncherViewPopup`) and full page (`hyperLauncherViewFullPage`)

### Favicon Management
- Browser tab favicons are captured when adding bookmarks
- Bookmarks with `preserveOriginal: true` won't have favicons auto-refreshed
- `refreshAllFavicons()` updates stale favicons (>1 week old) except preserved ones
- Direct favicon fetching from `https://{hostname}/favicon.ico` as fallback

### Search Area (Full Page Only)
- **Fixed footer approach**: Search area always visible at bottom of page
- **Glassmorphism effect**: Translucent background (`rgba(42, 42, 42, 0.7)`) with `backdrop-filter: blur(10px)`
- **Spacious padding**: 32px padding for comfortable interaction
- **Side-by-side buttons**: "Bookmark All Tabs to Main" and "Bookmark All Tabs to Sickbay" on same line
- **Width**: Fixed 600px max-width, centered horizontally
- **Note**: Dynamic positioning was intentionally removed in favor of always-accessible design (ADHD-friendly)

### Keyboard Shortcuts (Full Page)
**Critical**: All keyboard shortcuts check `this.isEditingText` before executing to prevent conflicts during title editing or form input.
- `1-3`: Switch between grid/thumbnail/list views
- `S`: Toggle Sickbay view
- `Cmd/Ctrl+Z`: Undo last action
- `Escape`: Clear search

### Security Measures
- **URL Validation**: All URLs validated against dangerous protocols (`javascript:`, `data:`, `vbscript:`, `file:`, `chrome:`, etc.)
- **Text Sanitization**: Replaces `<>"'&` with HTML entities
- **XSS Protection**: Toast notifications use `sanitizeText()` to prevent XSS
- **Special Pages**: chrome://, edge://, about:, file:// cannot be bookmarked
- **Prototype Pollution Protection**: Blocks `__proto__`, `constructor`, `prototype` keys in object sanitization
- **Content Script Removal**: No longer injects on `<all_urls>` (v3.2 security improvement)
- **Chrome Store Compliance**: Removed web_accessible_resources exposure (v3.2)

## Common Commands

### Development
This is a pure JavaScript Chrome extension with no build process. Changes to files are immediately available after reloading the extension in Chrome.

### Loading Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

### Debugging
- **Popup**: Right-click extension icon → Inspect popup
- **Full Page**: Open new tab → F12 to inspect
- **Background**: chrome://extensions/ → Service worker "Inspect"
- **Content Script**: Inspect any web page → Console shows injected script errors

### Testing Changes
After modifying code:
- **popup.js, fullpage.js, content.js**: Reload the extension (chrome://extensions/ → Reload button)
- **background.js**: Reload may not be sufficient; sometimes requires removing and re-adding the extension
- **HTML/CSS**: Just refresh the relevant page (popup or new tab)

### Data Management
- Export data: Settings dropdown → Export Data (creates JSON backup)
- Import data: Settings dropdown → Import Data (restores from JSON)
- Clear storage: `chrome.storage.local.clear()` in background service worker console

## Critical Implementation Notes

### Text Editing State
The full page implementation must maintain `this.isEditingText` state to track when users are editing titles or filling forms. This prevents keyboard shortcuts from interfering with text input. The state is set on `focusin` events for INPUT, TEXTAREA, or contentEditable elements and cleared on `focusout`.

### Grid Layout Application
Grid size classes (`compact`, `comfortable`, `roomy`) must be applied to the `appsContainer` element, not the grid itself. The `setGridLayout()` method in fullpage.js shows the correct implementation.

### Thumbnail View
In thumbnail view, tiles should be square with only the icon visible. Titles appear only on hover via tooltip. Click handling differs: any click on the tile (except action buttons) opens the app.

### Responsive Breakpoints (Tile Math Based)
The responsive breakpoint system in `fullpage.css` is calculated based on exact tile dimensions to prevent viewport overflow:

**Tile Math Formula:**
```
Minimum Viewport Width = (columns × tile_width) + (gaps × gap_width) + (2 × padding)
```

**Layout Calculations:**
- Comfortable (11 cols): (11×120) + (10×16) + 48 = **1528px minimum**
- Compact (9 cols): (9×120) + (8×16) + 48 = **1256px minimum**
- Roomy (22 cols): (22×120) + (21×16) + 48 = **3024px minimum**

**Breakpoint Strategy:**
1. **Ultra-wide (≥3040px)**: Roomy 22-column fixed grid
2. **Large Desktop (≥1540px)**: Comfortable 11-column fixed grid (default)
3. **Medium Desktop (1280-1539px)**: Compact 9-column fixed grid + flexible fallback
4. **Tablet (768-1279px)**: All layouts use flexible grids
5. **Mobile (<768px)**: Compact flexible grids

**View Mode Coverage:**
- Grid View: Fixed grids at desktop+, flexible grids at tablet/mobile
- Thumbnail View: Flexible auto-fill at all breakpoints
- List View: Single column (1fr) at all breakpoints

**Implementation:** See fullpage.css lines 1013-1040 for detailed documentation

## Common Gotchas

1. **Background service worker state**: Service workers can be terminated by Chrome. Don't rely on in-memory state persisting between events. Always read from chrome.storage for critical data.

2. **Content Security Policy**: Extension pages use strict CSP. No inline scripts, all JS must be in separate files referenced in manifest.json.

3. **Favicon loading**: Favicons from `chrome://favicon/` API are not accessible due to CSP. Use direct URL or browser tab favicon.

4. **Toast notifications**: Must be appended to document.body, not extension page containers, to ensure proper z-index stacking.

5. **View state persistence**: Popup and full page maintain separate view preferences. Don't assume they're synchronized.

6. **Drag and drop**: When dragging between Sickbay and Main, check both source and target arrays (`this.isShowingSickbay` and `this.draggedApp.isSickbay`).

## File Organization

```
/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker
├── popup.html/js/css      # Browser action popup
├── fullpage.html/js/css   # New tab override page
├── content.js             # Content script (minimal)
├── design-system.css      # Shared design tokens
├── styles.css             # Legacy/unused styles
└── icons/                 # Extension icons (16, 32, 48, 128)
```

## Storage Keys Reference

- `hyperLauncherApps`: Array of main launcher bookmarks
- `hyperLauncherSickbayApps`: Array of sickbay bookmarks
- `hyperLauncherViewPopup`: Current view mode for popup ('grid'|'thumbnail'|'list')
- `hyperLauncherViewFullPage`: Current view mode for full page
- `hyperLauncherTabMode`: Boolean, open links in background tabs
- `hyperLauncherGridLayout`: Grid size ('compact'|'comfortable'|'roomy')
- `hyperLauncherFirstTime`: Boolean, show onboarding
- `hyperLauncherNewTabSettings`: Object with new tab override preferences
- `hyperLauncherAnalytics`: Usage statistics object
- `hyperLauncherRecentEvents`: Array of recent events for debugging
- 3