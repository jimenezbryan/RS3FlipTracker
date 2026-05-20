# Mac Companion Free Distribution (No Apple Developer Account)

This guide documents the free distribution path for an unsigned macOS companion app.

## What this setup gives you

- Publish downloadable app builds on GitHub Releases
- Provide checksum verification for users
- No paid Apple Developer account required

## Limitations

- App is unsigned and not notarized
- Users will see macOS security prompts on first launch
- Some users may need an extra terminal command to remove quarantine

## Maintainer workflow

### 1) Package a release zip

Run:

```bash
./scripts/create-mac-companion-release.sh /absolute/path/to/YourApp.app v0.1.0
```

This generates:

- `dist/mac-companion/YourApp-macOS-unsigned-v0.1.0.zip`
- `dist/mac-companion/YourApp-macOS-unsigned-v0.1.0.zip.sha256.txt`
- `dist/mac-companion/RELEASE_NOTES_v0.1.0.md`

### 2) Publish to GitHub Releases

Make sure GitHub CLI is installed and authenticated:

```bash
gh auth login
```

Then publish:

```bash
./scripts/publish-mac-companion-release.sh \
  v0.1.0 \
  /absolute/path/to/YourApp-macOS-unsigned-v0.1.0.zip \
  /absolute/path/to/RELEASE_NOTES_v0.1.0.md
```

## End-user install instructions

Share this with users:

1. Download latest `.zip` from Releases
2. Unzip and move `.app` to `Applications`
3. Right-click app -> `Open`
4. If macOS blocks it:
   - Go to `System Settings -> Privacy & Security`
   - Click `Open Anyway`
5. If still blocked, run:

```bash
xattr -dr com.apple.quarantine /Applications/YourApp.app
```

## Recommended release notes template

- Version
- What changed
- Known issues
- Install steps
- SHA-256 checksum
