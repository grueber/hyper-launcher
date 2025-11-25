# Privacy Policy for Hyper Launcher

**Last Updated**: November 25, 2025
**Version**: 3.3.4

## Overview

Hyper Launcher is committed to protecting your privacy. This extension operates entirely on your local device and does not collect, transmit, or share any personal data.

## Data Collection

**We do NOT collect any data.**

Hyper Launcher does not:
- Collect personal information
- Track your browsing activity
- Transmit data to external servers
- Use analytics or tracking services
- Share data with third parties

## Data Storage

All data is stored **locally on your device** using Chrome's local storage API:

### What is Stored Locally:
- **Bookmark URLs** - The web addresses you save
- **Bookmark Titles** - The names you give to your bookmarks (editable via Edit Bookmark feature)
- **Favicon URLs** - Website icons for visual identification (editable via Edit Bookmark feature)
- **User Preferences** - Your settings (view mode, layout, tab behavior, grid size)
- **Timestamps** - When bookmarks were created or last used
- **Favicon Metadata** - Favicon source type and last update time for automatic refresh
- **Temporary Flags** - Internal flags like "needs favicon regeneration" when you edit bookmark URLs

### Where is Data Stored:
- All data remains on your device in Chrome's local storage
- Data is NOT synchronized across devices unless you use Chrome Sync
- Data is NOT accessible to other extensions or websites

## Permissions Explained

Hyper Launcher requests the following permissions:

### Required Permissions:

**Storage**
- Purpose: Save your bookmarks and preferences locally on your device
- Scope: Local device only, never transmitted externally

**Active Tab**
- Purpose: Detect the current page URL, title, and favicon when you add a bookmark
- Scope: Only when you actively click "Add Bookmark" or use keyboard shortcut

**Tabs**
- Purpose: (1) Bookmark all open tabs at once with one click, (2) Capture tab favicons for better visual identification
- Scope: Only accesses tabs when you use "Bookmark All Tabs" feature or add bookmarks

**Context Menus**
- Purpose: Right-click menu option "Add to Hyper Launcher" to quickly add bookmarks
- Scope: Only adds a menu item, doesn't access page content

**Notifications**
- Purpose: Optional notifications for bookmark actions (e.g., "Bookmark added", import errors)
- Scope: Local notifications only, no data transmitted

**Alarms**
- Purpose: Schedule periodic maintenance tasks (automatic favicon refresh for stale favicons, analytics cleanup)
- Scope: Background tasks run locally to keep bookmark favicons current

### Optional Permissions (requested when needed):

**Downloads** (Optional)
- Purpose: Export your bookmarks as a JSON backup file
- When: Only requested when you click "Export Data"
- Note: Not required for core functionality

**Bookmarks** (Optional)
- Purpose: Reserved for future feature to sync with Chrome's native bookmarks
- Status: Not currently implemented or used

## Third-Party Services

**None.** Hyper Launcher does not use any third-party services, analytics, or tracking.

## Data Security

Your data is protected by:
- **Local-only storage** - Never leaves your device
- **Chrome's security model** - Protected by browser sandboxing
- **No network transmission** - No data sent to external servers
- **Input sanitization** - All user input is sanitized to prevent XSS attacks
- **URL validation** - Dangerous protocols (javascript:, data:, file:) are blocked
- **Favicon URL validation** - Protection against CSS injection attacks
- **Prototype pollution protection** - Safe JSON parsing during import operations

## Data Export & Deletion

You have complete control over your data:

### Export Your Data:
1. Open Hyper Launcher
2. Click Settings (⚙️)
3. Click "Export Data"
4. Save the JSON file to your computer

### Delete Your Data:
1. Uninstall the extension to remove all local data
2. Or use Chrome's settings: chrome://settings/siteData
3. Or clear individual bookmarks from within the extension

## Children's Privacy

Hyper Launcher does not knowingly collect any information from anyone, including children under 13. The extension is safe for all ages.

## Changes to This Policy

We will update this privacy policy if our data practices change. Changes will be reflected in:
- The "Last Updated" date above
- The version number
- The extension's changelog
- Chrome Web Store listing

### Recent Updates:
- **v3.3.4 (November 2025)**: Updated to reflect current permissions (tabs and alarms are now required), added security enhancements, documented Edit Bookmark feature
- **v3.2.0 (October 2024)**: Initial release with core privacy-first architecture

## Open Source

Hyper Launcher is open source. You can review the code to verify our privacy practices:
- GitHub Repository: [To be added - will be included after repository setup]
- No hidden tracking or data collection
- All source code publicly available for review

## Contact

If you have questions about this privacy policy or your data:

- **Chrome Web Store**: Leave a review or report an issue through the Chrome Web Store support page
- **GitHub Issues**: [To be added - will be included after repository setup]

## Your Rights

You have the right to:
- ✅ Know what data is stored (listed above)
- ✅ Export your data at any time
- ✅ Delete your data by uninstalling
- ✅ Use the extension without creating an account
- ✅ Request clarification about our practices

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Children's Online Privacy Protection Act (COPPA)

---

**Summary**: Hyper Launcher stores your bookmarks locally on your device. We don't collect, transmit, or share any data. Your privacy is 100% protected.
