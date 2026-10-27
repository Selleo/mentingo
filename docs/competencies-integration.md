# Competencies integration

The core `/api/competencies/*` module is a server-side proxy for the connected competencies plugin. UI, identities, group relationships and learning source data remain in core. Definitions, evidence decisions, evaluation, job profiles and development actions remain in the plugin. See the [business workflow](specs/competencies-business-spec.md).

## Setup and permissions

Connect the existing Mentingo tenant through Mission Control, or configure its encrypted `COMPETENCIES_BASE_URL` and `COMPETENCIES_API_KEY`. The URL is the platform origin without an API suffix. The key must belong to the same tenant and carry the independent `competencies` scope. The connection endpoints are `PUT/GET /api/integration/tenants/:tenantId/plugins/competencies`, protected by the existing managing-tenant integration-key rules. The status endpoint returns reachability and enabled state, never a key.

Plugin origins follow the shared integration URL policy: HTTPS with public DNS addresses, or plain loopback hosts outside production (for example, `http://localhost:3100`). Named local hosts such as `http://plugins.lms.localhost` are not accepted as plugin origins. Saved origins are checked again before competency requests.

The same validation applies to competency URLs saved through admin environment settings and integration endpoints. DNS validation has a five-second deadline; if it expires, retry the operation after checking connectivity.

`competencies.use` permits entry within the actor's scope. `competencies.manage` permits catalog/profile administration and condition overrides. Core rebuilds actor context from current active account/role data and group-manager relationships. The SDK transmits it only between servers. Browser bodies cannot supply permissions or managed subjects. Ordinary evidence review and external-loss revocation require designated manual-condition verifiers; administrative condition overrides are a separate operation.

Attachments pass through existing file validation before private plugin storage. The file limit is separate from the bounded multipart request limit, which includes trusted actor scope and metadata. Downloads recheck scope before delivery. Disabling the tenant's plugin entitlement preserves data and blocks protected actions and automatic processing.

Workspace queries accept `teamOnly=true` to restrict reads to current managed people. Every profile requirement is required. The matrix groups employees by their actual assigned profile.

Connected acceptance also checks that core account rename, archive and deletion retain the original plugin evidence, achieved level and open action history. Account lifecycle remains core-owned; unresolved identities cannot be reassigned to guessed people.

A designated verifier can select active people independently of the currently inspected subject. The plugin continues to authorize competency details separately; directory access does not grant planning or override rights. Administrators and managers assign or clear the active job profile from the employee list.

## Learning facts and commands

The new `GET /api/integration/learning-facts?subjectId=...&courseId=...` contract is separate from existing `training-results`. A complete snapshot includes its subject/course identity, monotonic revision and facts containing stable source/result identity, learning-state identity, fulfillment time, outcome, score and expiry. Course facts use actual certificate dates and invalidation state. Quiz and AI Mentor facts expose their assessment outcomes without conversations, prompts or hidden criteria.

Existing durable lesson/completion/certificate events and learning-source withdrawal events enqueue synchronization for the affected learner through the competencies BullMQ queue. Quiz and AI retakes and certificate resets publish state changes in the mutation transaction, independently of email preferences. Tenants without connection credentials do not enqueue competency synchronization; configured outages retain normal retry handling. Withdrawal and its event commit in the same transaction. The outbox awaits queue intake, delays failed intake before retrying, and recovers stalled competency events after a restart. Course assignments have priority over learning synchronization. There is no scheduled competency sweep or browser polling interval.

Opening a workspace with digital requirements or course actions refreshes learning facts for its authorized visible subjects before returning the assessment. This also initializes older results and reconciles removed sources. Local source queries are restricted to those subjects, and plugin-known scopes are filtered to the same subjects before snapshot delivery. Delivery uses bounded concurrency. Interrupted pagination and repeated cursors stop the refresh before any snapshot is sent. Exhausted retained jobs can be retried with a fresh eight-attempt budget by a subsequent source event; an on-demand workspace read can also restore current facts. Repeated fact delivery preserves original source dates.

The existing current/repetition learning states remain core-owned. Repetition is explicit and available only through existing course eligibility; competencies never reset progress. New accepted learning states and results have distinct source identities. Removed detailed results are reconciled as missing only through complete newer snapshots.

