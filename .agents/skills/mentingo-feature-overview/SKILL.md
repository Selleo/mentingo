---
name: mentingo-feature-overview
description: Mentingo-specific feature discovery and business explanation workflow. Use when Codex needs to understand a Mentingo product feature by reading its implementation, frontend E2E tests, backend E2E specs, routes, API contracts, permissions, shared constants, and user-facing flows, then save a high-level HR and L&D business spec with only the most important technical context.
---

# Mentingo Feature Overview

Use this skill to explain how a Mentingo feature works and why it matters to HR and L&D users. Read broadly, but report selectively.

## Discovery Workflow

1. Read the repo instructions first:

   - Start with root `AGENTS.md`.
   - Read `apps/api/AGENTS.md` when the feature touches backend code, contracts, permissions, tenants, jobs, events, uploads, or API tests.
   - Read `apps/web/AGENTS.md` when the feature touches Remix routes, UI modules, generated API usage, TanStack Query hooks, route access, i18n, sockets, uploads, Vitest, or Playwright.

2. Find the feature surface with `rg` and `rg --files`. Search by product wording, route names, module names, API method names, permission names, E2E spec titles, and visible labels.

3. Map the frontend behavior:

   - `apps/web/app/modules`
   - `apps/web/routes.ts`
   - `apps/web/app/api/queries` and `apps/web/app/api/mutations`
   - `apps/web/app/config/routeAccessConfig.ts`
   - `apps/web/app/locales/*/translation.json`
   - Related components, stores, hooks, and UI data constants.

4. Map the frontend E2E evidence:

   - `apps/web/e2e/specs`
   - `apps/web/e2e/flows`
   - `apps/web/e2e/factories`
   - `apps/web/e2e/fixtures`
   - `apps/web/e2e/data/*/handles.ts`
   - `apps/web/e2e/strategy.md`

5. Map the backend behavior:

   - `apps/api/src/<domain>/*.controller.ts`
   - `apps/api/src/<domain>/*.service.ts`
   - `apps/api/src/<domain>/repositories`
   - `apps/api/src/<domain>/schemas`
   - Related jobs, events, outbox publishers, websocket gateways, file/upload helpers, settings, and integrations.

6. Map the backend E2E evidence:

   - `apps/api/src/**/__tests__/*.e2e-spec.ts`
   - Relevant factories and helpers under `apps/api/test`.

7. Map shared contracts:
   - `packages/shared/src/constants/permissions.ts`
   - `packages/shared/src/constants/languages.ts`
   - Other shared constants, helpers, types, tenant/session/access utilities, and exported values used by both apps.

## Source Discipline

- Prefer direct source and test evidence over inferred product claims.
- Tie each important business claim to observed UI behavior, API behavior, permissions, E2E assertions, domain logic, or shared constants.
- Mention when behavior is inferred from implementation rather than directly covered by tests.
- Do not include a complete implementation inventory in the final answer. Keep only technical details that explain user-visible behavior, risk, ownership, permissions, tenant/language constraints, or test confidence.
- Avoid reading generated or low-signal artifacts unless needed for traceability:
  - `apps/web/app/api/generated-api.ts`
  - `apps/api/src/swagger/api-schema.json`
  - `apps/web/e2e/.auth`
- Only mutate files for the requested specs under `docs/specs`. Do not edit product code, tests, generated files, migrations, or unrelated documentation while using this skill.

## Business Lens

Frame the feature for HR and L&D stakeholders:

- Who uses it: HR admins, L&D managers, content creators, learners, managers, support, or platform admins.
- What concrete job they are trying to finish: building onboarding from internal documents, creating sales-technique training for a team, assigning compliance courses, practicing real-life roleplay scenarios, proving completion, or reviewing learner outcomes.
- What value it creates: faster training creation, better learner practice, clearer ownership, safer access control, better reporting, multilingual delivery, auditability, or operational consistency.

Keep implementation details as evidence, not the headline.

Translate implementation nouns into product nouns:

- Say "learners receive the announcement in their feed", not "`user_announcements` records are created".
- Say "HR can target a specific group", not "the service filters by `groupId`".
- Say "the system excludes users who manage announcements", not "users with user-management permission are excluded", unless the permission detail is the point.
- Say "due-date reminders reach the learner who needs to act", not "a direct announcement row is inserted".

## Editorial Rules

Apply these rules before writing or updating a spec.

