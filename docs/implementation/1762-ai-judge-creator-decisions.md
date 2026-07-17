# #1762 AI Judge Creator — Temporary Decision Log

## Purpose

This is a temporary architecture decision log for the scoped AI Judge creator. Each implementation slice records the chosen boundary, the practical rationale, rejected alternatives, and follow-up consequences. It is intentionally implementation-focused and can be consolidated or removed when the feature is complete.

## 2026-07-16 — Generation contract boundary

**Status:** Accepted

### Decision

- Represent public generation input as a strict `create | improve` discriminated union.
- Keep the persisted Judge input, the model-facing referenced draft, and the final generated configuration as separate schemas.
- Use compact temporary references (`C1`, `C2`, `B1`) only in model-facing drafts and Validator findings.
- Represent Validator targets as a discriminated union, so a score-guidance finding must include a criterion reference and exact score while a blocking-error finding must use a blocking-error reference.
- Represent progress as status-specific events rather than one object with many optional properties.
- Derive the course base language on the server later; generation and validation requests contain no client-selected language.
- Include the independent validation request in the initial contract slice because it consumes the same context and Validator result boundary as generation.
- Return only ID-free configurations in terminal results. Failed and cancelled results may retain the latest structurally valid ID-free configuration when one exists.

### Rationale

- A discriminated request prevents invalid combinations such as `create` with a current configuration or `improve` without one, and gives controller/service code exhaustive narrowing.
- Model orchestration needs stable, short references across revisions, but database UUIDs are unreliable model output and would couple generation to persistence.
- A separate final schema makes stripping temporary references and persisted IDs an enforceable contract rather than a convention.
- Target-specific findings are easier to render and repair without parsing free-form paths or accepting contradictory target fields.
- Status-specific events make the frontend handle the real workflow explicitly: evaluating requires a draft, revising requires failed validation, and completed/requires-review require a reviewable final configuration.
- Server-derived language preserves the rule that structure is authored only in the course base language.

### Alternatives considered

- **One request with optional fields:** rejected because runtime validation would need to reconstruct mode-specific invariants and callers could send ambiguous payloads.
- **Reuse persisted configuration IDs as model references:** rejected because UUID reproduction is error-prone and exposes persistence concerns to the model.
- **One configuration schema for every boundary:** rejected because optional IDs and temporary references would become legal in places where they must never appear.
- **Generic progress payload with optional draft/validation/result fields:** rejected because it allows impossible states and shifts correctness checks into the UI.
- **JSON Patch or model-authored deltas:** deferred because full structured replacement is safer for v1; application code will compute display deltas later.

### Consequences and follow-ups

- The orchestration service must map persisted IDs to temporary references before model calls and strip references before returning a terminal result.
- Deterministic validation must additionally enforce graph invariants that JSON Schema cannot express cleanly, including unique references and exact score-guidance coverage.
- The streaming controller and frontend consumer can switch exhaustively on `status` without guessing which data is present.
- The next backend slice should extract/reuse deterministic Judge graph validation against both persisted input and referenced drafts.

## 2026-07-16 — Canonical identity-free Judge content schemas

**Status:** Accepted

### Decision

- Define the identity-free score-guidance, criterion, blocking-error, and configuration content schemas in the existing AI Judge configuration schema module.
- Derive persisted input schemas by adding optional UUID identities to those content properties.
- Derive model-facing drafts by adding temporary criterion and blocking-error references to the same content properties.
- Use the canonical identity-free configuration schema directly as the generated terminal configuration schema.
- Keep learner-runtime rubric types separate for now because they require database identities, a configuration ID, and normalized nullable values returned by SQL.

### Rationale

- Score ranges, required text, guidance structure, and threshold constraints now have one source of truth across manual authoring and AI generation.
- Identity remains a boundary concern: persisted writes may carry UUIDs, model drafts carry compact references, and terminal generated content carries neither.
- Reusing schema properties preserves strict `additionalProperties: false` objects while allowing each boundary to add its own identity fields.
- Runtime rubrics are read models rather than authoring inputs, so forcing them into the same schema would weaken either database-read guarantees or authoring validation.

### Alternatives considered

- **Keep duplicated generation schemas:** rejected because score bounds and required fields could drift from manual Judge configuration.
- **Reuse the persisted input schema directly:** rejected because its optional UUIDs would become legal in generated model output.
- **Recursively remove IDs with `Type.Omit`:** rejected because TypeBox omission is shallow and would not remove nested criterion and guidance IDs safely.
- **Immediately replace all runtime Judge types:** deferred because that is a broader read-model refactor without a benefit to the generation slice.

