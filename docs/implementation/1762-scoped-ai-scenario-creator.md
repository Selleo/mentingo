# #1762 AI Judge Configuration Creator

## Summary

Add a scoped AI authoring tool to the existing AI Mentor lesson editor. A creator describes the intended assessment once, then a bounded Generator/Validator loop produces a structured AI Judge configuration for review in the existing editor.

This plan covers only the remaining AI creation flow. The normalized Judge schema and CRUD, manual editor, multilingual configuration, deterministic learner scoring, judgement persistence, master-course copying, generated-course contracts, and learner-facing result UI already exist and are prerequisites rather than implementation scope here.

Implementation decisions and their rationale are recorded incrementally in [`1762-ai-judge-creator-decisions.md`](./1762-ai-judge-creator-decisions.md). Update that temporary decision log with every implementation slice so later work can preserve or deliberately revise earlier boundaries.

## Product Decisions

- Support every existing AI Mentor type. The lesson's current Mentor type remains an independent selector and is passed to generation as context.
- Generate only the structured AI Judge configuration. Do not change the task description, AI Mentor instructions, persona, voice, resources, publication state, or other lesson fields.
- Generate structure only in the course base language. Existing translation generation handles the other available course languages after the base configuration is saved.
- Do not expose learner level, language, Mentor type, attachments, or other additional-context controls in the creation dialog.
- Automatically use the current lesson title, task description, AI Mentor instructions, Mentor type, and optional existing Judge configuration as generation context.
- Generated output is always a reviewable draft. Generation never creates a lesson, saves a configuration, updates a published course, or applies changes automatically.
- Use a bounded Generator/Validator loop with at most three Generator attempts. A failed quality check pauses the flow and requires creator approval before the next attempt. This is a narrow application workflow, not a generic multi-agent framework.
- Allow the semantic Validator to run independently against any current configuration: a newly generated draft, unsaved manual edits, or an already persisted Judge configuration.
- Allow creators to rerun the complete improvement flow later with the current configuration plus a new instruction. A prior generation brief is useful context during the active flow but is not required for future validation or improvement.
- Keep model writes as complete configuration replacements. Do not ask the model to emit JSON Patch or executable field deltas; application code derives the actual delta and reattaches stable persisted IDs where items remain semantically the same.
- Expose only `create` and `improve` as Generator modes. There is no separate regenerate mode: once a draft exists, any further AI generation is an improvement using the complete current draft as context.
- Use the same Generator service, model, structured-output schema, and model settings for create, improve, and the internal repair step. Compose one invariant base prompt with a small intent-specific YAML add-on.
- Do not persist generation jobs, attempts, prompts, or Validator history in Postgres. Keep the active draft and progress in the current authoring flow.
- Do not add a generic AI chat, partial JSON patches, autonomous publishing, negative scoring, or a visual agent graph.
- Implement and validate the complete Generator/Validator workflow in Mentingo Core first. After the Core workflow works end to end, add Luma and Luma SDK support through fixed capability-specific contracts; do not add unused SDK types, mocked adapters, or dead fallback code during the Core-first slices.
- In the same branch, add automatic learner first-name personalization to text and voice AI Mentor conversations, including the welcome message.

## User Flow

```text
AI Judge card
  -> Describe assessment
  -> Generate draft
  -> Validate quality
  -> Review Validator findings
  -> Approve revision when needed, up to 3 attempts
  -> Review in existing Judge editor
  -> Review in the normal editor -> explicitly save
```

### Entry points

- An unconfigured AI Judge card shows:
  - Primary: **Create assessment with AI**.
  - Secondary: **Configure manually**.
- A configured card keeps one **Review assessment** action. **Improve with AI** and **Check quality with AI** live inside the structured editor so the card is not overloaded.
- AI structure actions remain visible but disabled with the existing base-language tooltip when the creator is editing a non-base language.
- **Improve with AI** uses the currently displayed complete configuration as input but does not mutate the stored configuration until explicit Save.
- **Check quality with AI** validates the currently displayed complete configuration without generating, applying, or saving changes.

