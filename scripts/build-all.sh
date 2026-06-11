#!/usr/bin/env bash
# Full production build pipeline
# 1. Build Python sidecar (PyInstaller)
# 2. Build Tauri desktop app (npm + cargo)
# 3. Collect artifacts into dist/release/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="$PROJECT_DIR/dist/release"

echo "=========================================="
echo "   Performance Attribution - Prod Build"
echo "=========================================="
echo ""

# Step 1 - Sidecar
echo "--- Step 1/3: Python Sidecar ---"
bash "$SCRIPT_DIR/build-sidecar.sh"

# Step 2 - Frontend
echo ""
echo "--- Step 2/3: Frontend Build ---"
cd "$PROJECT_DIR"
npm ci --silent
npx tsc --noEmit
npx vite build
echo "Frontend built -> dist/"

# Step 3 - Tauri
echo ""
echo "--- Step 3/3: Tauri Bundle ---"
cd "$PROJECT_DIR"
npx tauri build

# Collect artifacts
echo ""
echo "--- Collecting Artifacts ---"
mkdir -p "$RELEASE_DIR"

if [ -d "$PROJECT_DIR/src-tauri/target/release/bundle" ]; then
    BUNDLE_DIR="$PROJECT_DIR/src-tauri/target/release/bundle"
    cp -r "$BUNDLE_DIR"/* "$RELEASE_DIR/" 2>/dev/null || true
    echo "Bundled installer -> $RELEASE_DIR"
else
    echo "Bundle directory not found - check Tauri build output"
fi

mkdir -p "$RELEASE_DIR/sidecar"
cp "$PROJECT_DIR/src-tauri/sidecar/attribution-engine" "$RELEASE_DIR/sidecar/" 2>/dev/null || true

echo ""
echo "=========================================="
echo "   Build Complete"
echo "   Release: $RELEASE_DIR"
echo "=========================================="
ls -la "$RELEASE_DIR/" 2>/dev/null || echo "(release directory empty)"
