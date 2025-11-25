# Hyper Launcher v3.2

**An ADHD-friendly Chrome extension for bookmark management and quick app launching**

![Version](https://img.shields.io/badge/version-3.2.5-blue.svg)
![Manifest V3](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Overview

Hyper Launcher replaces Chrome's new tab page with a customizable launcher featuring:
- **Dual Storage System**: Main launcher + temporary "Sickbay" for read-later items
- **Multiple View Modes**: Grid, thumbnail, and list views
- **Drag & Drop**: Reorder and organize bookmarks visually
- **Keyboard Shortcuts**: Fast navigation without touching the mouse
- **Smart Search**: Real-time filtering across titles and URLs
- **Import/Export**: JSON backup system with security validation

## Current Status

**Production Version: 3.2.5**
**Status: Chrome Web Store Submission Ready**
**Last Updated: November 6, 2025**

### Recent Bug Fixes (3.2.1 → 3.2.5)
- ✅ Fixed chrome.contextMenus API initialization error
- ✅ Fixed chrome.alarms API initialization error
- ✅ Fixed first-run initialization race condition
- ✅ Fixed null safety in utility functions
- ✅ Fixed popup first-run initialization
- ✅ Fixed bookmarkAllTabs generating invalid decimal IDs

**Package Ready**: `hyper-launcher-v3.2.5-20251106-181925.zip` (91KB, 18 files)

## Features

### Core Functionality
- **Bookmark Management**: Add, delete, move, and organize bookmarks
- **Favicon Management**: Auto-refresh with browser tab preservation
- **Search & Filter**: Real-time search across all bookmarks
- **Undo System**: Stack-based undo for destructive operations (10 levels)
- **Tab Mode**: Toggle between background/foreground tab opening
- **Grid Layouts**: 3 size options (compact, comfortable, roomy)

### View Modes
1. **Grid View**: Standard tile grid with icons and titles
2. **Thumbnail View**: Icon-only square tiles (titles on hover)
3. **List View**: Horizontal list with compact spacing

### Dual Interface
- **Popup** (480×600px): Quick access via extension icon
- **Fullpage** (New Tab): Enhanced interface with keyboard shortcuts

### Keyboard Shortcuts (Fullpage)
- `1-3`: Switch view modes (grid/thumbnail/list)
- `S`: Toggle Sickbay view
- `Cmd/Ctrl+Z`: Undo last action
- `Escape`: Clear search

### Security Features
- Input sanitization (XSS protection)
- URL validation (blocks dangerous protocols)
- Rate limiting (prevents DOS)
- Prototype pollution protection (import safety)
- Safe favicon handling (CSS injection prevention)

## Installation

### For Development
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

### For Testing Chrome Store Package
1. Run `bash create-package.sh` to generate ZIP
2. Move ZIP to separate directory and unzip
3. Load unpacked from unzipped directory
4. Test thoroughly before submission

## Project Structure

```
/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js             # Service worker (906 lines)
├── popup.html/js/css         # Popup interface (641 lines JS)
├── fullpage.html/js/css      # New tab override (3050 lines JS)
├── design-system.css         # Shared design tokens
├── design-system-components.css  # Component-only styles (819 lines)
├── icons/                    # Extension icons (16, 32, 48, 128px)
├── _designsystem/            # Living design system documentation
├── __tests__/                # Jest unit tests (147 tests, 100% passing)
├── CLAUDE.md                 # AI assistant instructions
├── implementation.md         # Implementation status & technical debt
├── README.md                 # This file
└── create-package.sh         # Chrome Web Store packaging script
```

## Architecture

### Storage Keys
- `hyperLauncherApps` - Main launcher bookmarks (array)
- `hyperLauncherSickbayApps` - Temporary bookmarks (array)
- `hyperLauncherViewPopup` - Popup view preference (string)
- `hyperLauncherViewFullPage` - Fullpage view preference (string)
- `hyperLauncherTabMode` - Background/foreground tab mode (boolean)
- `hyperLauncherGridLayout` - Grid size preference (string)
- `hyperLauncherFirstTime` - Onboarding flag (boolean)
- `hyperLauncherCompactMode` - Popup compact mode (boolean)

### Bookmark Object Schema
```javascript
{
  id: Number,                  // Timestamp-based unique ID
  url: String,                 // Full URL
  title: String,               // Display title
  createdAt: Number,          // Timestamp
  favIconUrl: String|null,    // Favicon URL
  faviconLastUpdated: Number, // Timestamp
  faviconSource: String,      // 'browser_tab', 'direct_favicon', 'manual', 'none'
  preserveOriginal: Boolean,  // If true, don't auto-refresh favicon
  lastUsed: Number            // Timestamp of last access
}
```

## Testing

### Run Tests
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode for development
npm run test:coverage   # Generate coverage report
```

### Test Coverage
- **Total Tests**: 147 (100% passing)
- **Files Covered**: background.js, fullpage.js, popup.js
- **Focus Areas**: Validation, sanitization, security functions

## Development Workflow

### Making Changes
1. Edit source files (no build process required)
2. Reload extension in `chrome://extensions/`
3. Test changes in browser
4. Run `npm test` to verify tests pass

### Creating a New Release
1. Update version in `manifest.json`
2. Update version headers in `background.js`, `fullpage.js`, `popup.js`
3. Update `create-package.sh` version
4. Update `CLAUDE.md` version history
5. Run `bash create-package.sh` to create package
6. Test package thoroughly
7. Submit to Chrome Web Store

### Version Policy (Semantic Versioning)
- **Major (3.x.x)**: Breaking changes, architectural rewrites
- **Minor (x.2.x)**: New features, non-breaking enhancements
- **Patch (x.x.1)**: Bug fixes, security patches

**Current Production Branch: 3.2.x** - All production bug fixes increment patch version

## Documentation

- **CLAUDE.md** - Development principles, coding standards, AI assistant instructions
- **implementation.md** - Current state, technical debt, architecture decisions
- **_designsystem/index.html** - Living design system with all UI components

## Tech Stack

- **Pure Vanilla JavaScript** - No frameworks, no build process
- **Chrome Extension APIs** - Manifest V3
- **Jest** - Testing framework (147 unit tests)
- **CSS Custom Properties** - Design tokens system

## Security

- All user input sanitized before storage/display
- URL validation blocks dangerous protocols
- Rate limiting prevents abuse
- Prototype pollution protection on imports
- CSP-compliant (no inline scripts)

## Known Issues

**None at this time.** Version 3.2.5 has resolved all known first-run initialization and data integrity bugs.

## Contributing

This is a personal project, but if you find bugs or have suggestions:
1. Document the issue in `implementation.md` under "Known Bugs"
2. Include reproduction steps and expected vs actual behavior
3. Create a test case in `__tests__/` if applicable

## License

MIT License - See LICENSE file for details

## Support

For questions or issues:
- Check `implementation.md` for technical debt and known issues
- Review `CLAUDE.md` for development principles
- Inspect `_designsystem/index.html` for component documentation

---

**Built with focus, designed for ADHD, powered by vanilla JS.**
