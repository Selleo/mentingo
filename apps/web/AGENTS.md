# AGENTS.md

## Purpose

Frontend-specific instructions for `apps/web`. Preserve generated API usage, route access, i18n behavior, and existing E2E patterns.

## Tech Stack

- Remix + Vite + React 18.
- Routing: explicit routes in `routes.ts`.
- Data fetching: TanStack Query in `app/api/queries` and `app/api/mutations`.
- API client: generated Axios client in `app/api/generated-api.ts`, wrapped by `app/api/api-client.ts`.
- Styling/UI: Tailwind, Radix UI, shadcn-style primitives in `app/components/ui`, `lucide-react`.
- Forms: `react-hook-form`, Zod/resolvers where module patterns use them.
- State: Zustand stores in module/store folders.
- Tests: Vitest and Playwright.

## Commands

- Dev server: `pnpm --filter=web dev`.
- Test-mode dev server: `pnpm --filter=web dev:test`.
- Build: `pnpm --filter=web build`.
- Lint/typecheck: `pnpm --filter=web lint-tsc`.
- Unit tests: `pnpm --filter=web test`.
- E2E tests: `pnpm --filter=web test:e2e`.
- Generate API client: `pnpm --filter=web generate:client`.

## Frontend Structure

- `app/root.tsx` — root document, providers, error boundary.
- `routes.ts` — Remix route definitions.
- `app/modules/` — page/domain modules.
- `app/components/` — shared components and UI primitives.
- `app/api/api-client.ts` — centralized API client/interceptors.
- `app/api/generated-api.ts` — generated API client; do not edit.
- `app/api/queries/` and `app/api/mutations/` — TanStack Query hooks.
- `app/config/routeAccessConfig.ts` — route permission rules.
- `app/locales/*/translation.json` — UI translations.
- `e2e/` — Playwright fixtures, factories, flows, selectors, specs.

## Frontend Rules

- Use `ApiClient.api...`; do not call backend endpoints with raw `fetch`, raw Axios, or `instance.post`.
- Regenerate `app/api/generated-api.ts` with `pnpm --filter=web generate:client` after API schema changes.
- Put server-state reads/writes in `app/api/queries` and `app/api/mutations`; keep components focused on UI and orchestration.
- Keep each TanStack Query hook in its own file: one query per file in `app/api/queries` and one mutation per file in `app/api/mutations`.
- Invalidate existing query keys/options after mutations; search for the domain query hook before creating a new key.
- For query invalidation, import and use the shared `queryClient` from `app/api/queryClient.ts`; do not create local `useQueryClient()` instances for invalidation.
- Put mutation-owned query invalidation and success toasts in the mutation hook `onSuccess`, not inline page/component callbacks. Keep UI-only effects such as closing dialogs and navigation close to the UI flow.
- In components, destructure mutation results at the hook call site, e.g. `const { mutateAsync: updateItem, isPending } = useUpdateItem();`; do not call `mutation.mutateAsync(...)`.
- In mutation error toasts, use `getTranslatedApiErrorMessage(error, t, fallback)` from `app/api/utils/getTranslatedApiErrorMessage.ts` instead of custom `AxiosError` branches.
- Add routes in `routes.ts` and update `app/config/routeAccessConfig.ts` for protected pages.
- Use `PERMISSIONS` and permission helpers from `@repo/shared`; do not hardcode role-name UI gates unless the existing feature already does.
- Reuse `app/components/ui`, `PageWrapper`, form components, and module components before adding new primitives.
- Use `cn` from `app/lib/utils.ts` for conditional `className` values instead of ternaries, template literals, string concatenation, or array joins.
- Add visible strings to all locale files, not only English or Polish.
- Keep component prop types in the component file they belong to. Use separate `*.types.ts` files for shared/reused domain, API, hook, reducer, or cross-component types, not for a single component's props.
- For Zustand stores, subscribe with selectors in components, e.g. `useLanguageStore((state) => state.language)`. Avoid `useLanguageStore.getState()` during render because it is not reactive and can miss or over-broaden updates; reserve `getState()` for loaders, event handlers, or non-render code.

