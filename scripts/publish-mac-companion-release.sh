#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 vX.Y.Z /absolute/path/to/release.zip /absolute/path/to/release-notes.md"
  exit 1
fi

VERSION="$1"
ZIP_PATH="$2"
NOTES_PATH="$3"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is required. Install from https://cli.github.com/"
  exit 1
fi

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Error: release archive not found: $ZIP_PATH"
  exit 1
fi

if [[ ! -f "$NOTES_PATH" ]]; then
  echo "Error: release notes file not found: $NOTES_PATH"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECKSUM_FILE="${ZIP_PATH}.sha256.txt"

if [[ ! -f "$CHECKSUM_FILE" ]]; then
  echo "Generating checksum file..."
  shasum -a 256 "$ZIP_PATH" | awk '{print $1}' > "$CHECKSUM_FILE"
fi

cd "$ROOT_DIR"

echo "Checking GitHub authentication..."
gh auth status >/dev/null

echo "Creating GitHub release $VERSION..."
gh release create "$VERSION" \
  "$ZIP_PATH" \
  "$CHECKSUM_FILE" \
  --title "$VERSION" \
  --notes-file "$NOTES_PATH"

echo "Done: https://github.com/jimenezbryan/RS3FlipTracker/releases/tag/$VERSION"