### Brief dialog

- Use a centered dialog titled **Create assessment with AI** or **Improve assessment with AI**.
- Show one required focused rich-text editor using the same Tiptap `BaseEditor` surface as AI Mentor instructions.
- Prompt the creator to describe:
  - what the learner should achieve,
  - which observable behaviors demonstrate success,
  - which serious mistakes should prevent completion.
- For Improve, show the existing AI Mentor-style suggestion actions directly below the editor. They append a concrete improvement instruction without submitting automatically.
- For Create, show one quiet inline list explaining that AI creates the task goal, criteria, scores, exact-score guidance, passing threshold, and blocking errors.
- Remove the mockup's level, language, type, attachment controls, large “AI will create” side card, and redundant current-assessment preview.
- Primary action: **Generate draft**. Closing the dialog before generation changes nothing.

### Generation progress

- Show real workflow stages backed by progress events:
  1. **Generating draft**
  2. **Quality check**
  3. **Ready**
- Show the real draft number, for example **Draft 2 of 3**. A numbered draft is a complete Generator output followed by one quality check, not a retry counter for applying changes to the lesson form.
- Before the first draft arrives, show a restrained loader and plain preview-pending copy rather than a decorative configuration skeleton.
- While the Validator runs, show the current structurally valid draft preview.
- When revision is required, remain on the quality-check stage and state explicitly that the workflow is waiting for the creator's decision.
- Group findings under the affected criterion or blocking-condition title. Replace temporary references in creator-facing copy, and show complete word-level inline diffs for actual changes. Keep attempt history only for improvement; omit it from initial creation.
- Do not start the next Generator call automatically. Pin **Generate revised draft** and **Continue with this draft** in a non-scrolling footer. Explain that the first action spends the next Generator attempt, while the second advances the exact visible draft to Ready without applying or saving it.
- Do not show raw prompts, model/provider names, tokens, chain-of-thought, hidden simulations, or invented percentage progress.
- **Cancel** aborts the flow and returns to the brief.
- **Stop and inspect current draft** becomes available after the first structurally valid draft exists.

### Completed review

- Open the generated result directly in the existing structured AI Judge editor; do not build another read-only result form.
- Change the editor title to **Review AI-generated assessment** and show a small neutral reminder to review the draft.
- Reuse the current fields, accordions, Zod validation, exact-score guidance, examples, threshold calculation, blocking errors, and base-language behavior.
- Show non-blocking Validator warnings in a compact section above the form.
- Allow **Check quality with AI** at any time from this editor. It runs deterministic validation first, then the semantic Validator, and leaves every form value untouched.
- Validator errors offer **Improve with AI**, which starts generation immediately with the current complete configuration and Validator findings as its instruction. Do not ask the creator to restate the feedback.
- Ready exposes only **Review assessment**, which stages the draft and opens the normal structured editor.
- **Improve with AI** always sends the complete current draft plus the new creator instruction and, while the creation dialog remains active, the original brief and latest Validator findings.
- Confirm before replacing manually edited generated content with the improved result.
- For a new lesson, the review transition stages the configuration in React Hook Form; the ordinary lesson Save persists it atomically with the lesson.
- For an existing lesson, the creator reviews and saves through the existing aggregate `PUT`, which returns to the lesson editor without navigating away or saving unrelated lesson fields.

### Requires review

- If attempt 3 still fails semantic validation, keep the latest structurally valid draft and show **Draft requires your review**.
- Show the remaining creator-safe Validator errors and warnings.
- Allow the creator to edit and apply/save the draft despite semantic warnings, because deterministic client and server validation remain authoritative for structural correctness.
- Actions:
  - Primary: **Review assessment**
  - Secondary: **Save as current draft** through the normal editor flow
  - Tertiary: **Return to brief and generate again**
