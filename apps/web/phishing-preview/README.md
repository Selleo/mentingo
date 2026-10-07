# Phishing actual-component UI regression

This preview mounts the production Phishing list, creation, report, hall and gate components with the application's CSS and existing UI primitives. **All data and mutations are fixtures**; hooks are explicitly aliased in `vite.config.ts`. It makes no API requests and cannot deliver email. It is not an authenticated-stack E2E test.

From the repository root (Node >=22.15, pnpm 10.22.0):

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm packages:build
corepack pnpm --filter web exec playwright install chromium
corepack pnpm --filter web exec playwright test --config phishing-preview/playwright.config.ts
```

For manual inspection:

```sh
corepack pnpm --filter web exec vite --config phishing-preview/vite.config.ts
```

Open `http://127.0.0.1:5198/phishing/new?lang=pl` (also `lang=en`). The banner identifies fixture data. `state=loading`, `state=error`, and `state=disabled` exercise capability-gate states on every route. Tests cover the scheduled creation → review → edit → fixture launch → list → report → cancellation confirmation dismissal → hall journey at 1440px and 390px, accessible controls, recipient removal, audience deduplication, no horizontal page overflow, and console errors. Unit tests additionally exercise confirmed cancellation and retry.

PNG screenshots (no videos) are written to `~/genie-coder/screens/phishing-fixture-*.png`. Vite is bound to localhost. The harness is outside production routes and build configuration.
