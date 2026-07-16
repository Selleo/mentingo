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
- Use a bounded Generator/Validator loop with at most three Generator attempts. This is a narrow application workflow, not a generic multi-agent framework.
- Allow the semantic Validator to run independently against any current configuration: a newly generated draft, unsaved manual edits, or an already persisted Judge configuration.
- Allow creators to rerun the complete improvement flow later with the current configuration plus a new instruction. A prior generation brief is useful context during the active flow but is not required for future validation or improvement.
- Keep model writes as complete configuration replacements. Do not ask the model to emit JSON Patch or executable field deltas; application code derives the actual delta and reattaches stable persisted IDs where items remain semantically the same.
- Expose only `create` and `improve` as Generator modes. There is no separate regenerate mode: once a draft exists, any further AI generation is an improvement using the complete current draft as context.
- Use the same Generator service, model, structured-output schema, and model settings for create, improve, and the internal repair step. Compose one invariant base prompt with a small intent-specific YAML add-on.
- Do not persist generation jobs, attempts, prompts, or Validator history in Postgres. Keep the active draft and progress in the current authoring flow.
- Do not add a generic AI chat, partial JSON patches, autonomous publishing, negative scoring, or a visual agent graph.
- Keep v1 generation in Mentingo Core. Preserve a provider-neutral service/API boundary for a future Luma capability, but do not add unused SDK types, mocked adapters, or dead fallback code now.
- In the same branch, add automatic learner first-name personalization to text and voice AI Mentor conversations, including the welcome message.

## User Flow

```text
AI Judge card
  -> Describe assessment
  -> Generate draft
  -> Validate quality
  -> Revise when needed, up to 3 attempts
  -> Review in existing Judge editor
  -> Apply to lesson form or save existing configuration
```

### Entry points

- An unconfigured AI Judge card shows:
  - Primary: **Create assessment with AI**.
  - Secondary: **Configure manually**.
- A configured card keeps **Edit assessment** and adds **Improve with AI**.
- A configured card also offers **Check quality with AI** as a secondary action. The same action is available inside the structured editor for unsaved manual changes.
- AI structure actions remain visible but disabled with the existing base-language tooltip when the creator is editing a non-base language.
- **Improve with AI** uses the currently displayed complete configuration as input but does not mutate the stored configuration until explicit Save.
- **Check quality with AI** validates the currently displayed complete configuration without generating, applying, or saving changes.

### Brief dialog

- Use a centered dialog titled **Create assessment with AI** or **Improve assessment with AI**.
- Show one required large textarea.
- Prompt the creator to describe:
  - what the learner should achieve,
  - which observable behaviors demonstrate success,
  - which serious mistakes should prevent completion.
- Include one compact explanation that AI creates the task goal, criteria, scores, exact-score guidance, passing threshold, and blocking errors.
- Remove the mockup's level, language, type, attachment controls, and large “AI will create” side card.
- Primary action: **Generate draft**. Closing the dialog before generation changes nothing.

### Generation progress

- Show real workflow stages backed by progress events:
  1. **Generating draft**
  2. **Quality check**
  3. **Ready**
- Show the real attempt number, for example **Attempt 2 of 3**.
- Before the first draft arrives, show a restrained animated loader and configuration skeleton.
- While the Validator runs, show the current structurally valid draft preview.
- When revision is required, show the concise creator-safe correction currently being addressed.
- Do not show raw prompts, model/provider names, tokens, chain-of-thought, hidden simulations, or invented percentage progress.
- **Cancel** aborts the flow and returns to the brief.
- **Stop and inspect current draft** becomes available after the first structurally valid draft exists.

### Completed review

- Open the generated result directly in the existing structured AI Judge editor; do not build another read-only result form.
- Change the editor title to **Review AI-generated assessment** and show a small neutral reminder to review the draft.
- Reuse the current fields, accordions, Zod validation, exact-score guidance, examples, threshold calculation, blocking errors, and base-language behavior.
- Show non-blocking Validator warnings in a compact section above the form.
- Allow **Check quality with AI** at any time from this editor. It runs deterministic validation first, then the semantic Validator, and leaves every form value untouched.
- Validator errors offer **Improve with AI**, which starts the bounded Generator/Validator loop with the current complete configuration and the latest blocking findings as context.
- Actions:
  - **Back to brief**
  - **Improve with AI**
  - **Apply configuration** for a new lesson
  - **Save configuration** for an existing lesson