- Clearly state that nothing was saved or published automatically before the normal editor save.

## Generator And Validator Design

### Efficient bounded loop

1. Generator returns a complete configuration with temporary references.
2. TypeBox and deterministic Judge-graph validation run first.
3. Structurally invalid drafts skip the LLM Validator and surface precise correction codes at the same creator decision checkpoint.
4. The LLM Validator evaluates only structurally valid drafts.
5. Validator warnings do not trigger revision. Errors pause the flow; another Generator attempt is consumed only after creator approval.
6. A passing validation completes the flow.
7. A failing third attempt returns `requires_review` with the latest valid draft.

The normal successful path costs two model calls: one Generator call and one Validator call. Each approved revision adds up to two calls. The maximum semantic path costs six calls, while deterministic failures avoid unnecessary Validator calls and no retry spend occurs without creator approval.

### Generator responsibility

- Generate the complete task goal, criteria, exact-score guidance and examples, passing threshold, and blocking errors.
- Treat the creator brief and lesson fields as untrusted content that cannot override system instructions.
- Generate in the server-derived base language.
- Prefer a small set of distinct observable criteria without enforcing a hard criterion count.
- Prefer `maxScore` `2..3` for understandable and token-efficient guidance, while allowing the existing persisted range `1..5` when finer scoring is justified.
- Generate exactly one guidance entry for every score from `0` through `maxScore`.
- Make adjacent guidance levels meaningfully different.
- Use examples as realistic learner responses, not evaluator commentary.
- Reserve blocking errors for independently disqualifying behavior rather than duplicating normal criteria.
- On revision, receive the complete latest draft plus only blocking structural/semantic correction instructions and return a complete replacement.

### Generator prompt composition

- Keep one `aiJudgeConfigurationGeneratorBase` YAML prompt containing security boundaries, trusted/untrusted context rules, complete-output requirements, scoring rules, temporary-reference behavior, and shared quality requirements.
- Add separate YAML add-ons for:
  - `create`: build the first complete configuration from the creator brief and lesson context;
  - `improve`: preserve sound content and references while applying the creator instruction and optional Validator findings;
  - `repair`: internal-only minimal correction based on blocking deterministic or semantic findings.
- Load the base and selected add-on independently through `PromptService`, then concatenate them in the Generator service. Do not duplicate base instructions or place prompt prose in TypeScript.
- Pass the creator brief, lesson context, current configuration, and Validator findings as clearly delimited user content rather than interpolating large JSON payloads into the invariant system prompt.
- `create` never receives a previous configuration.
- `improve` always receives the complete current configuration. The original brief is optional and is included only while it remains available in the active authoring flow.
- `repair` is not an API mode. The orchestration service invokes it internally with the complete latest draft and only blocking correction instructions.

### Validator responsibility

The Validator checks semantic qualities deterministic code cannot establish:

- task goal is measurable and aligned with the brief,
- criteria describe observable learner behavior,
- criteria are distinct rather than overlapping restatements,
- score guidance differentiates weak, partial, and strong performance,
- examples match their exact score level and resemble realistic learner responses,
- the threshold is attainable and coherent with the rubric,
- blocking errors are independently disqualifying and do not duplicate criteria,
- the configuration can support specific learner feedback.

The Validator internally tests weak, partial, and strong learner-response profiles but does not return those simulations or hidden reasoning. Its output stays compact and contains only `passed`, a concise summary, and targeted findings.

Independent validation does not require the original creator brief. When the brief is unavailable, the Validator checks the configuration against the current lesson title, task description, AI Mentor instructions, Mentor type, and its own internal coherence. During an active generation flow, include the original brief for stronger alignment checking.

### Targeted findings and actual changes

