# Dose — Peptide Protocol Tracker

A mobile-first, installable web app (PWA) for tracking personal peptide and supplement
protocols: dose scheduling, reconstitution math, and inventory forecasting. Single user,
local-first — all data stays on-device in IndexedDB, with JSON export/import for backup.

Built with React, TypeScript, Vite, Tailwind CSS, Dexie, and vite-plugin-pwa.

## Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
```

## Build

```bash
npm run build
```

## Deployment

Pushing to `main` builds and deploys automatically to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Enable Pages under
**Settings → Pages → Source: GitHub Actions** on first setup.