### Consequences and follow-ups

- Any future authoring constraint shared by manual and generated configurations should be changed in the canonical content schemas.
- Deterministic graph validation remains necessary for cross-field rules such as exact `0..maxScore` coverage and uniqueness.
- Runtime rubric consolidation can be considered separately if a schema-backed database read model becomes useful.

## 2026-07-16 — Pure identity-neutral content validation

**Status:** Accepted

### Decision

- Extract cross-field rubric validation into a pure `validateAiJudgeConfigurationContent` function.
- Return all deterministic content issues as explicit discriminated types instead of throwing framework exceptions.
- Identify affected criteria by array index and exact score rather than UUID or temporary reference.
- Keep persistence identity validation in `AiJudgeConfigurationGraphService` and adapt the first content issue to the existing translated `BadRequestException` keys.
- Validate guidance score range, duplicate scores, and complete `0..maxScore` coverage; keep empty criteria and blocking-error arrays valid.

### Rationale

- Manual persistence and AI generation now evaluate the same cross-field scoring invariants.
- An identity-neutral index can be mapped to persisted nodes or generated `C1` references without coupling the shared validator to either representation.
- Returning issues lets generation provide precise repair context while preserving the existing API's exception behavior.
- TypeBox remains responsible for local field shape and bounds; the pure validator handles relationships between fields that JSON Schema does not express cleanly.

### Alternatives considered

- **Keep validation private in the graph service:** rejected because generation would duplicate the same scoring rules.
- **Throw `BadRequestException` from the shared validator:** rejected because model orchestration is not an HTTP boundary and needs structured correction data.
- **Include UUID and temporary-reference checks:** rejected because identity validation differs between persistence and generation.
- **Move semantic quality checks into deterministic validation:** rejected because measurability, overlap, and example quality require semantic evaluation.

### Consequences and follow-ups

- The generation layer must map `criterionIndex` to the referenced draft's criterion ref when constructing repair findings.
- Persisted create/update behavior and translated error keys remain unchanged.
- A later generation-specific validator will add temporary-reference uniqueness and preservation checks around this shared content validator.

## 2026-07-16 — Composable Generator and semantic Validator prompts

**Status:** Accepted

### Decision

- Compose the Generator from one invariant base prompt and one small mode add-on for create, improve, or internal repair.
- Keep the semantic Validator as a separate prompt with a separate responsibility and structured output.
- Render only the server-derived target language into these system templates. Pass creator briefs, lesson context, configurations, and findings later as explicitly delimited request content.
- Require complete referenced configurations from every Generator mode and compact targeted findings from the Validator.
- Keep weak, partial, and strong response simulations internal to the Validator and prohibit returning private reasoning.
- Treat all creator and lesson content as untrusted data that cannot alter roles, schemas, validation policy, or publication behavior.

### Rationale

- A shared base prevents scoring, reference, security, and output rules from drifting between modes.
- Small mode add-ons make intent explicit without duplicating the large invariant prompt or introducing separate agent implementations.
- Keeping large dynamic payloads outside YAML reduces template size, avoids repeated serialization, and makes trust boundaries visible at the eventual model-call site.
- Separate Generator and Validator prompts reduce self-approval bias and allow different structured-output schemas and model settings later.
- Compact Validator output provides actionable repair context and UI feedback without exposing chain-of-thought or wasting tokens on full simulations.

### Alternatives considered

- **One monolithic prompt with conditional variables:** rejected because Langfuse-compatible templates should avoid complex conditional behavior and every mode would receive irrelevant instructions.
- **Separate complete prompts per mode:** rejected because invariant rules would be duplicated and likely drift.
- **Interpolate the complete configuration into YAML:** rejected because it increases token duplication and makes untrusted content easier to confuse with system instructions.
- **Ask the Validator to rewrite the configuration:** rejected because validation must remain non-mutating and the Generator owns all changes.
- **Return simulated learner responses:** rejected because they add cost without helping orchestration or creator review and risk exposing hidden evaluation reasoning.

### Consequences and follow-ups

- The Generator service must load the base and selected add-on separately and concatenate them as system instructions.
- The model-call service must delimit and label dynamic content consistently and never interpolate it into the invariant prompts.
- Generator and Validator structured-output services remain the next implementation slice; this change only establishes authoritative prompt sources and variable contracts.
- Learner-name personalization remains a separate prompt slice because it affects live Mentor behavior rather than Judge configuration generation.

