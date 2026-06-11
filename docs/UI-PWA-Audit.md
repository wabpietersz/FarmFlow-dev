# FarmFlow UI and PWA Audit

## Date

2026-03-16

## Scope

Frontend shell, high-traffic entry screens, shared install/offline/update surfaces, and Progressive Web App configuration.

## UI Findings

1. The app shell was structurally consistent, but shared banners and prompts used bright standalone colors that diverged from the neutral operational UI described in `docs/UI-Handbook.md`.
2. Layout padding was repeated across the header, banners, and content without a shared shell alignment utility, which made top-level surfaces feel slightly disconnected.
3. The login screen used one-off inputs and button styles instead of the same card, input, label, and button primitives used across the authenticated app.
4. The dashboard still contained a few legacy accent treatments that felt more decorative than operational, especially in recent-activity labels.

## PWA Findings

1. PWA support was already present through `vite-plugin-pwa`, service-worker registration, install prompts, and offline queueing.
2. Manifest and HTML metadata used a green theme color that did not match the current monochrome product language.
3. The install/update surfaces behaved like add-on banners rather than part of the app shell.
4. The manifest could be strengthened with an explicit app `id`, language, display override, and route shortcuts.

## Changes Applied

- Added shared shell spacing utilities in `packages/frontend/src/index.css`.
- Refined the authenticated shell in `packages/frontend/src/components/layout/AppLayout.tsx`.
- Restyled install, offline, mobile-nav, and update surfaces to follow the existing handbook language.
- Rebuilt the login screen using shared UI primitives.
- Normalized theme-color metadata and strengthened the PWA manifest with shortcuts and standalone metadata.
- Reduced leftover dashboard accent styling to better fit the app’s restrained aesthetic.

## Remaining Follow-up

1. Several feature pages still use older page-local status color maps. They function correctly, but a shared status-token helper would make the full product more visually uniform.
2. A visual regression pass in a browser is still recommended after major module work, especially for dense tables and mobile dialogs.
