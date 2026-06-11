#!/usr/bin/env bash
# Build Python sidecar binary with PyInstaller
# Output: backend/dist/attribution-engine (macOS/Linux) or .exe (Windows)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
DIST_DIR="$BACKEND_DIR/dist"
SIDECAR_DIR="$PROJECT_DIR/src-tauri/sidecar"

echo "=== PyInstaller Sidecar Builder ==="
echo "Backend dir:  $BACKEND_DIR"
echo "Dist dir:     $DIST_DIR"
echo "Sidecar dir:  $SIDECAR_DIR"

# Install dependencies
echo ""
echo ">>> Installing Python dependencies..."
pip install -r "$BACKEND_DIR/requirements.txt" --quiet
pip install pyinstaller --quiet

# Build the standalone binary
echo ""
echo ">>> Running PyInstaller..."
cd "$BACKEND_DIR"
pyinstaller \
    --onefile \
    --name attribution-engine \
    --distpath "$DIST_DIR" \
    --workpath /tmp/pyinstaller-work \
    --add-data "app/config.py:app" \
    --hidden-import openpyxl \
    --hidden-import pandas \
    --hidden-import numpy \
    --clean \
    --noconfirm \
    run.py

# Verify
BINARY="$DIST_DIR/attribution-engine"
if [ -f "$BINARY" ]; then
    echo ""
    echo "Sidecar built: $BINARY"
    ls -lh "$BINARY"
else
    echo ""
    echo "Build failed: binary not found"
    exit 1
fi

# Copy into Tauri sidecar resources
mkdir -p "$SIDECAR_DIR"
cp "$BINARY" "$SIDECAR_DIR/"
echo "Copied to $SIDECAR_DIR/"

# Create dummy icon files if they don't exist (Tauri requires them)
ICONS_DIR="$PROJECT_DIR/src-tauri/icons"
if [ ! -f "$ICONS_DIR/icon.ico" ]; then
    echo ""
    echo ">>> Generating placeholder icons..."
    mkdir -p "$ICONS_DIR"
    python3 -c "
import struct, zlib

def create_png(width, height, filename):
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            raw += b'\x1f\x4e\x79'
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    with open(filename, 'wb') as f:
        f.write(header + ihdr + idat + iend)

create_png(32, 32, '$ICONS_DIR/32x32.png')
create_png(128, 128, '$ICONS_DIR/128x128.png')
create_png(256, 256, '$ICONS_DIR/128x128@2x.png')
print('Icons generated')
"
fi

echo ""
echo "=== Sidecar build complete ==="