- Lead with business value, then explain mechanics. The first sentence of each section should make sense to an HR, L&D, manager, or learner audience without code knowledge.
- Make roles concrete and source-backed. Name a role only when UI, route access, permissions, tests, or product copy show that role can actually use or benefit from the feature. If source evidence is weak, omit the role or mark it as an inference in `Key Technical Context`.
- Write `Who Uses It` as persona + scenario + outcome, not generic role labels. Prefer "HR managers create onboarding courses from internal documentation" over "L&D admins accelerate training."
- Order `Feature Functions` by user value. Put the most important business capabilities first; put availability rules, configuration gates, restrictions, and safeguards near the end or in `Key Technical Context`.
- Keep `End-User Value` positive and outcome-focused. Do not spend this section on limitations, eligibility rules, configuration requirements, or implementation constraints.
- Start `How It Works` with the human workflow: what the user wants, what they do, how Mentingo helps, and what visible result they get. Put configuration checks, empty-state rules, background processing, and source-code mechanics after the user-facing flow.
- Explain external or internal platform names the first time they matter. For example, describe Luma as Mentingo's connected AI service for course generation, AI mentor behavior, or voice-mode configuration before relying on the name.
- Do not promote invisible implementation details to product capabilities. If a user cannot directly understand or operate something in the UI, keep it in `Key Technical Context` or omit it.
- Remove duplicate bullets and vague wording. Avoid unexplained phrases like "validity impact", "create or load a draft", "existing curriculum", "when supported by configuration", or "voice input" when the product meaning is really configuration or setup.
- When a feature is powered mostly by an external service and source code shows only the integration boundary, describe the visible user conversation or workflow as an evidence-backed inference and keep vendor mechanics brief.

## File Output

Save the result to one Markdown file under `docs/specs`. Create `docs/specs` if it does not exist.

Use a lowercase hyphen-case feature slug derived from the user-facing feature name:

- Business spec: `docs/specs/<feature-slug>-business-spec.md`

If the file already exists, update it in place only when the user is clearly asking to refresh that feature spec.

After writing the file, keep the chat response short: list the path and mention validation or notable uncertainty only if relevant.

## Business Spec Format

Write the business spec file with these sections.

### Business Overview

Explain in a few paragraphs:

- What the feature enables.
- Who benefits from it.
- Why it matters for HR and L&D.
- The main workflow from a user's perspective.

### Who Uses It

List the primary roles and what each role does with the feature. Each bullet should include a concrete use case or outcome, not only a role name.

### Feature Functions

List the main things the feature lets users or the system do, phrased as product capabilities. Use 4-8 bullets. Start each bullet with a verb, for example:

- Create targeted announcements.
- Notify learners about course due dates.
- Send updates to participants in a live training.
- Let learners review unread messages.

Put the highest-value user capabilities first. Put restrictions, setup requirements, and configuration-dependent behavior last unless they are the main business point.

Do not describe functions as database writes, service methods, controller endpoints, queues, permission checks, generated images, cache refreshes, or backend-only calculations. Move those details to `Key Technical Context` only if they are essential.

### End-User Value

Summarize value in HR/L&D terms: operational efficiency, learning delivery, learner experience, reporting/compliance, access control, tenant isolation, or multilingual support when relevant.

Focus this section on benefits. Put limitations and technical constraints in `How It Works` or `Key Technical Context`.

### How It Works

Describe the workflow at product level in business language. Start with what the user is trying to accomplish, what they do, what Mentingo does for them, and what outcome appears in the product. Include only enough technical detail to make the behavior credible.

If the implementation has important eligibility or setup rules, explain them after the main user-facing workflow. Do not open this section with configuration checks unless the configuration experience itself is the feature.

Do not write database-shaped prose here. Avoid table names, record names, DTO names, permissions constants, repositories, and service internals. If the implementation has special targeting, delivery, access, or automation rules, translate them into user-facing behavior.

For example, for announcements, prefer:

"Admins can publish updates to the whole organization, a selected group, learners enrolled in a live training, or an individual learner who needs a due-date reminder. Mentingo turns each choice into the right audience so learners only see relevant messages, while operational/admin users are not interrupted by learner-facing announcements."

Avoid:

"Delivery creates `user_announcements` records for the right audience. Group announcements go only to users in that group..."

### Key Technical Context

List only the most important implementation facts, usually 3-6 bullets. Prefer:

- The main user-facing route or module.
- The main API/domain area if it affects the workflow.
- Critical permissions, tenant isolation, or language behavior.
- One or two source files that best support the feature summary.
- Important external integrations or configuration boundaries, explained in product language.

Do not list every controller, service, repository, schema, hook, generated method, or helper discovered during research.

### Test Evidence

Explain only the most important frontend E2E and backend E2E coverage: what user workflow or API behavior the tests prove, and any notable missing coverage. Avoid enumerating every spec file unless there are only one or two.

## Quality Bar

- Be concise enough for a stakeholder to read quickly.
- Be specific enough that an engineer can audit every important claim without turning the answer into a code inventory.
- Use exact feature terms from the product when discoverable.
- Prefer active, business-readable language over code structure narration.
- Do not oversell. If tests or source evidence do not prove a claim, label it as an inference.
- Before finishing, reread the spec as a reviewer and remove unsupported roles, implementation-first bullets, duplicate capabilities, unexplained vendor terms, vague labels, and limitations placed in value sections.