- Assign temporary references such as `C1`, `C2`, and `B1` to generated criteria and blocking errors.
- Temporary references are orchestration identifiers, not database IDs. They remain internal to reconciliation and are never rendered as creator-facing labels.
- The Generator preserves references for existing items across revisions and assigns the next unused reference to new items.
- Score-guidance findings use criterion reference plus exact score, such as `C2` and `score: 1`.
- The Validator outputs recommendations, not executable deltas.
- After the Generator revises a draft, application code compares consecutive referenced drafts and computes the actual before/after changes shown in the UI.
- For persisted configurations, convert database IDs to compact temporary references before sending context to either model and retain a JSON-serializable `reference -> persisted ID` lookup with the generation job.
- Treat a preserved reference as the identity of the same logical item, including when its wording or scoring content is improved. Reattach criterion and blocking-error IDs by reference and guidance IDs by criterion reference plus exact score. New references remain ID-free so the existing aggregate save creates them.
- If generated improvement changes localized configuration-level text such as `taskGoal`, the Apply/Save path must clear or mark non-base translations as missing rather than silently retaining translations of the previous meaning.

```ts
type AiJudgeValidationIssue = {
  code: string;
  severity: "error" | "warning";
  target: {
    type: "configuration" | "criterion" | "scoreGuidance" | "blockingError";
    ref?: `C${number}` | `B${number}`;
    field?: string;
    score?: number;
  };
  message: string;
  correction: string;
};

type AiJudgeDraftChange = {
  type: "added" | "removed" | "changed";
  targetRef: `C${number}` | `B${number}` | "configuration";
  field: string;
  before?: string | number;
  after?: string | number;
};
```

The progress UI labels Validator output as **Recommended correction** and application-computed differences as **Changed in this revision**.

## Learner Name Personalization

- Apply personalization to both text and voice AI Mentor responses and to the generated welcome message.
- Add one shared dynamic `learnerPersonalizationAddon` instead of duplicating rules across Mentor, Teacher, Roleplay, and voice prompts.
- Resolve the current learner `firstName` through the thread for every generation so existing threads reflect later profile-name changes.
- Pass the first name as JSON-encoded untrusted data. Never interpret name content as prompt instructions.
- Allow occasional natural use of the learner's first name; do not address the learner by name in every response or use it as filler.
- Let the model grammatically inflect the first name for the response language, for example `Maciej` to `Macieju` in Polish.
- Do not infer gender or use gendered honorifics such as `Pan`/`Pani` in v1.
- In Roleplay, use the learner's name only when the assigned character would naturally know or address the learner by name; personalization must not override role identity.
- Keep `voiceMentorAddon` focused on TTS controls and spoken normalization. The shared personalization add-on is composed independently so Core and Luma text/voice paths receive the same learner context.
- For the welcome message, load the same current personalization add-on and include it with the base Mentor system prompt before requesting the initial response.

## Backend Plan

### Module structure

Add `apps/api/src/ai/judge-configuration-generation/`:

- `ai-judge-configuration-generation.service.ts` — bounded orchestration and progress events.
- `ai-judge-configuration-generator.service.ts` — Generator structured-output call.
- `ai-judge-configuration-validator.service.ts` — Validator structured-output call.
- `ai-judge-configuration-generation.schema.ts` — TypeBox request, internal draft, Validator result, progress-event, and final-result schemas.
- `ai-judge-configuration-generation.types.ts` — reusable orchestration types.
- focused unit tests beside the services.

There is no generation repository because the workflow does not persist data.

### Prompt sources

- Add the Generator base, create/improve/repair add-ons, semantic Validator, and learner-personalization YAML templates under `packages/prompts/src/templates/`.
- Load them through the existing `PromptService`.
- Regenerate `packages/prompts/src/generated-prompts.ts` through the package script; never edit it manually.
- Use separate structured-output schemas and low-variance model settings appropriate to each responsibility.
- Keep Validator output deliberately small. Do not return full simulated conversations or rewritten configuration fields.
- Extend `PROMPT_MAP` with explicit variable schemas for every new prompt. Keep large configuration/context payloads outside the YAML variables and pass them as delimited model input.