## 2026-07-16 — Core-first implementation with deferred fixed-contract Luma support

**Status:** Accepted

### Decision

- Implement and validate the complete Generator/Validator workflow against the Mentingo Core runtime before changing `mentingo-ai` or `@japro/luma-sdk`.
- Keep the Core services provider-neutral during that work, but do not add mocked Luma methods, unused SDK types, or fallback branches prematurely.
- Add Luma support as the final backend integration slice through two capability-specific endpoints with fixed generation and validation response schemas.
- Keep prompts, deterministic validation, orchestration, retries, cancellation, and final result normalization in Core.
- Prohibit caller-provided JSON Schemas and generic structured-generation endpoints.

### Rationale

- Core-first execution lets the product workflow and structured contracts stabilize before they are duplicated across OpenAPI, Python models, the SDK, and runtime routing.
- Fixed Luma endpoints support local/custom models without turning Luma into an unrestricted structured-generation proxy.
- Keeping orchestration in Core guarantees identical retry and validation behavior for Core and Luma providers.
- Deferring integration avoids repeatedly regenerating and packaging the SDK while contracts are still changing.

### Alternatives considered

- **Implement Core, Luma, and SDK simultaneously:** rejected because contract iteration would require coordinated changes and regeneration across three repositories for every adjustment.
- **Send arbitrary JSON Schemas to a generic Luma endpoint:** rejected because it broadens the public API into a general structured-output execution surface and weakens versioned validation.
- **Let Luma own the bounded loop:** rejected because provider selection would change application behavior and duplicate Core's deterministic validation and progress state.
- **Leave Luma permanently out of scope:** rejected because configured local/custom models must ultimately support the authoring workflow.

### Consequences and follow-ups

- The immediate next slice implements Core Generator and Validator model-call services only.
- Once the Core workflow passes focused tests, add fixed Luma Pydantic contracts, endpoints, capability mapping, OpenAPI/SDK generation, and Core fallback tests.
- Until that final integration slice, Luma-selected environments will use the Core implementation for this new capability rather than an incomplete adapter.

## 2026-07-16 — Ephemeral BullMQ generation with socket progress

**Status:** Accepted

### Decision

- Run the bounded Generator/Validator workflow as a BullMQ job and use its Redis-backed progress and return value as temporary workflow state.
- Publish generation progress through Mentingo's existing authenticated socket infrastructure and provide a snapshot read endpoint for initial load and reconnect recovery.
- Generate an opaque `generationId` for addressing the job and include it in every socket/snapshot envelope.
- Keep `brief` as a frontend-only dialog view. Backend generation begins at `drafting`.
- Retain jobs for a short configured period and persist only a configuration the creator explicitly applies through the existing lesson flow.
- Do not add Postgres generation-job or attempt-history tables in v1.

### Rationale

- Generation is temporary authoring work, while BullMQ already provides background execution, progress, retries, and short-lived Redis state.
- Sockets provide responsive stage updates without tying model execution to one HTTP connection.
- The snapshot endpoint prevents missed socket events or reconnects from losing the current view.
- Avoiding relational history keeps drafts, attempts, and provider failures out of permanent business data until resumable generation or audit history becomes a real requirement.

### Alternatives considered

- **Persist every job and attempt in Postgres:** rejected because v1 does not expose generation history or resumable drafts.
- **Use sockets as the only state:** rejected because clients can subscribe late or disconnect temporarily.
- **Use one long SSE request:** rejected because generation should continue independently of the dialog connection and Mentingo already has authenticated socket infrastructure.
- **Run generation synchronously in the controller:** rejected because the bounded repair loop is generated-content processing and belongs in the existing queue boundary.

### Consequences and follow-ups

- The workflow worker must update one typed progress snapshot after every stage and preserve the latest structurally valid draft.
- Socket subscription and snapshot/cancel endpoints must enforce tenant and actor ownership.
- Cancellation must be cooperative between model calls and use provider abort support where available.
- The independent one-call Validator remains synchronous and does not require a BullMQ job.

## 2026-07-16 — Feature-owned model calls and transport-neutral workflow

**Status:** Accepted

### Decision

- Keep Generator prompt composition, structured model invocation, schema verification, and observation inside `AiJudgeConfigurationGeneratorService`.
- Keep Validator prompt composition, structured model invocation, schema and target verification, and deterministic pass derivation inside `AiJudgeConfigurationValidatorService`.
- Do not add feature-specific Generator or Validator methods to the general `ChatService`.
- Coordinate the bounded quality loop in `AiJudgeConfigurationGenerationWorkflowService` through transport-neutral progress and cancellation callbacks.
- Use one generation-mode constant for create, improve, and internal repair. Public request schemas remain responsible for excluding repair.
- Keep `brief` outside backend generation status. An absent frontend generation snapshot renders the brief view.