- **Improve with AI** always sends the complete current draft plus the new creator instruction and, while the creation dialog remains active, the original brief and latest Validator findings.
- Confirm before replacing manually edited generated content with the improved result.
- For a new lesson, Apply only stages the configuration in React Hook Form; the ordinary lesson Save persists it atomically with the lesson.
- For an existing lesson, Save uses the existing aggregate `PUT` and returns to the lesson editor without navigating away.

### Requires review

- If attempt 3 still fails semantic validation, keep the latest structurally valid draft and show **Draft requires your review**.
- Show the remaining creator-safe Validator errors and warnings.
- Allow the creator to edit and apply/save the draft despite semantic warnings, because deterministic client and server validation remain authoritative for structural correctness.
- Actions:
  - Primary: **Review assessment**
  - Secondary: **Save as current draft** through the normal editor flow
  - Tertiary: **Return to brief and generate again**
- Clearly state that nothing was saved or published automatically.

## Generator And Validator Design

### Efficient bounded loop

1. Generator returns a complete configuration with temporary references.
2. TypeBox and deterministic Judge-graph validation run first.
3. Structurally invalid drafts skip the LLM Validator and return precise correction codes to the Generator.
4. The LLM Validator evaluates only structurally valid drafts.
5. Validator warnings do not trigger revision. Only `severity: "error"` consumes another Generator attempt.
6. A passing validation completes the flow.
7. A failing third attempt returns `requires_review` with the latest valid draft.

The normal successful path costs two model calls: one Generator call and one Validator call. One revision costs four calls. The maximum semantic path costs six calls, while deterministic failures avoid unnecessary Validator calls.

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
- Temporary references are orchestration identifiers, not database IDs, and are stripped before the final configuration reaches Apply/Save.
- The Generator preserves references for existing items across revisions and assigns the next unused reference to new items.
- Score-guidance findings use criterion reference plus exact score, such as `C2` and `score: 1`.
- The Validator outputs recommendations, not executable deltas.
- After the Generator revises a draft, application code compares consecutive referenced drafts and computes the actual before/after changes shown in the UI.
- For persisted configurations, convert database IDs to compact temporary references before sending context to either model and retain an in-memory `reference -> persisted ID` lookup for the request.
- Reattach an existing ID only when the corresponding node is semantically unchanged. New or materially changed criteria, guidance entries, and blocking errors remain ID-free so the existing aggregate save treats them as replacement rows rather than stale translations of the old meaning.
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

### API contract

Expose the generation flow through the existing `AiController`:

```text
POST /ai/judge-configuration/generate
POST /ai/judge-configuration/validate
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
- Stream typed progress events through the existing AI HTTP-streaming boundary; do not add WebSocket infrastructure.
- The independent validation endpoint is a normal structured request/response because it performs one deterministic check and at most one Validator call; it does not need generation progress streaming.
- Abort the active model request when the client disconnects where supported.
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

Events may carry the current attempt, current structurally valid referenced draft, compact Validator result, application-computed change list, and final ID-free configuration. They must never carry raw prompts or hidden reasoning.

## Frontend Plan

Keep the feature inside the existing `AiMentorLessonForm/ai-judge/` module:

- `AiJudgeConfigurationGenerationDialog.tsx` — brief, progress, terminal, and requires-review views.
- `AiJudgeConfigurationForm.tsx` — extract the existing reusable form body so manual and generated editing share one implementation.
- `useAiJudgeConfigurationGenerationStream.ts` — centralized typed progress consumption and cancellation.
- `useValidateAiJudgeConfiguration.ts` — independent non-mutating Validator mutation for generated, manually edited, or persisted configurations.
- reuse existing Judge draft types, defaults, mappers, schema, criterion editor, save handlers, and card.

Rules:

- Components must not parse raw stream frames or call an ad hoc endpoint directly.
- Keep generation state local to the active dialog; do not place ephemeral drafts in a global store.
- Keep the latest independent Validator result beside the active form draft and clear it when a relevant form field changes so stale findings are never presented as current.
- Generation does not invalidate Judge queries because it does not persist anything.
- Existing Apply/Save mutations retain query invalidation and toast ownership.
- Add all visible copy to every supported web locale.
- Keep keyboard focus, dialog close behavior, reduced motion, error announcements, and disabled base-language actions accessible.

## Implementation Checklist

### Backend

- [x] Add generation request, referenced-draft, Validator-result, progress-event, and final-result TypeBox schemas derived from canonical identity-free Judge content schemas.
- [ ] Add Generator base/create/improve/repair, Validator, and learner-personalization prompt templates with explicit variable schemas; regenerate prompt exports.
- [ ] Implement Generator structured output with temporary references.
- [ ] Implement Generator prompt composition with public create/improve modes and internal repair mode; do not add regenerate behavior.
- [x] Extract pure deterministic Judge content validation and reuse it in persistence.
- [ ] Implement compact semantic Validator output.
- [ ] Implement independent non-mutating validation with optional brief context.
- [ ] Implement the three-attempt orchestration loop, warning/error policy, cancellation, and `requires_review` result.
- [ ] Apply shared content validation to generated drafts, validate temporary-reference uniqueness and preservation, and strip references from the final draft.
- [ ] Map persisted IDs to temporary references for model context and reattach IDs only to semantically unchanged nodes.
- [ ] Invalidate or clear non-base translations for generated fields whose base-language meaning changed.
- [ ] Compute actual revision changes in application code.
- [ ] Add the typed generation-progress and independent-validation endpoints to `AiController` with course/lesson access validation.
- [ ] Resolve the current learner first name through the thread and compose the personalization add-on for welcome, text, and voice generation.
- [ ] Regenerate Swagger/client artifacts where the non-streaming request/result schemas are represented.

### Frontend

- [ ] Wire **Create assessment with AI**, **Improve with AI**, and **Check quality with AI** into the existing Judge card/editor.
- [ ] Build the brief dialog without additional-context controls.
- [ ] Build real drafting, evaluating, revising, completed, failed, cancelled, and requires-review states.
- [ ] Show attempt count, current draft preview, targeted recommendation, and actual revision changes.
- [ ] Show independent Validator findings without modifying form values and clear stale findings after relevant edits.
- [ ] Add Cancel and Stop/inspect behavior.
- [ ] Extract/reuse the structured Judge form for generated review.
- [ ] Preserve new-lesson staging and existing-lesson direct-save behavior.
- [ ] Confirm before discarding manually edited generated content.
- [ ] Label every post-draft generation action **Improve with AI** and send the complete current draft.
- [ ] Add translated UI copy and API errors to all supported locales.

### Documentation

- [ ] Update `docs/specs/ai-mentor-lessons-business-spec.md` with the generation, quality-check, review, explicit-save, and learner-name personalization behavior after implementation.

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
- Duplicate, unknown, or changed temporary references are rejected.
- Score-guidance findings target the correct criterion and exact score.
- Actual before/after changes are computed independently of Validator suggestions.
- Final draft contains no temporary references or database IDs.
- Full improvement output preserves persisted IDs for semantically unchanged nodes and replaces materially changed nodes.
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

- [ ] Focused API Jest suites for generation services and controller.
- [ ] `pnpm --filter=api lint-tsc`
- [ ] Focused web Vitest suites for generation state and form reuse.
- [ ] Focused Playwright curriculum flow with deterministic generation fixtures.
- [ ] `pnpm --filter=web lint-tsc`
- [ ] Prompt export regeneration check.
- [ ] Swagger/client generation check.

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
- Luma-backed Generator/Validator implementation in this PR.
- Gender inference, gendered honorifics, or a learner-name personalization toggle in v1.