### Provider sequencing and Luma boundary

- Build and verify Generator, Validator, deterministic validation, orchestration, cancellation, and Core endpoints against the Core AI runtime before changing `mentingo-ai` or `@japro/luma-sdk`.
- Keep the Core model-call services provider-neutral so Luma support can be added without changing orchestration behavior.
- After the Core workflow is stable, add fixed Luma endpoints for Judge-configuration generation and validation with fixed Pydantic request/response contracts.
- Regenerate the Luma OpenAPI contract and SDK, then add Luma-to-Core fallback through `AiRuntimeService`. Core resolves the Generator and Validator through separate public capabilities, and Luma maps each capability to its matching model domain.
- Core remains responsible for prompts, the deterministic checks, the three-attempt loop, progress events, cancellation, and final reference stripping. Luma performs one fixed-schema Generator or Validator model call at a time.
- Never expose an endpoint that accepts a caller-provided JSON Schema or generic `generateStructured<T>` contract. Messages may be dynamic, but each Luma endpoint's response schema is fixed and validated again in Core.

### API contract

Expose the generation flow under the existing `/ai` API namespace through a focused AI Judge generation controller owned by `LessonModule`:

```text
POST /ai/judge-configuration/generate
POST /ai/judge-configuration/validate
GET /ai/judge-configuration/generations/:generationId
POST /ai/judge-configuration/generations/:generationId/cancel
```

Input:

```ts
type AiJudgeGenerationContext = {
  courseId: UUIDType;
  lessonId?: UUIDType;
  lessonContext: {
    title?: string;
    taskDescription?: string;
    aiMentorInstructions?: string;
    aiMentorType: AiMentorType;
  };
};

type GenerateAiJudgeConfigurationInput = AiJudgeGenerationContext &
  (
    | {
        mode: "create";
        brief: string;
        currentConfiguration?: never;
      }
    | {
        mode: "improve";
        instruction: string;
        brief?: string;
        currentConfiguration: AiJudgeConfigurationInput;
        latestValidation?: AiJudgeConfigurationValidationResult;
      }
  );
```

- Initial creation requires `brief` and omits `currentConfiguration`.
- Improvement requires `currentConfiguration` and a concise creator `instruction`; it may also include the latest Validator result. The Generator receives the complete current configuration and returns a complete replacement.
- A second generation after an initial draft uses `mode: "improve"`; no regenerate variant or endpoint exists.

Independent validation accepts the same course/lesson context plus the complete configuration being inspected and an optional original brief:

```ts
type ValidateAiJudgeConfigurationInput = {
  courseId: UUIDType;
  lessonId?: UUIDType;
  brief?: string;
  lessonContext: AiJudgeGenerationContext["lessonContext"];
  configuration: AiJudgeConfigurationInput;
};
```

- Verify curriculum-editing access for `courseId`.
- Verify `lessonId` belongs to that course when supplied.
- Derive the course base language server-side.
- Do not trust a client-provided language for structural generation.
- The lesson-owned application service keeps authorization, base-language derivation, unsaved-form input, workflow execution, and ID reconciliation independent of transport.
- The public generation endpoint prepares and enqueues the workflow in BullMQ, then returns a generated `generationId` immediately.
- Store only the temporary current progress snapshot, latest valid draft, and terminal result in the BullMQ/Redis job with a short retention period; do not add Postgres generation-job or attempt-history tables.
- Publish typed progress snapshots through Mentingo's existing authenticated per-user socket room. The WebSocket guard owns room membership; snapshot and cancellation endpoints independently verify tenant and actor ownership without revealing whether another user's job exists.
- Expose a snapshot read endpoint for initial loading and reconnect recovery. Sockets are the realtime delivery channel, not the source of truth, because clients can connect late or miss events.
- The independent validation endpoint is a normal structured request/response because it performs one deterministic check and at most one Validator call; it does not need generation progress streaming.
- Cancellation sets temporary job cancellation state and is checked between stages. Passing abort signals into active provider requests remains a separate provider-capability follow-up.
- Expire completed, failed, and cancelled generation jobs automatically after the configured short retention window.
- Never call the existing Judge persistence service from generation.
- Validation is strictly non-mutating and never calls persistence.