## Important Flows

### API Request Flow

- Client: `app/api/api-client.ts`.
- Generated methods/types: `app/api/generated-api.ts`.
- Query client: `app/api/queryClient.ts`.
- Hooks: `app/api/queries/`, `app/api/mutations/`.
- Agent rule: use generated methods and existing query invalidation patterns.

### Auth And Session Flow

- Pages: `app/modules/Auth/`.
- Auth store/service: `app/modules/Auth/authStore.ts`, `app/modules/Auth/authService.ts`.
- Current user query: `app/api/queries/useCurrentUser.ts`.
- Guards: `app/Guards/AccessGuard.tsx`, `app/Guards/RouteGuard.tsx`, `app/Guards/MFAGuard.tsx`.
- Agent rule: do not rely on frontend guards as the only security; keep API permissions authoritative.

### Route Permission Flow

- Config: `app/config/routeAccessConfig.ts`.
- Enforcement: `app/Guards/RouteGuard.tsx`.
- Shared constants: `packages/shared/src/constants/permissions.ts`.
- Agent rule: every new protected route needs an explicit permission requirement.

### Language And I18n Flow

- Setup: `i18n.ts`.
- Provider: `app/modules/Dashboard/Settings/Language/LanguageProvider.tsx`.
- Shared constant: `packages/shared/src/constants/languages.ts`.
- Locales: `app/locales/en|pl|de|lt|cs/translation.json`.
- Agent rule: use `SUPPORTED_LANGUAGES`; preserve `baseLanguage`, `availableLocales`, and explicit `language` params in content flows.

### Course And Content Flow

- Admin pages: `app/modules/Admin/AddCourse`, `app/modules/Admin/EditCourse`, `app/modules/Admin/Courses`.
- Student pages: `app/modules/Courses`.
- API hooks: `app/api/queries/useCourse.ts`, `app/api/queries/useLessons.ts`, `app/api/mutations/admin/*Lesson*`, `app/api/mutations/admin/*Course*`.
- E2E flows: `e2e/flows/courses`, `e2e/flows/curriculum`.
- Agent rule: preserve content-language behavior and course access distinctions when changing course UI.

### Realtime And Upload Flow

- Socket helper: `app/api/socket`.
- Upload notifications: `app/hooks/useGlobalVideoUploadNotifications.ts`.
- Learning time: `app/hooks/useLearningTimeTracker.ts`.
- Rich text uploads: `app/hooks/buildRichTextFileUploadHandler.ts`, `app/hooks/useRichTextUploadQueue.ts`.
- Agent rule: clean up socket listeners and reuse existing upload queue/TUS helpers.

## Testing

- Unit/component tests use Vitest; test utilities are in `app/utils/testUtils.tsx` and mocks under `app/utils/mocks`.
- Playwright config is `playwright.config.ts`.
- E2E selectors live in `e2e/data/*/handles.ts`; use `data-testid` from those files instead of brittle text/CSS selectors.
- E2E setup uses `e2e/fixtures`, `e2e/factories`, and `e2e/flows`.
- E2E API setup uses `e2e/utils/api-client.ts`, which wraps the generated API.
- Prefer readonly fixtures for assertions and worker/isolated fixtures for mutations.
- Keep to the conventions in `e2e/strategy.md`:
  - use `withReadonlyPage` for non-mutating specs;
  - use `withWorkerPage` for mutating specs;
  - register cleanup for created entities unless test purpose is persistence validation;
  - keep UI assertions in specs and backend consistency checks through `expect.poll(...)`.

## Safety Boundaries

- Do not edit `app/api/generated-api.ts` by hand.
- Do not hardcode API URLs; use `VITE_API_URL` handling in `app/api/api-client.ts`.
- Do not store secrets in frontend code or envs prefixed with `VITE_`.
- Do not introduce a new UI, state, form, or data-fetching library without approval.
- Do not show content in the wrong UI/content language when existing flows filter by language availability.
- Do not replace deterministic E2E setup with live AI/chat/judge flows.