### Rationale

- Each model service owns one complete observable operation and cannot acquire persistence or workflow responsibilities accidentally.
- The workflow can be exercised deterministically without Redis, sockets, controllers, or a live model.
- Queue and socket adapters can publish the same typed progress events without changing generation policy.
- One mode vocabulary avoids duplicate constants while the API schema still expresses the public/internal boundary precisely.

### Alternatives considered

- **Put structured calls in `ChatService`:** rejected because it makes the general chat transport aware of one feature's schemas and prompt semantics.
- **Let Generator own retries and persistence:** rejected because model invocation, bounded coordination, and explicit creator save are separate responsibilities.
- **Put BullMQ operations directly in the workflow:** rejected because it would make focused validation and future provider routing dependent on Redis.
- **Include `brief` as a generation status:** rejected because no backend work exists until the creator submits the brief.

### Consequences and follow-ups

- The BullMQ worker will adapt `reportProgress` to both `job.updateProgress` and authenticated per-user socket delivery.
- The worker will adapt temporary cancellation state to `isCancelled` and later pass abort signals into active model calls where supported.
- Controller and queue services remain thin ownership, enqueue, snapshot, and cancellation boundaries.

## 2026-07-17 — One deterministic validation code family

**Status:** Accepted

### Decision

- Reuse `AI_JUDGE_CONTENT_VALIDATION_CODE` for every deterministic Judge draft defect, including duplicate criterion and blocking-error references.
- Do not introduce a separate reference-validation constant for two additional codes.
- Export union aliases only when a consumer needs the named type; schema-derived and unused aliases are removed.
- Keep semantic Validator issue codes as validated non-empty strings rather than a closed enum.

### Rationale

- Scoring-guidance and reference checks are one deterministic validation layer and are handled together before semantic evaluation.
- One code family makes switch statements, tests, and repair messages easier to trace without creating a constant object for every small subgroup.
- Runtime constants remain useful where schemas and control flow consume their values, while unused aliases add navigation noise without strengthening the contract.
- Semantic issue categories can evolve with the evaluator prompt; orchestration depends on severity and typed targets, not on an exhaustive model-generated code list.

### Alternatives considered

- **Keep a separate reference-code constant:** rejected because it had only two consumers in the same validation function and no independent behavior.
- **Create an enum for every semantic issue:** rejected because it would either reject valid newly identified quality defects or require continuous code changes for presentation-only labels.
- **Remove all named constants and use raw strings:** rejected because deterministic codes, statuses, modes, and targets participate in schemas and control flow.

### Consequences and follow-ups

- New deterministic Judge validations should extend the existing code family unless they form a genuinely separate validation subsystem.
- Semantic issue `code` remains diagnostic metadata; UI behavior must continue to use severity, target, message, and correction.

## 2026-07-17 — Stable references define draft identity

**Status:** Accepted

### Decision

- Convert persisted configurations into model-facing drafts with deterministic `C1..Cn` and `B1..Bn` references and a separate JSON-serializable identity map.
- Preserve criterion and blocking-error IDs whenever their stable reference remains in the generated result, including when their content changes.
- Preserve score-guidance IDs by criterion reference plus exact score.
- Leave genuinely new references and scores ID-free and omit identities for removed nodes.
- Require new references to continue after the highest previously assigned number without gaps; removed references are never reassigned during the flow.
- Compute UI changes from consecutive referenced drafts in application code. Validator findings remain recommendations rather than executable changes.

### Rationale

- Application code cannot reliably determine semantic equivalence without another probabilistic model decision.
- Stable handles make identity preservation deterministic across wording improvements, retries, and reordering.
- Exact score already defines a guidance row's position inside a criterion, so another model-facing guidance ID would add tokens without improving matching.
- A serializable identity map can safely cross the planned BullMQ boundary, unlike runtime `Map` instances or closure state.
- Deterministic diffs ensure the UI reports what the Generator actually changed rather than what the Validator suggested changing.

### Alternatives considered

- **Reattach IDs only after semantic comparison:** rejected because semantic matching would be probabilistic and could unexpectedly replace persisted rows.
- **Match criteria by title or array position:** rejected because both can change during legitimate improvement and reordering.
- **Expose UUIDs to the model:** rejected because long opaque identifiers increase output errors and leak persistence details into prompt contracts.
- **Give every score-guidance row its own temporary reference:** rejected because criterion reference plus exact score is already unique and required by scoring validation.