Progress statuses:

```ts
type AiJudgeGenerationStatus =
  | "drafting"
  | "evaluating"
  | "revising"
  | "completed"
  | "requires_review"
  | "failed"
  | "cancelled";
```

The brief screen is local dialog state and is not a backend generation status. Internal workflow events may carry a temporary referenced draft, but the lesson application boundary reconciles it into a form-ready configuration before any HTTP snapshot or socket event is published. Socket and snapshot responses wrap the application event with `generationId`. They must never carry temporary references, raw prompts, or hidden reasoning.

## Frontend Plan

Keep the feature inside the existing `AiMentorLessonForm/ai-judge/` module:

- `AiJudgeConfigurationGenerationDialog.tsx` — brief, progress, terminal, and requires-review views.
- `AiJudgeConfigurationForm.tsx` — extract the existing reusable form body so manual and generated editing share one implementation.
- `useAiJudgeConfigurationGeneration.ts` — centralized generation start, snapshot recovery, authenticated socket progress consumption, and cancellation.
- `useValidateAiJudgeConfiguration.ts` — independent non-mutating Validator mutation for generated, manually edited, or persisted configurations.
- reuse existing Judge draft types, defaults, mappers, schema, criterion editor, save handlers, and card.

Rules:

- Components must not parse raw stream frames or call an ad hoc endpoint directly.
- Keep generation state local to the active dialog; do not place ephemeral drafts in a global store.
- Keep the latest independent Validator result beside the active form draft and clear it when a relevant form field changes so stale findings are never presented as current.
- Generation itself does not invalidate Judge queries. Applying a reviewed draft for an existing lesson uses the existing Judge persistence mutation and its query invalidation; applying to a new lesson remains form-only.
- Existing Apply/Save mutations retain query invalidation and toast ownership.
- Add all visible copy to every supported web locale.
- Keep keyboard focus, dialog close behavior, reduced motion, error announcements, and disabled base-language actions accessible.

## Implementation Checklist

## Langfuse Prompt Deployment Inventory

Keep the following prompt IDs synchronized in Langfuse after this branch is ready. This list is authoritative for the scoped creator work and must be updated whenever a prompt source changes.

### New prompts

- `aiJudgeConfigurationGeneratorBase` — invariant structured assessment generation rules. Version 5 defaults criteria to three points, requires every score to represent distinct observable evidence, permits four or five points only for exceptional genuinely multi-level behavior, uses medium model reasoning to calibrate maxScore before writing guidance, and chooses round ten-point passing thresholds, normally 60%, 70%, or 80%.
- `aiJudgeConfigurationGeneratorCreate` — first-draft generation policy.
- `aiJudgeConfigurationGeneratorImprove` — creator-requested improvement policy. Version 3 requires exact preservation of unaffected fields and the smallest replacement needed instead of appended rationale or taxonomies.
- `aiJudgeConfigurationGeneratorRepair` — internal Validator-driven repair policy. Version 5 requires the smallest finding-linked replacement, replaces incomplete fields fully, forbids copying Validator prose into rubric fields, and preserves the creator's original improvement instruction across every revision.
- `aiJudgeConfigurationValidator` — semantic assessment quality review. Version 8 treats validation as a release gate rather than an editorial review: a usable, consistently scoreable rubric passes with no findings. It reports only high-confidence defects that can materially change scoring or pass/fail, rejects theoretical edge cases and stylistic refinements, evaluates later drafts against previous findings so resolved concerns are not reinvented, treats actual before/after changes as authoritative evidence, prevents ordinary omissions from being promoted into blocking errors, and names or summarizes the affected item instead of relying on a bare internal reference.
- `learnerNameAddon` — shared, language-aware learner-name personalization for AI Mentor prompts.

