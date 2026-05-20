#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 /absolute/path/to/YourApp.app vX.Y.Z"
  exit 1
fi

APP_PATH="$1"
VERSION="$2"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Error: app bundle not found at $APP_PATH"
  exit 1
fi

if [[ "$APP_PATH" != *.app ]]; then
  echo "Error: first argument must be a .app bundle"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/dist/mac-companion"
mkdir -p "$OUTPUT_DIR"

APP_NAME="$(basename "$APP_PATH" .app)"
ARCHIVE_NAME="${APP_NAME}-macOS-unsigned-${VERSION}.zip"
ARCHIVE_PATH="$OUTPUT_DIR/$ARCHIVE_NAME"
CHECKSUM_PATH="$OUTPUT_DIR/${ARCHIVE_NAME}.sha256.txt"
NOTES_PATH="$OUTPUT_DIR/RELEASE_NOTES_${VERSION}.md"

echo "Packaging $APP_NAME..."
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ARCHIVE_PATH"

shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}' > "$CHECKSUM_PATH"

cat > "$NOTES_PATH" <<EOF
# ${APP_NAME} ${VERSION}

Unsigned macOS build.

## Install
1. Download \`${ARCHIVE_NAME}\`
2. Unzip
3. Move \`${APP_NAME}.app\` to Applications
4. Right-click app -> Open
5. If blocked, go to System Settings -> Privacy & Security -> Open Anyway

## SHA-256
\`$(cat "$CHECKSUM_PATH")\`
EOF

echo ""
echo "Release package created:"
echo "  $ARCHIVE_PATH"
echo "  $CHECKSUM_PATH"
echo "  $NOTES_PATH"

