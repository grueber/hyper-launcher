#!/bin/bash

# Hyper Launcher - Chrome Web Store Package Creator
# Version: 3.3.4
# This script creates a clean ZIP package for Chrome Web Store submission

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Hyper Launcher - Chrome Web Store Package Creator     ║${NC}"
echo -e "${GREEN}║                     Version 3.3.4                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Package name with timestamp
PACKAGE_NAME="hyper-launcher-v3.3.4-$(date +%Y%m%d-%H%M%S).zip"

echo -e "${YELLOW}📦 Creating package: ${PACKAGE_NAME}${NC}"
echo ""

# Pre-flight checks
echo -e "${YELLOW}🔍 Running pre-flight checks...${NC}"

# Check if required files exist
REQUIRED_FILES=(
    "manifest.json"
    "background.js"
    "popup.html"
    "popup.js"
    "popup.css"
    "fullpage.html"
    "fullpage.js"
    "fullpage.css"
    "design-system.css"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Error: Required file missing: $file${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $file"
done

# Check if icons directory exists
if [ ! -d "icons" ]; then
    echo -e "${RED}❌ Error: icons directory missing${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} icons/"

# Check if design system exists
if [ ! -d "designsystem" ]; then
    echo -e "${RED}❌ Error: designsystem directory missing${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} designsystem/"

echo ""
echo -e "${YELLOW}🧹 Checking for TODO comments...${NC}"

# Check for TODO comments (excluding node_modules and .git)
TODO_COUNT=$(grep -r "TODO\|FIXME\|HACK\|XXX" \
    --include="*.js" \
    --include="*.css" \
    --include="*.html" \
    --exclude-dir="node_modules" \
    --exclude-dir=".git" \
    . 2>/dev/null | wc -l | tr -d ' ')

if [ "$TODO_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Found $TODO_COUNT TODO/FIXME/HACK/XXX comments in code${NC}"
    echo -e "${YELLOW}   These should be removed before submission${NC}"
    grep -r "TODO\|FIXME\|HACK\|XXX" \
        --include="*.js" \
        --include="*.css" \
        --include="*.html" \
        --exclude-dir="node_modules" \
        --exclude-dir=".git" \
        -n . 2>/dev/null | head -5
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} No TODO comments found"
fi

echo ""
echo -e "${YELLOW}📝 Checking manifest.json...${NC}"

# Check manifest version
MANIFEST_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' manifest.json | cut -d'"' -f4)
echo -e "${GREEN}✓${NC} Version: $MANIFEST_VERSION"

# Check manifest_version is 3
MANIFEST_V=$(grep -o '"manifest_version"[[:space:]]*:[[:space:]]*[0-9]*' manifest.json | grep -o '[0-9]*$')
if [ "$MANIFEST_V" != "3" ]; then
    echo -e "${RED}❌ Error: manifest_version must be 3 (found: $MANIFEST_V)${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Manifest V3"

echo ""
echo -e "${YELLOW}🗜️  Creating ZIP package...${NC}"

# Remove old package if exists
if [ -f "$PACKAGE_NAME" ]; then
    rm "$PACKAGE_NAME"
    echo -e "${YELLOW}   Removed existing package${NC}"
fi

# Create the ZIP file
# Include only necessary files, exclude development files
zip -r "$PACKAGE_NAME" \
    manifest.json \
    background.js \
    popup.html \
    popup.js \
    popup.css \
    fullpage.html \
    fullpage.js \
    fullpage.css \
    design-system.css \
    icons/ \
    designsystem/ \
    -x "*.DS_Store" \
    -x "*node_modules*" \
    -x "*.git*" \
    -x "*.md" \
    -x "package*.json" \
    -x "*.sh" \
    -x "*/__pycache__/*" \
    -x "*.pyc" \
    > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Package created successfully"
else
    echo -e "${RED}❌ Error creating package${NC}"
    exit 1
fi

# Get package size
PACKAGE_SIZE=$(ls -lh "$PACKAGE_NAME" | awk '{print $5}')
echo ""
echo -e "${GREEN}✅ Package ready for submission!${NC}"
echo ""
echo -e "${YELLOW}📊 Package Information:${NC}"
echo -e "   Name: $PACKAGE_NAME"
echo -e "   Size: $PACKAGE_SIZE"
echo -e "   Version: $MANIFEST_VERSION"
echo ""

# Show package contents
echo -e "${YELLOW}📂 Package contents:${NC}"
# BSD-compatible way to show package contents (skip header and footer)
TOTAL_LINES=$(unzip -l "$PACKAGE_NAME" | wc -l | tr -d ' ')
CONTENT_LINES=$((TOTAL_LINES - 5))  # Skip 3 header lines + 2 footer lines
unzip -l "$PACKAGE_NAME" | tail -n +4 | head -n "$CONTENT_LINES" | awk '{print "   "$NF}'
echo ""

# Calculate total files
FILE_COUNT=$(unzip -l "$PACKAGE_NAME" | grep "files$" | awk '{print $(NF-1)}')
echo -e "${GREEN}   Total: $FILE_COUNT files${NC}"
echo ""

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    NEXT STEPS                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "1. Test the package:"
echo -e "   - Open chrome://extensions/"
echo -e "   - Enable Developer mode"
echo -e "   - Click 'Load unpacked' and select this directory"
echo -e "   - Test thoroughly using TESTING_CHECKLIST.md"
echo ""
echo -e "2. Prepare store listing:"
echo -e "   - Create 1280×800 screenshots (min 1, max 5)"
echo -e "   - Optional: Create promotional images"
echo -e "   - Host PRIVACY_POLICY.md online (GitHub Pages, etc.)"
echo ""
echo -e "3. Submit to Chrome Web Store:"
echo -e "   - Go to: chrome.google.com/webstore/devconsole"
echo -e "   - Click 'New Item'"
echo -e "   - Upload: ${YELLOW}${PACKAGE_NAME}${NC}"
echo -e "   - Fill out store listing details"
echo -e "   - Submit for review"
echo ""
echo -e "${GREEN}Good luck with your submission! 🚀${NC}"