Course development actions claim a stable assignment receipt before queueing work. The worker reloads the actor's current account, permissions and managed scope, checks entitlement and course availability, then serializes subject/course enrollment. Existing enrollment is reused. A lost plugin confirmation can be retried without another enrollment. Final failures mark the matching receipt failed when the plugin is reachable. Practical work, instruction, mentoring and renewal coordination remain manual; marking an action complete does not grant a level.

External qualification loss is an explicit designated-verifier operation with affected current conditions and a mandatory reason. It preserves source results and attained history. Proof predating the loss no longer satisfies those conditions; fresh proof or explicitly authorized recognition can restore them. The operation does not reset a course or revoke a core certificate.

Administrative condition decisions use `set_condition_override` with the current definition revision, subject, condition, stable request ID, `met` or `automatic`, and a required comment. A negative override is rejected. New decisions retain the definition revision alongside their condition fingerprint and attributable history; older decisions remain readable. Workspace history identifies the current applicable decision so the editor cannot reuse a decision for changed criteria. Override-only achievements are captured when the decision commits, even if nobody reads the workspace before automatic evaluation is restored. Grants apply only to the exact unchanged condition. The operation does not call course-completion or certificate mutation APIs.

## Paged operational records

The `review-pending` and `review-history` record kinds separate the verifier queue from processed evidence. Counts and pagination are calculated after checking every referenced condition against the current verifier assignment and excluding self-review. The workspace `review` view omits evidence collections and history because the page loads them through these bounded record queries.

`GET /api/competencies/records` reads server-paginated actions, documents, action changes and linked evidence. It accepts `kind`, `page`, `pageSize` (10, 20, 50 or 100), and optional subject/action identities. Action-detail kinds require an action identity. Core derives the actor and permissions from the current authenticated account; the plugin applies tenant and subject/condition scope before pagination. Returned action pages include only the people needed to display the visible subjects and owners. Operational action lists omit cancelled entries without deleting their records. Workspace reads for the managed plans or Documents views omit unrelated history payloads; page changes use the records endpoint without repeating learning-source refreshes.

## Development and validation

The server SDK follows the phishing and content marketplace plugin boundary: core owns authenticated UI and learning source data, and the separately hosted plugin owns competency rules and records. The current development dependency remains a sibling `link:` and requires building that SDK before core. Registry distribution, replacement of the link and rollout are deferred.

Generate contracts through the repository scripts, never by editing generated clients:

```sh
cd apps/api
pnpm exec ts-node -r tsconfig-paths/register scripts/generate-competencies-schema.ts
pnpm exec ts-node -r tsconfig-paths/register scripts/generate-integration-schema.ts
cd ../..
pnpm generate:client
```

Use `pnpm lint-tsc-api`, `pnpm lint-tsc-web`, focused competencies/integration Jest tests and `pnpm build`. Database E2E setup must use a database distinct from the application's database; the test helpers reject matching targets before destructive setup. Inspect both URLs before running integration tests.

The connected Playwright acceptance scenario uses an already running, disposable test tenant. It creates a competency and exercises private evidence upload/download, manager actions, designated review, external-loss revocation and retained attainment. It checks that a manager without enrollment permission is denied, then confirms an authorized administrator's queued assignment. Cleanup cancels the test actions and archives the definition while retaining history. It also checks a 390 px viewport and keyboard dialog dismissal. It does not start another application or seed/reset a database when run with setup dependencies disabled and CI mode unset.

Provide `COMPETENCIES_E2E_FIXTURE` as JSON containing `host` and `people`, with `admin`, `student`, `manager` and `verifier` entries, each containing the existing `id` and `email`. Provide their shared test password through `COMPETENCIES_E2E_PASSWORD`. The manager must already manage the employee and have planning access without course enrollment; the administrator needs competency management and enrollment. At least one published course must be available to the manager. The test designates the verifier for its own new definition. Keep fixture credentials outside version control. Finish core builds before this scenario so development watchers do not reload contracts during the browser workflow.

```sh
pnpm --filter web exec playwright test e2e/specs/competencies/connected-workspace.spec.ts --project chromium --no-deps --workers 1
```

The test is opt-in and skips without that fixture. On Node 24, the current Playwright version requires `NODE_OPTIONS=--experimental-transform-types` for existing TypeScript enum imports. Runtime flags are local to the test command, not product configuration.