### Modified existing prompts

- None in the current scoped implementation. Learner-name behavior is composed through the new `learnerNameAddon` instead of duplicating changes across the existing Mentor, Roleplay, Teacher, Welcome, and voice prompts.

Generated prompt exports are build artifacts and are not separate Langfuse prompt entries.

### Backend

- [x] Add generation request, referenced-draft, Validator-result, progress-event, and final-result TypeBox schemas derived from canonical identity-free Judge content schemas.
- [x] Add Generator base/create/improve/repair and Validator prompt templates with explicit variable schemas; regenerate prompt exports.
- [x] Add the shared learner-personalization prompt template and variable schema; regenerate prompt exports.
- [x] Implement Generator structured output with temporary references.
- [x] Implement Generator prompt composition with public create/improve modes and internal repair mode; do not add regenerate behavior.
- [x] Extract pure deterministic Judge content validation and reuse it in persistence.
- [x] Implement compact semantic Validator output and derive pass/fail in Core from issue severity.
- [x] Implement independent non-mutating validation with optional brief context.
- [x] Implement the transport-neutral three-attempt orchestration loop, warning/error policy, cooperative cancellation checks, and `requires_review` result.
- [x] Connect BullMQ cancellation state to the workflow's cooperative cancellation boundary.
- [ ] Pass provider abort signals into active Generator and Validator requests where supported.
- [x] Apply shared content validation to generated drafts, validate temporary-reference uniqueness, and strip references from the final draft.
- [x] Validate unique references and require new references to continue monotonically across revisions.
- [x] Implement pure persisted-ID to temporary-reference mapping and stable-reference reconciliation for criteria, score guidance, and blocking errors.
- [x] Wire the reference mapper and identity lookup into synchronous improve/validation application services.
- [x] Serialize the identity lookup with generation jobs.
- [ ] Invalidate or clear non-base translations for generated fields whose base-language meaning changed.
- [x] Compute actual revision changes in application code and attach exact score targets where relevant.
- [x] Add typed synchronous generation and independent-validation endpoints under `/ai/judge-configuration` with course/lesson access validation.
- [x] Add generation job creation, snapshot, cancellation, and typed authenticated-user socket progress around the same application boundary.
- [x] Add fixed Generator/Validator endpoints in `mentingo-ai`, regenerate and package `@japro/luma-sdk`, and add capability-routed Luma-to-Core fallback without exposing arbitrary schemas.
- [x] Resolve the current learner first name through the thread and compose the personalization add-on for welcome, text, and voice generation.
- [x] Regenerate Swagger/client artifacts for start, snapshot, cancel, and validation contracts.

### Frontend

- [x] Wire **Create assessment with AI**, **Improve with AI**, and **Check quality with AI** into the existing Judge card/editor.
- [x] Build the presentational brief dialog without additional-context controls.
- [x] Build typed presentational drafting, evaluating, revising, completed, failed, cancelled, and requires-review states.
- [x] Mount the generation dialog in the AI Mentor lesson form and connect it to live job state.
- [x] Show attempt count, current draft preview, targeted recommendation, and actual revision changes.
- [x] Show independent Validator findings without modifying form values and clear stale findings after relevant edits.
- [x] Add Cancel and Stop/inspect behavior.
- [x] Reuse the structured Judge editor for generated review and follow-up editing.
- [x] Open generated configurations in the existing structured editor for review, then reuse its explicit save path.
- [ ] Confirm before discarding manually edited generated content.
- [x] Label every post-draft generation action **Improve with AI** and send the complete current draft.
- [x] Add translated UI copy and API errors to all supported locales.
- [x] Give quality findings human-readable criterion/blocking-error targets, simplify the feedback/change/history hierarchy, prefer Continue over Revise, and autosize assessment text fields to a bounded height.
- [x] Group findings and actual changes by human target, hide temporary references, render complete inline word diffs, remove redundant Ready actions, and limit task-goal formatting to bold and bullets.
- [x] Reuse the bounded autosizing textarea in the learner AI Mentor composer and split stable AI Mentor lesson form sections into explicit presentational components.

