# FlipSync Mac Companion (MVP)

This is a lightweight Electron app that:

1. Captures a screenshot from macOS
2. Sends screenshot to FlipSync backend for server-side GE history parsing
3. Parses buy/sell rows
4. Sends parsed rows to FlipSync backend ingest API

## Backend requirements

This companion expects these API routes in the main app:

- `GET /api/companion/token` (session-authenticated)
- `GET /api/companion/me` (Bearer token)
- `POST /api/companion/parse/ge-history` (Bearer token)
- `POST /api/companion/ingest/ge-history` (Bearer token)

## Local run

```bash
cd companion/macos-electron
npm install
npm run start
```

## Build unsigned macOS app

```bash
cd companion/macos-electron
npm install
npm run package:mac
```

Build artifacts are emitted under `dist/`.

## User flow

1. In FlipSync web app, while logged in, call `/api/companion/token` and copy token
2. Open companion app and paste:
   - Base URL (example: `https://rs3-flip-tracker.vercel.app`)
   - Token
3. Verify token
4. Capture screen with GE history visible (server parses rows)
5. Review parsed rows
6. Send to FlipSync

## Notes

- This MVP captures full screen; parse quality depends on GE history visibility and UI scale.
- Unmatched sells are reported back by the API and can be handled manually.