### Consequences and follow-ups

- The application service must keep the identity map with the temporary job and reconcile the terminal referenced draft before returning it to the lesson form.
- Changed localized fields still require explicit translation invalidation; stable row identity does not imply translated content remains valid.
- Persisted historical judgement evidence remains protected by existing snapshot fields while current configuration rows retain stable IDs.

## 2026-07-17 — Linear validation pipeline inside each attempt

**Status:** Accepted

### Decision

- Combine reference-transition and self-contained content findings into one deterministic issue list after every Generator call.
- Run the semantic Validator only when that combined deterministic list is empty.
- Feed deterministic and semantic validation results into one shared completed, requires-review, or revising decision path.
- Keep result/event constructors separate from workflow decisions and reporting.
- Keep cancellation checks explicit before generation, after generation, and after semantic validation.

### Rationale

- All failed validations have the same retry policy, so separate reference, content, and semantic repair branches duplicated terminal checks, progress reporting, and repair-input construction.
- A single linear path makes the maximum-three-attempt policy visible without introducing another state-machine abstraction.
- Explicit cancellation calls document the only safe interruption boundaries and are meaningful repetition rather than accidental duplication.
- Pure result constructors keep event shapes consistent while leaving control flow readable in `runAttempts`.

### Alternatives considered

- **Keep one repair branch per validator:** rejected because every branch performed the same requires-review and revision operations.
- **Represent each attempt as a generic state-machine transition table:** rejected because seven statuses and three deliberate cancellation boundaries remain clearer as straightforward control flow.
- **Hide cancellation in a generic attempt wrapper:** rejected because it would obscure whether cancellation occurs before or after a model call and which draft is retained.

### Consequences and follow-ups

- New deterministic validators should append findings to the combined deterministic list rather than add another repair branch.
- The application service can treat every terminal workflow result uniformly regardless of whether earlier repairs were structural or semantic.

## 2026-07-17 — Lesson-owned authoring application boundary

**Status:** Accepted

### Decision

- Keep model generation and semantic validation in `AiModule`, but own authoring authorization and API composition in the lesson domain.
- Expose focused endpoints under `/ai/judge-configuration` from a controller registered by `LessonModule` rather than making `AiModule` import `LessonModule`.
- Derive the generation language from the editable course and verify that an optional persisted lesson belongs to the supplied course.
- Treat the complete configuration submitted by the editor as authoritative input for improve and independent validation, including unsaved form changes.
- Convert persisted IDs to compact references before model calls, observe the latest referenced draft internally, and reconcile stable IDs before returning a form-ready result.
- Execute this first Core application adapter synchronously. It never saves the returned configuration; BullMQ and socket progress will wrap the same boundary next.

### Rationale

- `LessonModule` already imports `AiModule`, while the course and lesson modules have an existing relationship. Importing lesson services back into `AiModule` would create another circular dependency solely to place methods on the broad `AiController` class.
- Course editability, curriculum feature availability, access, lesson ownership, and base language are lesson-authoring concerns rather than model concerns.
- Reloading the persisted Judge graph would discard edits currently present only in React Hook Form, making Improve and Check quality evaluate stale content.
- Stable-reference reconciliation must happen outside the model workflow because model-facing drafts must never contain database UUIDs.
- A synchronous adapter lets the authorization and transformation contract be tested before queue ownership, reconnect recovery, cancellation storage, and socket delivery are introduced.

### Alternatives considered

- **Inject lesson authoring services into `AiModule`:** rejected because it adds a circular module dependency and couples generic AI runtime code to curriculum editing.
- **Reload the current configuration from Postgres:** rejected because it ignores unsaved editor changes.
- **Return temporary references to the browser:** rejected because references are orchestration details and the form needs existing database IDs for stable updates.
- **Save after successful generation:** rejected because AI output must remain a reviewable draft and explicit lesson/configuration save remains authoritative.
- **Add BullMQ in the same step:** deferred so the domain boundary can be tested without mixing queue lifecycle failures with generation correctness.

### Consequences and follow-ups

- The current generation HTTP call returns only the terminal result; real stage progress still requires the planned BullMQ snapshot and socket adapter.
- The application result may contain existing criterion, guidance, and blocking-error IDs, while model and workflow results remain UUID-free.
- The BullMQ payload must preserve the serializable identity lookup and the authenticated generation owner.