### Documentation

- [x] Update `docs/specs/ai-mentor-lessons-business-spec.md` with the background generation, reconnect recovery, cancellation, review, explicit-save, and learner-name personalization behavior.

## Tests And Validation

### Backend tests

- First generated draft passes semantic validation.
- Create prompt excludes any previous configuration; improve and repair prompts include the complete current draft under their distinct change policies.
- No public regenerate mode exists; subsequent generation uses improve.
- Structural failure returns directly to Generator without calling Validator.
- Semantic error causes one revision and then passes.
- Warning-only validation completes without revision.
- Third semantic failure returns `requires_review` with the latest valid draft.
- Independent validation works with and without an original brief and never invokes Generator or persistence.
- Independent validation evaluates unsaved form values rather than silently loading the stored configuration.
- Generator/Validator malformed structured output fails safely.
- Duplicate references and non-monotonic new references are rejected; preserved references identify the same logical item even when its content is improved.
- Score-guidance findings target the correct criterion and exact score.
- Actual before/after changes are computed independently of Validator suggestions.
- Model-facing and transport drafts contain temporary references but never database IDs. The editable result contains no temporary references and reattaches applicable persisted IDs.
- Full improvement output preserves persisted IDs for stable criterion and blocking-error references and for stable criterion-reference plus score guidance pairs.
- Changed generated text does not retain stale non-base translations.
- Cancellation and provider failure retain the latest structurally valid draft.
- Generation never calls persistence or overwrites an existing configuration.
- Course access, curriculum feature, base-language derivation, and lesson/course ownership are enforced.
- Learner personalization resolves the current first name dynamically and safely encodes it as untrusted data.
- Welcome, text, and voice prompt construction all include the shared personalization add-on.
- Personalization instructs natural inflection, sparse usage, no gendered honorifics, and Roleplay-safe behavior.

### Frontend tests

- Entry actions are available for every Mentor type and disabled outside the base language.
- Independent quality check is available for generated drafts, manual unsaved edits, and persisted configurations.
- Brief validation and duplicate-submit prevention.
- Real stage and attempt event mapping.
- Draft preview, recommendation, and actual-change rendering.
- Cancel before a draft and Stop/inspect after a valid draft.
- Completed and `requires_review` review flows.
- Validator findings become stale/clear after the creator edits a relevant field.
- New lesson applies to React Hook Form without creating the lesson.
- Existing lesson remains unchanged until explicit Save.
- Manual configuration fallback remains available.
- Deterministic mocked stream fixtures are used; tests never call a live model.

### Validation commands

- [x] Focused API Jest suites for generation services and queue transport.
- [x] `pnpm --filter=api lint-tsc`
- [x] Focused web Vitest suites for generation state and form reuse.
- [ ] Focused Playwright curriculum flow with deterministic generation fixtures.
- [x] `pnpm --filter=web lint-tsc`
- [ ] Prompt export regeneration check.
- [x] Swagger/client generation check.

## Non-goals

- Rebuilding the existing Judge schema, CRUD, manual editor, scoring engine, judgement history, translations, learner result UI, or master-course copy behavior.
- Generating or rewriting lesson task descriptions or AI Mentor instructions.
- Source/context attachments in the generation dialog.
- Generic conversational scenario building.
- Persisted generation jobs or attempt history.
- Partial model patches or direct Validator writes.
- Autonomous saving or publishing.
- Negative-point penalties.
- New realtime/WebSocket infrastructure.
- Luma integration before the Core Generator/Validator workflow is working and validated.
- Caller-provided structured-output schemas or a generic Luma structured-generation proxy.
- Gender inference, gendered honorifics, or a learner-name personalization toggle in v1.
