# #1807 Improve AI Mentor Configuration And Introduce AI Generation

## Summary

Replace the current broad `mentor | teacher | roleplay` authoring model with two explicit
behavior modes: `teacher` and `roleplay`. Course creators configure either mode through one
compact, hierarchical dialog and may create, validate, improve, revise, and review the configuration with AI before saving it.

The saved configuration becomes the authoring source of truth. The API compiles it with the existing Mentingo platform prompt, lesson context, authenticated learner context, RAG context, and voice rules at runtime. The AI Judge remains a separate completion system and is never exposed to the live Teacher or Roleplay character.

Issue: `#1807 improve ai mentor config and introduce ai generation`

Implementation branch: `jh_feat_1807_improve_ai_mentor_config_and_introduce_ai_generation`

## Product Decisions And Constraints

- Remove `mentor` as an option for newly created or converted configurations. It is an ambiguous
  hybrid that does not give either creators or the model a clear behavioral contract.
- Keep `teacher` and `roleplay` as two explicit, type-specific configurations.
- Use one `AI Mentor behavior` card and one dialog. Do not present a synthetic `Common
configuration` group in the UI.
- Keep fields granular: one authoring decision per field, but only include information required
  for a reliable AI experience.
- Roleplay uses `scenario` as its top-level purpose and context. Do not add a redundant common
  session objective.
- Teacher uses `taskGoal` as its top-level purpose.
- Keep mentor name, avatar, voice configuration, lesson title, learner-facing task description,
  resources, and AI Judge completion conditions outside the behavior dialog.
- `openingInstruction` is a one-time input for generating the welcome message. It must not remain
  in the ongoing conversation system prompt.
- `additionalInstructions` is an optional advanced escape hatch, not the main authoring surface.
- AI generation starts from one creator brief, returns a complete structured replacement, and
  never saves automatically.
- The creator selects Teacher or Roleplay before generation. The selected type is trusted request
  context: AI never infers, recommends, returns, or changes it.
- Improve with AI and Check quality always use the current unsaved configuration and its current
  creator-selected type.
- A creator may manually switch type and then ask AI to update the configuration for that new type,
  but AI itself cannot perform or propose the type change.
- Generated and manually edited values use the same editor, validation rules, translation model,
  save path, and runtime compiler.
- Replace generic `lessonInstructions` interpolation in Teacher and Roleplay runtime prompts with
  the backend-compiled structured behavior block. Keep the current Mentor prompt only as a
  temporary legacy fallback.
- Quality validation is non-mutating and may validate current unsaved form values.
- Reuse the proven AI Judge interaction model: background generation, authenticated progress,
  reconnect snapshots, cancellation, creator-approved revisions, review, field-level changes, and
  a maximum of three attempts.
- Do not expose platform-owned prompt behavior as author fields. Mentingo continues to own
  security, prompt hierarchy, RAG boundaries, response formatting, response length, learner-name
  handling, group adaptation, voice behavior, and universal Teacher/Roleplay rules.
- Authoring requires `COURSE_UPDATE` or `COURSE_UPDATE_OWN`, editable course content, curriculum
  editing availability, tenant isolation, and the course base language for structural changes.
- Text fields are localizable. Type, teaching style, and roleplay difficulty are shared structural
  values and cannot diverge between languages.
- Use a bounded tool-loop conversation agent and let the model decide when lesson-resource
  retrieval is needed. The backend still owns document scope, authorization, retrieval limits,
  source boundaries, and observability.
- Keep the initial agent to one read-only lesson-resource tool and a small step/call limit. Defer
  additional tools, reranking, and hybrid search until measurements justify them.
- Update the AI Mentor business specification during implementation because this changes product
  behavior.

### Learner Context Decision

Omit `learnerContext` from the initial persisted configuration.

- Runtime already resolves the actual learner's first name, active language, groups, and localized
  group characteristics.
- Roleplay already has a fictional `learnerRole`, which is different from the learner's real
  organization groups and remains necessary.
- Do not add learner identity, group membership, or target-audience assumptions to the authoring
  schema. Those remain backend-resolved runtime context.

## Configuration Structure

Do not create a shared configuration object merely to deduplicate fields. Use a discriminated
union so each mode is independently understandable and can evolve without optional fields from
the other mode.

### Teacher

```ts
type TeacherConfigurationInput = {
  type: "teacher";
  taskGoal: string;
  expertise: string;
  contentScope: string;
  teachingStyle: "explain_and_practice" | "guided_discovery" | "socratic";
  feedbackGuidance?: string;
  openingInstruction?: string;
  additionalInstructions?: string;
  // learnerContext?: string; // Pending product decision; recommended omission.
};
```

- `taskGoal`: what the Teacher should help the learner understand or practice.
- `expertise`: the subject-matter role the Teacher should embody.
- `contentScope`: the material it may cover and the boundary that prevents topic drift.
- `teachingStyle`: a controlled interaction strategy rather than another free-form prompt.
- `feedbackGuidance`: optional special correction or feedback requirements. Platform defaults
  apply when absent.
- `openingInstruction`: optional direction for the one-time welcome-message generation.
- `additionalInstructions`: optional advanced requirements not covered by the normal fields.

The Teacher platform prompt continues to own natural explanations, proportional response length,
understanding checks appropriate to the selected style, constructive correction, formatting, and
off-topic handling.

### Roleplay

```ts
type RoleplayConfigurationInput = {
  type: "roleplay";
  aiRole: string;
  learnerRole: string;
  scenario: string;
  characterGoal: string;
  difficulty: "cooperative" | "realistic" | "challenging";
  factsAndConstraints?: string;
  openingInstruction?: string;
  additionalInstructions?: string;
  // learnerContext?: string; // Pending product decision; recommended omission.
};
```

- `aiRole`: the fictional character played by the AI.
- `learnerRole`: the learner's fictional role within this scenario, not their Mentingo group.
- `scenario`: the situation, relevant starting state, and reason the interaction is taking place.
- `characterGoal`: what the character wants, protects, or needs before agreeing.
- `difficulty`: a controlled level of cooperation or resistance.
- `factsAndConstraints`: optional budgets, authority, deadlines, policies, known facts, and limits
  the character must not invent past.
- `openingInstruction`: optional direction for the one-time welcome-message generation.
- `additionalInstructions`: optional advanced requirements not covered by the normal fields.

The Roleplay platform prompt continues to own role stability, natural conversational turns,
non-disclosure of internal instructions, gradual realistic behavior, formatting, and avoiding
unrequested coaching.

## UI Direction

### Existing AI Judge Pattern To Reuse

Keep the interaction structurally familiar instead of introducing a second authoring model:

- Reuse the compact `Card` shell, neutral/error border states, responsive text/action layout, and
  absence of decorative shadow from `AiJudgeConfigurationCard`.
- Reuse the compact empty state, but expose only one manual configuration action in the first
  frontend slice.
- Reuse the configured state: a plain-language summary and one outline review action with a
  chevron.
- Reuse `DialogContent variant="mobileDrawer"` with a bounded viewport, fixed header and footer,
  independently scrolling body, safe-area footer padding, and a desktop maximum width.
- Use a simple footer with `Cancel` and the primary save action. AI assistance is deferred to the
  separate AI-generation slice.

The AI Mentor dialog should be narrower than the nested Judge editor:
`sm:w-[min(96vw,52rem)] sm:!max-w-none`, with the same approximately `85dvh` bounded height.

### Main Form Card

Keep the existing learner-facing task description near the top of the lesson form. Replace the
standalone type selector, large free-form AI Mentor Instructions editor, and suggestion-example
buttons with one compact `AI Mentor behavior` card.

```text
AI Mentor behavior
Choose how the AI should guide or interact with the learner.

[ Configure AI Mentor ]
```

Once configured:

```text
AI Mentor behavior
Teacher · GDPR trainer · Guided discovery

                                      [ Review configuration › ]
```

Card rules:

- Empty primary action: `Configure AI Mentor`.
- Teacher summary: `Teacher · {expertise} · {teaching style}`.
- Roleplay summary: `Roleplay · {AI role} · {difficulty}`.
- Fall back to the type plus the first meaningful configured value; never show placeholder
  fragments in the summary.
- If saved configuration fails validation, use the existing error-border pattern and replace the
  summary with a short repair message.
- Do not add badges, a type picker, quality status, or AI buttons to the card. Teacher/Roleplay
  selection belongs inside the configuration dialog.
- In a non-base language, permit review only when a saved base configuration exists.

### Single Configuration Dialog

Header:

- Title: `Configure AI Mentor`.
- Description: `Choose a mode and define the behavior learners should experience.`
- Keep mode selection inside the scrolling form body so the header stays compact on mobile.

The first field is a labelled two-option radio-card group rather than a dropdown:

```text
Mentor mode
┌────────────────────────┐  ┌────────────────────────┐
│ Teacher                │  │ Roleplay               │
│ Explains and guides.   │  │ Acts as a participant.│
└────────────────────────┘  └────────────────────────┘
```

Use one column on mobile and two columns from the small breakpoint. The entire option is clickable,
the selected state is not communicated by color alone, and arrow-key navigation follows radio-group
semantics.

There is no visible `Common configuration` group. After mode selection, show only that mode's core
fields, followed by one collapsed `Fine-tune behavior (optional)` section.

#### Teacher Hierarchy

Visible core fields:

1. `Expertise` — short input; the subject or professional perspective the Teacher represents.
2. `Task goal` — full-width bounded rich-text editor; the concrete outcome the Teacher should help
   the learner achieve.
3. `Content scope` — full-width bounded rich-text editor; what the Teacher may teach and what it should
   avoid.
4. `Teaching style` — three radio-card options with a one-line explanation:
   `Explain and practice`, `Guided discovery`, `Socratic`.

Collapsed `Fine-tune behavior (optional)` fields:

1. `Feedback guidance` — how corrective feedback should be delivered.
2. `Opening instruction` — directs only the generated welcome message.
3. `Additional instructions` — exceptional behavior not represented by another field.

```text
Configure AI Mentor

Mentor mode        [ Teacher ✓ ] [ Roleplay ]

Expertise          [                                  ]
Task goal          [                                  ]
Content scope      [                                  ]
Teaching style     [ Explain ] [ Guided ] [ Socratic ]

› Fine-tune behavior (optional)

                         Cancel           Save configuration
```

#### Roleplay Hierarchy

Visible core fields:

1. `AI role` and `Learner role` — short inputs, stacked on mobile and side-by-side from the small
   breakpoint.
2. `Scenario` — full-width bounded rich-text editor; the situation being practiced.
3. `Character goal` — full-width bounded rich-text editor; what the AI character is trying to accomplish.
4. `Difficulty` — three radio-card options with a one-line explanation:
   `Cooperative`, `Realistic`, `Challenging`.

Collapsed `Fine-tune behavior (optional)` fields:

1. `Facts and constraints` — scenario truths, boundaries, or information the character must retain.
2. `Opening instruction` — directs only the generated welcome message.
3. `Additional instructions` — exceptional behavior not represented by another field.

```text
Configure AI Mentor

Mentor mode        [ Teacher ] [ Roleplay ✓ ]

AI role            [                 ]
Learner role       [                 ]
Scenario           [                                  ]
Character goal     [                                  ]
Difficulty         [ Cooperative ] [ Realistic ] [ Challenging ]

› Fine-tune behavior (optional)

                         Cancel           Save configuration
```

Field rules:

- Use plain inputs for short roles and expertise. Use bounded rich-text editors for the longer
  prompt fields, including optional fine-tuning fields, so creators can structure guidance with
  emphasis and lists.
- Keep helper copy to one sentence beneath the label and use examples as optional placeholders,
  not prefilled values.
- Mark optional fields in labels. Do not mark every core field `Required`; communicate that once in
  the form description and through validation.
- Validate on submit, show errors inline, focus the first invalid field, and automatically open the
  optional section if it contains an invalid value.
- Preserve a deliberate top-to-bottom narrative: outcome/situation, identity and scope, behavior,
  then optional refinement.

Dialog footer:

- `Cancel`.
- Primary `Apply configuration` for a new unsaved lesson or `Save configuration` for an existing
  lesson.

Type switching:

- Switching between Teacher and Roleplay is a structural replacement.
- Switch immediately while the selected configuration is still empty.
- Once type-specific values exist, request confirmation before clearing them.
- After confirmation, reset to the new mode's empty defaults. Do not retain hidden stale fields or
  mechanically copy semantically unrelated values.
- Layer the replacement confirmation above the configuration dialog with a distinct dark overlay.
- A future `Convert with AI` action may prepare a reviewable replacement, but automatic conversion
  is outside the initial delivery.

Translation mode:

- Keep the saved mode, teaching style, and difficulty visible but disabled, with an explanation.
- Translate only the selected mode's text fields.
- Show missing translations as empty values rather than silently substituting the base language.
- Let the backend return translation completeness so web and course-level translation generation
  share one source of truth.

### AI Generation And Review

This is a separate later slice. Do not expose `Create with AI`, `Improve with AI`, `Check quality`,
or generation-progress UI in the initial manual frontend implementation. When implemented, the
empty-card `Create with AI` action opens a separate generation drawer rather than the manual editor.

Initial state:

1. The creator chooses `Teacher` or `Roleplay` using the same radio cards. This is a required
   creator decision, not generated output.
2. Enter one creator brief:
   - Teacher: `What should the Teacher help learners achieve?`
   - Roleplay: `Describe the practice scenario and who should participate.`
3. Generate the complete structured draft for the selected mode.

The prompt is intentionally a single bounded textarea. Do not duplicate all configuration fields in
the generation step.

Improvement state:

- Lock the existing mode.
- Use the current unsaved configuration and current creator-selected mode as the source of truth.
- Ask what should be improved.
- Offer concise, mode-specific shortcuts:
  - Teacher: `Clarify the task goal`, `Tighten content scope`, `Improve teaching approach`,
    `Improve feedback`.
  - Roleplay: `Clarify the roles`, `Make the scenario realistic`, `Tune difficulty`,
    `Strengthen constraints`.

Generation and review:

- Keep the Judge rhythm and labels: `Draft` → `Quality check` → `Ready`.
- The model returns all fields for the selected mode, not a partial patch, but its strict output
  schema omits `type`. The server reattaches the trusted creator-selected type after validation.
- Improve and Check quality accept the current unsaved, potentially incomplete same-type draft so a
  creator can manually switch type and ask AI to complete the new configuration. Opposite-type
  fields remain invalid.
- Show semantic quality findings first. Keep the generated field values or field-level changes in
  an optional review section ordered exactly like the manual editor.
- Target findings by stable field names; list-item references are unnecessary because the
  configuration intentionally avoids repeatable nested arrays.
- During revision, show the real active progress state and lock repeated revision actions.
- If quality cannot be resolved automatically, show the best draft with a clear `Needs review`
  state rather than failing the entire flow.
- `Review configuration` stages the generated draft and opens the normal configuration dialog.
- Saving from that dialog is the only persistence action.
- On an existing lesson, synchronize saved configuration back into the parent React Hook Form
  default value so a later lesson save cannot restore an older draft.
- Check quality is non-mutating and evaluates the current unsaved configuration and current type,
  not a persisted snapshot. Its findings may start Improve with AI using those same current values.
- If the creator changes type while generation or quality review is open, mark the result stale and
  prevent applying it. The creator must rerun the action for the current type.

Do not add a separate live conversation tester in this scope. Existing lesson preview remains the
place to experience the configured Mentor; a future inline preview would need explicit unsaved-draft
and voice-session behavior.

### Competitor Research And Product Translation

| Observed pattern                                                                                                                             | Mentingo decision                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Sana asks for scenario, learner role, AI character role, personality, and optional context before generating a simulation.                   | Put scenario and both roles first, represent personality with one bounded difficulty choice, and progressively disclose context.            |
| Yoodli starts AI creation from one prompt, then exposes an editable structured result with scenario context, personas, behaviors, and goals. | Keep `Create with AI` brief-first, but always review the generated structure in Mentingo's normal editor before saving.                     |
| Sana AI Tutor begins from learning objectives and allowed sources.                                                                           | Put Teacher `Task goal` before expertise and content scope; keep linked lesson resources and RAG selection outside this behavior dialog.    |
| Yoodli offers live persona preview while authoring.                                                                                          | Keep preview out of v1 because Mentingo already has lesson preview and must define unsaved configuration and voice-session semantics first. |

The product deliberately does not copy:

- Persona libraries, avatars, voice selection, group assignment, or linked-resource upload inside
  this dialog; those belong to existing lesson/course capabilities.
- Completion criteria in Roleplay; AI Judge remains the separate assessment authority.
- Large free-form behavior prompts as the primary experience; platform and safety instructions stay
  hidden and authoritative.
- AI-only generated output that cannot be directly edited before saving.

References:

- <https://help.sana.ai/en/articles/237028-scenario-card>
- <https://support.yoodli.ai/en/articles/11565137-how-to-build-and-customize-roleplays>
- <https://help.sana.ai/en/articles/634763-ai-tutor-sessions-in-courses>

## Routing And Frontend Structure

No new Remix route is required. Keep the feature inside the existing AI Mentor lesson editor.

Suggested module structure:

```text
AiMentorLessonForm/
  AiMentorConfiguration/
    AiMentorConfigurationCard.tsx
    AiMentorConfigurationDialog.tsx
    AiMentorConfigurationDialogFooter.tsx
    AiMentorConfigurationGenerationDialog.tsx
    AiMentorConfigurationValidationDialog.tsx
    TeacherConfigurationFields.tsx
    RoleplayConfigurationFields.tsx
    aiMentorConfiguration.schema.ts
    aiMentorConfiguration.types.ts
    aiMentorConfiguration.mappers.ts
    aiMentorConfigurationAuthoring.reducer.ts
    useAiMentorConfigurationGeneration.ts
    useAiMentorConfigurationValidation.ts
```

Frontend state rules:

- React Hook Form owns the staged lesson configuration.
- TanStack Query owns persisted configuration and generation snapshots.
- The authoring reducer owns mutually exclusive editor, generation, and quality-result views.
- Only seed the guaranteed initial drafting snapshot locally; do not invent optimistic generated
  results.
- Socket progress and ownership-checked GET snapshots recover background state after reconnect.
- Mutation hooks own relevant query invalidation and success toasts.
- Use the generated `ApiClient.api...` methods only.

Suggested hooks:

- `useAiMentorConfiguration(lessonId, language)`.
- `useReplaceAiMentorConfiguration()`.
- `useUpdateAiMentorConfigurationTranslation()`.
- `useStartAiMentorConfigurationGeneration()`.
- `useAiMentorConfigurationGenerationSnapshot()`.
- `useReviseAiMentorConfigurationGeneration()`.
- `useCancelAiMentorConfigurationGeneration()`.
- `useValidateAiMentorConfiguration()`.

## Backend And API Plan

### Recommended Ownership And Write Flow

Treat the configuration as one validated root/subtype graph owned by the AI Mentor lesson:

```text
Manual editor ───────────────┐
                             ├─→ validate complete Teacher/Roleplay union
Reviewed generated draft ────┘   → save configuration explicitly
                                 → compile stable runtime prompt at thread start
```

- When a structured root exists, `aiMentorConfigurations.type` is authoritative. Until legacy
  callers are removed, write the same value to `aiMentorLessons.type` transactionally and detect
  any mismatch.
- New-lesson creation saves the lesson, configuration root, and selected subtype in the existing
  transaction.
- Existing-lesson replacement is a synchronous validated write. It does not need a new event or
  queue merely to save one configuration graph.
- AI generation is a separate ephemeral workflow and never persists configuration automatically.
- If saving configuration already triggers course synchronization or generated-translation
  invalidation, reuse those existing mechanisms. Introduce an outbox event only if a new durable
  cross-module side effect is actually required.
- Keep API schemas in named schema files, service contracts in `*.types.ts`, persistence operations
  in a repository, and runtime prompt composition in a dedicated compiler rather than in the
  controller or repository.

### Persistence Model

Follow the AI Judge persistence pattern: one configuration root linked one-to-one to the AI Mentor
lesson, with separate Teacher and Roleplay subtype tables. Every translatable field remains a
`LocalizedText` JSONB column; do not normalize translations into rows.

```text
ai_mentor_lessons
        │ 1
        │
        │ 0..1
ai_mentor_configurations
        │
        ├── 0..1 ai_mentor_teacher_configurations
        └── 0..1 ai_mentor_roleplay_configurations
```

#### Configuration Root

```ts
export const aiMentorConfigurations = pgTable(
  "ai_mentor_configurations",
  {
    ...id,
    ...timestamps,
    aiMentorLessonId: uuid("ai_mentor_lesson_id")
      .references(() => aiMentorLessons.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    type: text("type").$type<StructuredAiMentorType>().notNull(),
    openingInstruction: jsonb("opening_instruction").$type<LocalizedText>(),
    additionalInstructions: jsonb("additional_instructions").$type<LocalizedText>(),
    tenantId,
  },
  withTenantIdIndex("ai_mentor_configurations"),
);
```

- `type` accepts only `teacher | roleplay`; legacy `mentor` never appears in the structured root.
- `openingInstruction` and `additionalInstructions` are shared optional behavior fields.
- Absence of a root row means the lesson has not been converted.

#### Teacher Subtype

```ts
export const aiMentorTeacherConfigurations = pgTable(
  "ai_mentor_teacher_configurations",
  {
    ...id,
    ...timestamps,
    configurationId: uuid("configuration_id")
      .references(() => aiMentorConfigurations.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    taskGoal: jsonb("task_goal").$type<LocalizedText>().default({}).notNull(),
    expertise: jsonb("expertise").$type<LocalizedText>().default({}).notNull(),
    contentScope: jsonb("content_scope").$type<LocalizedText>().default({}).notNull(),
    teachingStyle: text("teaching_style").$type<AiMentorTeachingStyle>().notNull(),
    feedbackGuidance: jsonb("feedback_guidance").$type<LocalizedText>(),
    tenantId,
  },
  withTenantIdIndex("ai_mentor_teacher_configurations"),
);
```

#### Roleplay Subtype

```ts
export const aiMentorRoleplayConfigurations = pgTable(
  "ai_mentor_roleplay_configurations",
  {
    ...id,
    ...timestamps,
    configurationId: uuid("configuration_id")
      .references(() => aiMentorConfigurations.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    scenario: jsonb("scenario").$type<LocalizedText>().default({}).notNull(),
    aiRole: jsonb("ai_role").$type<LocalizedText>().default({}).notNull(),
    learnerRole: jsonb("learner_role").$type<LocalizedText>().default({}).notNull(),
    characterGoal: jsonb("character_goal").$type<LocalizedText>().default({}).notNull(),
    difficulty: text("difficulty").$type<AiMentorRoleplayDifficulty>().notNull(),
    factsAndConstraints: jsonb("facts_and_constraints").$type<LocalizedText>(),
    tenantId,
  },
  withTenantIdIndex("ai_mentor_roleplay_configurations"),
);
```

Persistence rules:

- Add database checks for the allowed root types, teaching styles, and difficulty values while
  keeping shared TypeScript constants authoritative for API/service validation.
- The database enforces one root per lesson and one row per subtype per root.
- Avoid triggers or circular foreign keys to enforce exactly one matching subtype. The
  configuration service owns that transactional invariant:
  - `type = teacher` requires exactly one Teacher row and no Roleplay row.
  - `type = roleplay` requires exactly one Roleplay row and no Teacher row.
- Reads reject and report missing, mixed, or mismatched subtype state rather than guessing.
- No field-level JSONB index is needed because runtime and authoring fetch the graph by lesson,
  configuration, language, and tenant—not by searching prompt text.
- Relational migrations version the schema; a row-level JSON document version is unnecessary.
- Keep persistence graph types in schema/repository-adjacent `*.types.ts`, API contracts in named
  TypeBox schema files, and graph/domain validation in the configuration service.

### Database Migration Strategy

Use an expand → convert → contract rollout.

#### Phase 1: Expand

1. Add `ai_mentor_configurations`, `ai_mentor_teacher_configurations`, and
   `ai_mentor_roleplay_configurations` to the Drizzle schema.
2. Generate the schema migration from `apps/api`:

   ```bash
   pnpm exec drizzle-kit generate \
     --config ./drizzle.migrator.config.ts \
     --name=add_ai_mentor_configuration_tables
   ```

3. Generate tenant RLS enablement/policies through the repository's custom-migration workflow for
   all three new tables.
4. Review generated schema SQL, custom migration, and metadata through the normal repository
   process; do not create migration files ad hoc.
5. Apply through the normal `pnpm --filter=api db:migrate` deployment path.
6. Deploy compatibility code that:
   - requires a complete structured configuration for newly created Teacher/Roleplay lessons;
   - reads the root plus the matching subtype when a configuration row exists;
   - falls back to `aiMentorInstructions` and `aiMentorLessons.type` when no root exists;
   - prevents new `mentor` authoring while still reading existing `mentor` rows.

This phase requires the custom RLS migration but no data/backfill migration because no legacy row
can be converted deterministically.

#### Phase 2: Creator-Reviewed Conversion

- Existing `type = mentor` rows remain null until a creator explicitly chooses Teacher or Roleplay.
- Existing Teacher/Roleplay rows with only `aiMentorInstructions` remain without a configuration
  root until manual or AI-assisted conversion produces every required field.
- Legacy localized instructions may seed `additionalInstructions` in a staged conversion draft,
  but do not persist a partial configuration.
- Saving a reviewed conversion inserts the root and exactly one complete subtype row atomically.
- While legacy callers still read `aiMentorLessons.type`, conversion temporarily writes the same
  type to both the root and lesson row in the same transaction.
- Track conversion coverage with read-only operational queries/metrics:
  - total AI Mentor lessons;
  - legacy `type = mentor`;
  - lessons with no configuration root;
  - root rows missing their expected subtype;
  - root rows with both subtype records;
  - disagreement between root type and temporary legacy lesson type.
- Do not run a bulk AI conversion inside a migration. Provider calls, creator judgement, retries,
  and tenant context do not belong in database migration execution.

#### Phase 3: Contract

Only after conversion coverage is complete and every read/copy/translation/import/export/runtime
consumer uses structured configuration:

1. Verify every AI Mentor lesson has one root and exactly one matching subtype.
2. Remove `mentor` from shared/API/runtime contracts and delete the legacy prompt branch.
3. Remove `ai_mentor_instructions` through a separate normally generated schema migration.
4. Move every remaining consumer to `ai_mentor_configurations.type`.
5. Remove the duplicate legacy `ai_mentor_lessons.type` column in a final normally generated schema
   migration.

Keep the contract migration separate from the additive migration so rollback remains safe and an
incomplete conversion cannot block the initial deployment.

### Configuration Graph Write Semantics

- New lesson creation inserts the lesson, configuration root, and selected subtype in the existing
  lesson transaction.
- Base-language `PUT` validates and replaces the complete root/subtype graph while updating only
  the requested language inside each `LocalizedText` field.
- A type change updates the root type, deletes the previous subtype, inserts the complete new
  subtype, and temporarily synchronizes `aiMentorLessons.type` in one transaction. Deleting the old
  subtype intentionally removes its incompatible translations.
- For a same-type base-language change, the current localization model can detect absent
  translations but cannot prove that an existing translation is still current. Do not describe
  frontend query invalidation as translation freshness.
- Preserve existing non-base values after same-type base-language changes, matching the current
  course localization model. The initial API reports missing translations, not semantic staleness;
  do not add revision metadata in this scope.
- Translation `PATCH` updates only the selected language in every supplied root/subtype
  `LocalizedText` column through the existing `setJsonbField`/`deleteJsonbField` pattern. It cannot
  change root type, teaching style, difficulty, or subtype identity.
- Reject translation writes when the root/subtype graph is missing or invalid, the language is
  unsupported, or the request attempts a structural change.
- Read exact authoring-language content without fallback and let the service compute
  `hasMissingTranslations`. Runtime may apply the existing base-language fallback policy.
- Validate the complete joined graph before compiling it into a system prompt. Missing or mixed
  subtype state fails safely and is never flattened into free-form prompt content.

### Compatibility And Removal Of `mentor`

Do not silently bulk-map existing `mentor` lessons to Teacher or Roleplay.

Initial compatibility phase:

- Stop offering `mentor` for new lessons.
- Keep the legacy Mentor runtime prompt available for existing active threads and unconverted
  lessons.
- Keep existing `aiMentorInstructions` as the legacy fallback while structured configuration is
  nullable.
- Existing Teacher/Roleplay lessons without structured configuration open in a conversion state.
  Their localized legacy instructions may seed `additionalInstructions`, but required structured
  fields still need manual or AI-assisted completion.
- Existing Mentor lessons require an explicit creator-reviewed conversion to Teacher or Roleplay.
- New lessons require a complete structured Teacher or Roleplay configuration.

Later cleanup, in a separate migration after conversion coverage is confirmed:

- Remove the `mentor` shared constant and remaining generated/API contract values.
- Remove the legacy Mentor prompt.
- Remove the `aiMentorInstructions` fallback column only after every consuming import, export,
  translation, runtime, and synchronization path uses structured configuration.

### Authoring API

Use lesson-domain endpoints for persisted configuration:

- `GET /lesson/:lessonId/ai-mentor-configuration?language=...`
- `PUT /lesson/:lessonId/ai-mentor-configuration`
- `PATCH /lesson/:lessonId/ai-mentor-configuration/translations/:language`

Use AI-domain endpoints for ephemeral generation:

- `POST /ai/mentor-configuration/generate`
- `GET /ai/mentor-configuration/generations/:generationId`
- `POST /ai/mentor-configuration/generations/:generationId/revise`
- `POST /ai/mentor-configuration/generations/:generationId/cancel`
- `POST /ai/mentor-configuration/validate`

Controller responses use `BaseResponse`. All endpoints use named TypeBox schemas, generated
Swagger contracts, `COURSE_UPDATE`/`COURSE_UPDATE_OWN`, tenant-scoped repositories, course
editability checks, curriculum feature checks, and lesson/course ownership validation.

Generation inputs may contain:

- Course ID and optional persisted lesson ID.
- Selected Teacher or Roleplay type.
- Creator brief.
- Current unsaved configuration for improve mode.
- Lesson title and learner-facing task description from the current form.
- Optional latest quality result.
- Optional current AI Judge configuration for authoring-time alignment only.

Generation must not receive a real learner's name, group membership, or thread history.
Generation output must not contain the Teacher/Roleplay discriminator. The application service
reattaches the trusted request type after validating the type-specific model payload.

### Generation And Validation

- Add a dedicated BullMQ queue and tenant-aware worker for AI Mentor configuration generation.
- Keep generation state ephemeral and owned by the creator.
- Deliver progress only to the authenticated creator's socket room.
- Store referenced/private repair state in job metadata rather than public progress.
- Use deterministic revision job IDs and a maximum of three attempts.
- Keep cancellation cooperative so the latest reviewable draft remains recoverable.
- Separate deterministic validation from semantic AI validation.
- Limit semantic results to three concise, high-confidence findings.
- Validation targets may reference configurable fields only. They can never target, recommend, or
  correct the creator-owned Teacher/Roleplay type.

Deterministic checks:

- Required text is non-empty after rich-text normalization.
- Input contains fields only for the selected type.
- Generated model output contains no type discriminator and cannot switch the creator-selected
  Teacher/Roleplay type.
- Teaching style and difficulty are valid structural values.
- Text length limits are enforced.
- Unsupported language and base-language structural writes are rejected.

Teacher semantic checks:

- Task goal, expertise, and content scope are coherent.
- The selected teaching style can achieve the task goal.
- The configuration teaches instead of only testing.
- Feedback guidance does not contradict the platform Teacher behavior.
- The Teacher is not instructed to invent unsupported knowledge.

Roleplay semantic checks:

- AI and learner roles are unambiguous and do not conflict.
- Scenario and character goal create a plausible interaction.
- Difficulty changes resistance without making the task impossible.
- Facts and constraints do not contradict the scenario.
- The character participates rather than coaching or evaluating the learner.

Cross-feature checks:

- Configuration aligns with the learner-facing task.
- Optional authoring-time Judge context may be used to detect clear misalignment.
- Never compile or expose Judge criteria, scoring guidance, thresholds, or blocking rules to the
  runtime character.

### Provider Boundary

The currently installed Luma SDK has dedicated AI Judge generator/validator capabilities but no AI
Mentor configuration generator/validator capability.

Before provider-parity integration:

- Add dedicated upstream Luma capability keys and SDK request/response methods for AI Mentor
  configuration generation and validation.
- Keep Core and Luma behind the same strict structured-output contract.
- Validate every provider response with TypeBox before accepting it.
- Fall back to Core using the existing runtime-provider policy when Luma is unavailable or invalid.
- Do not overload AI Judge capability keys with AI Mentor behavior generation.

Issue #1807 generation ships Core-first behind the dedicated runtime/service boundary because the
installed Luma SDK has no AI Mentor configuration generator or validator capability. This temporary
provider limitation must be recorded in the business spec and release notes. Do not silently reuse
AI Judge capability keys. When the upstream Luma SDK adds the dedicated capability, add provider
routing and fallback without changing the web/API contract.

Live conversation tool use also requires provider parity:

- Introduce a provider-neutral `AiMentorConversationAgent` contract instead of constructing a Core
  `ToolLoopAgent` directly inside the lesson service.
- Implement the Core adapter with the installed Vercel AI SDK `ToolLoopAgent`.
- Extend the Luma Mentor chat capability to support the same lesson-resource tool contract before
  enabling agent-decided retrieval for Luma-backed tenants.
- Keep the current pre-retrieval behavior as an explicit temporary compatibility fallback while
  provider parity is incomplete.
- Do not silently give Core and Luma different retrieval behavior. A Core-only agent rollout must
  be an explicit phased-release decision with separate quality and latency reporting.

### Runtime Prompt Composition

Compile the live conversation from independently owned sources:

```text
Mentingo Teacher/Roleplay platform prompt
  + saved structured behavior configuration
  + localized lesson title and learner-facing task
  + authenticated learner name, language, groups, and group characteristics
  + security and learner-personalization rules
  + per-message RAG excerpts
  + voice add-on when voice mode is active
```

Runtime ownership:

- Resolve learner data from the authenticated thread on the backend. Never accept it from the
  frontend request.
- Keep initial data minimization to first name, active language, localized groups, and group
  characteristics.
- Treat learner data, lesson text, configuration text, and retrieved resources as contextual data
  inside explicit prompt boundaries, not higher-priority instructions.
- Preserve the existing tenant-scoped thread ownership checks.
- Resolve and persist the normal system prompt when the thread starts so one attempt has stable
  behavior.
- A retake/new thread resolves current learner and group context again.

RAG:

- Retrieve relevant resource excerpts for each learner message using the current message and
  recent conversational context.
- Inject only the selected excerpts for that response.
- Do not copy RAG content into the saved behavior configuration.
- Keep resource prompt-injection protections in the platform security/RAG block.

Opening:

- Compile the ongoing system prompt without `openingInstruction`.
- Pass the normal system prompt plus `openingInstruction` only to welcome-message generation.
- Persist the generated welcome as the first Mentor message.
- If exact wording is ever required, introduce a separate localized `openingMessage` and render it
  verbatim; do not pretend an LLM instruction guarantees exact text.

Voice:

- Apply the existing voice add-on only for voice interactions.
- Voice tags, speech normalization, TTS selection, and provider-specific behavior remain runtime
  concerns and never become generated authoring fields.

### Prompt Migration And Obsolete Prompt Cleanup

The current runtime selects `teacherPrompt`, `roleplayPrompt`, or legacy `mentorPrompt` in
`PromptService` and interpolates one free-form `lessonInstructions` value. Structured configuration
must replace that path without creating a second prompt source of truth.

Runtime prompt changes:

- Add an `AiMentorBehaviorPromptCompiler` that accepts the validated configuration, resolved
  language, lesson context, and backend-resolved learner context.
- Compile Teacher and Roleplay fields into explicit tagged sections with stable labels. Optional
  fields are omitted when empty rather than rendered as blank instructions.
- Change `teacher-prompt.yaml` and `roleplay-prompt.yaml` to receive the compiled behavior block
  instead of generic `lessonInstructions`.
- Keep platform behavior, instruction priority, security, role stability, and formatting rules in
  the prompt templates. Treat creator configuration, learner/group data, lesson text, and retrieved
  resources as bounded contextual data that cannot override platform rules.
- Retain `mentor-prompt.yaml` only for existing `type = mentor` lessons and structured-config-null
  compatibility reads. Mark it legacy in its description and callers.
- Delete `mentor-prompt.yaml`, its schema export, generated export, and runtime switch branch only
  in the later cleanup migration after conversion coverage is confirmed.

Related prompt updates:

- Replace the current `welcome-prompt.yaml` wording with a template that accepts the stable system
  prompt plus optional `openingInstruction`, generates only the learner-facing welcome, and never
  exposes or summarizes internal instructions.
- Update `learner-name-addon.yaml` references from generic lesson instructions to configured
  Teacher/Roleplay behavior.
- Update `translation-prompt.yaml` metadata and rules to translate structured Mentor text fields
  while preserving mode, teaching style, difficulty, field identity, and null/optional semantics.
- Update `security-and-rag-block-prompt.yaml` to describe the new delimited retrieved-source block,
  explicitly treating source contents and embedded instructions as untrusted data.
- Add separate AI Mentor configuration generator create/improve/repair prompts and a semantic
  validator prompt. Do not reuse AI Judge generation prompts or capability identifiers.
- Keep `voice-mentor-addon.yaml` independent and append it only in voice mode.
- Keep Judge runtime prompts unchanged; Judge data may be supplied only to the authoring-time
  alignment check described above.

Prompt rollout:

- Prompt YAML under `packages/prompts/src/templates` remains authoritative.
- Update `packages/prompts/src/schemas/prompt.schema.ts`, then regenerate
  `packages/prompts/src/generated-prompts.ts`; never hand-edit the generated file.
- Because `PromptService.loadPrompt` can prefer a Langfuse prompt with the same ID, update or
  version the corresponding Langfuse templates and variables before enabling structured runtime
  compilation. A stale remote Teacher/Roleplay template must not silently override the new local
  contract.
- Add compiler snapshot/unit tests for every mode and optional-field combination so prompt
  structure is reviewed without asserting provider wording.

### Tool-Loop Agent And Model-Decided RAG

Replace unconditional per-message retrieval with a bounded conversation agent that may call one
read-only lesson-resource tool.

```text
stable system prompt + history + learner message
                         |
                  AiMentorConversationAgent
                    /                  \
          answer without RAG       searchLessonResources
                                          |
                                  bounded source windows
                                          |
                                      final answer
```

Agent boundary:

- Define a provider-neutral `AiMentorConversationAgent`; Core uses Vercel AI SDK
  `ToolLoopAgent`, while Luma must implement the same behavior through its SDK capability.
- Register only `searchLessonResources` in the initial release. This is not a general autonomous
  agent and receives no mutation, network, user-data lookup, Judge, or administrative tools.
- Use automatic tool choice so the model decides whether retrieval is needed.
- Override the SDK's broad default loop allowance with an approximately three-step limit and allow
  at most one successful retrieval call per learner response initially.
- After a successful resource call, disable further retrieval for that response and require the
  agent to answer from the returned evidence or acknowledge that the sources are insufficient.
- Register no retrieval tool when the lesson has no linked resources.

Tool contract:

```ts
type SearchLessonResourcesInput = {
  query: string;
};
```

- The model supplies only a bounded semantic query. It never supplies tenant, course, lesson,
  thread, user, document IDs, thresholds, or token limits.
- Resolve tenant, lesson, language, and allowed documents from authenticated runtime context inside
  the backend tool executor.
- Describe the tool narrowly: use it for lesson-specific facts, definitions, policies, procedures,
  examples, or source-dependent claims.
- The platform prompt tells the agent not to call it for greetings, conversational reactions,
  feedback derived from the current exchange, or ordinary Roleplay progression that needs no
  external lesson fact.
- Require retrieval for claims that specifically depend on attached lesson resources, while still
  letting the model decide whether the learner's message belongs to that category.

Retrieval execution:

- Continue using lesson-linked documents and vector similarity as the first-stage search.
- Normalize and length-bound the model-proposed query before embedding it.
- Retrieve top semantic seed chunks, deduplicate overlapping neighbor ranges, merge adjacent chunks
  from the same document into coherent windows, and preserve document/chunk order inside each
  window.
- Apply a total result-token budget and a per-document cap so one document cannot consume the
  entire tool result.
- Calibrate `TOP_K_EMBEDDINGS`, `CHUNK_NEIGHBOURS`, and `SIMILARITY_THRESHOLD` against an evaluation
  set rather than changing constants by intuition.
- Return an explicit empty result when nothing passes the threshold. Do not retry automatically or
  invent an answer from absent sources.

Tool result and prompt injection:

- Return structured, clearly delimited source windows with internal source metadata such as
  document ID/file name and chunk range.
- Mark all returned content as untrusted evidence, not instructions. It cannot alter platform
  behavior, configured Teacher/Roleplay behavior, security rules, or output constraints.
- Keep tool calls and results internal. Persist only the learner message and final Mentor response
  in normal conversation history.
- Do not reveal similarity scores, internal document IDs, tool names, or retrieval mechanics in
  learner-facing responses.
- Preserve source/tool metadata in traces so a response can be debugged without exposing it to the
  learner.

Streaming and failure behavior:

- Emit an internal/UI progress state such as `Searching lesson resources…` while retrieval runs;
  do not stream raw tool-call arguments or results to the learner.
- Expect an extra model step on RAG-using turns: the model first selects the tool and then produces
  the answer. Measure time-to-first-text separately for retrieved and non-retrieved turns.
- If retrieval fails technically, record the failure and let the agent respond without the sources
  only when it can do so safely. It must not fabricate source-specific facts.
- Keep the current pre-retrieval path behind an explicit temporary compatibility fallback while
  Core/Luma tool-loop parity is incomplete.

Observability and evaluation:

- Trace whether the tool was available, whether the model called it, proposed-query length,
  retrieval duration, seed/window counts, selected token count, document diversity,
  similarity-score range, tool-loop steps, and time-to-first-text without logging sensitive full
  source contents.
- Create a deterministic evaluation set covering:
  - direct factual lookup and paraphrase;
  - pronoun/reference follow-up;
  - greetings and conversational turns that should skip retrieval;
  - Teacher questions that require lesson evidence;
  - Roleplay turns that should and should not consult scenario resources;
  - competing documents and overlapping neighbors;
  - below-threshold and tool-failure results;
  - prompt injection inside a resource.
- Measure required-retrieval recall, unnecessary-tool-call rate, answer groundedness, context
  precision, latency, and cost against the current unconditional-RAG baseline.
- Do not remove the compatibility fallback until the agent meets accepted quality thresholds.
- Defer extra tools, reranking, hybrid search, and a separate LLM query-rewrite step until evaluation
  demonstrates a need.

### Other Consuming Paths

Update all sources and consumers, not only the lesson form:

- AI Mentor lesson create/update contracts.
- Admin lesson reads and localized translation completeness.
- AI translation candidate generation.
- Master-course snapshot, copy, and synchronization.
- Luma generated-course import/export contracts.
- Seed and test factories.
- Preview mode.
- Existing suggestion examples; remove or replace them with AI creation presets without retaining
  a second source of configuration truth.
- Prompt templates under `packages/prompts`; regenerate generated prompt exports through the
  existing script.

## Implementation Checklist

Delivery order: finish the structured backend contract, complete the unified frontend authoring
flow, verify the migrated experience end to end, then implement the tool-loop RAG improvement as
the final slice. The later Luma phase replaces the temporary import adapter with Luma's native
structured Teacher/Roleplay payload.

### Product And Contract

- [x] Omit `learnerContext`; learner identity and groups remain backend-resolved runtime context.
- [x] Migrate existing `mentor` lessons to incomplete Teacher configuration without requiring
      content-creator action for runtime compatibility.
- [x] Keep current Luma generated-course payload compatibility through
      `buildImportedAiMentorConfiguration`; move native structured Luma output to phase two.
- [x] Add shared Teacher style and Roleplay difficulty constants and exported types.
- [x] Remove `mentor` from the persisted and authoring contract.
- [x] Define the discriminated TypeBox content, response, and translation schemas.

### Persistence And Backend

- [x] Add the one-to-one `aiMentorConfigurations` root with structured type and shared localized
      optional fields.
- [x] Add one-to-one Teacher and Roleplay subtype tables with required mode-specific columns and
      `LocalizedText` JSONB fields.
- [x] Use PostgreSQL enums for structured type, Teacher style, and Roleplay difficulty; add unique
      ownership constraints, tenant indexes, cascading foreign keys, and RLS policies.
- [x] Generate and review the Drizzle schema, RLS, backfill, and legacy-column removal migrations.
- [x] Backfill every legacy row, map `mentor` to Teacher, preserve localized instructions as
      `additionalInstructions`, and remove the obsolete lesson columns.
- [x] Keep repositories persistence-only and put subtype selection and graph validation in services.
- [x] Add a configuration service enforcing exactly one subtype matching the root type.
- [x] Add backend-owned exact-language reads and missing-translation detection.
- [x] Add persisted configuration GET/PUT/PATCH endpoints with unique operation IDs.
- [x] Integrate lesson, root, and selected subtype creation transactionally.
- [x] Preserve current translation semantics for same-type edits and delete the incompatible
      subtype after a type change; do not add freshness revision metadata.
- [x] Update runtime, master-course, generated-course import, translation, backend factories, and
      seeds to consume structured configuration.
- [x] Update frontend preview, form, and E2E factories to consume structured configuration.

### AI Generation

- [x] Add authoritative generator and validator prompt templates under `packages/prompts`.
- [x] Regenerate prompt exports through the existing prompt generation script.
- [x] Add strict structured-output schemas and stable field targets.
- [x] Keep Teacher/Roleplay type in trusted request/workflow state, omit it from model output, and
      reattach it only after successful validation.
- [x] Accept current unsaved, potentially incomplete same-type drafts for Improve and Check
      quality; reject mixed Teacher/Roleplay fields.
- [x] Add Core generator and validator services.
- [x] Add deterministic validation before semantic validation.
- [x] Add background queue, worker, ownership checks, snapshots, progress events, cancellation, and
      revision handling.
- [x] Add independent non-mutating validation of current unsaved values and current selected type.
- [x] Implement Core-first generation directly in the generator and validator services, document
      the temporary missing Luma capability, and avoid speculative provider callbacks with unused
      inputs.
- [x] Keep provider diagnostics in server observability and return stable creator-facing failures.

### Runtime

- [x] Compile Teacher and Roleplay configuration into separate prompt contexts.
- [x] Inject localized lesson and authenticated learner context through explicit prompt boundaries.
- [ ] Add the provider-neutral bounded conversation-agent contract.
- [ ] Keep model-selected RAG dynamic per message rather than persisting excerpts in configuration.
- [x] Restrict `openingInstruction` to welcome-message generation.
- [ ] Preserve voice add-on behavior outside the saved configuration.
- [x] Keep Judge data out of the live Teacher/Roleplay prompt.
- [x] Remove the legacy Mentor runtime branch after migration.

### Prompt Migration

- [x] Update Teacher and Roleplay prompt contracts to accept compiled structured behavior instead
      of free-form lesson instructions.
- [x] Delete the obsolete Mentor prompt and runtime branch.
- [x] Update welcome and learner-name wording for the structured configuration contract.
- [ ] Update security/RAG prompt wording during the final tool-loop RAG slice.
- [x] Add AI Mentor configuration create/improve/repair and validator prompt templates.
- [x] Update current prompt schemas and regenerate prompt exports through the existing script.
- [ ] Coordinate matching Langfuse prompt IDs, variables, and rollout so stale remote templates
      cannot override the new local contract.

### RAG Improvement — Final Slice

- [ ] Add the read-only `searchLessonResources` tool with backend-resolved tenant, lesson, language,
      and document scope.
- [ ] Implement the Core adapter with `ToolLoopAgent`, automatic tool choice, an approximately
      three-step limit, and at most one successful retrieval call per response.
- [ ] Add compatible Luma tool-loop support or retain the explicitly phased compatibility fallback.
- [ ] Register no retrieval tool for lessons without linked resources.
- [ ] Normalize and bound the model-proposed semantic query before embedding it.
- [ ] Deduplicate and merge overlapping neighbor ranges into ordered source windows.
- [ ] Enforce total retrieved-token and per-document budgets.
- [ ] Return delimited untrusted source results and keep tool calls/results out of learner-visible
      persisted history.
- [ ] Add the learner-facing-safe `Searching lesson resources…` progress state.
- [ ] Trace tool availability/use, steps, latency, time-to-first-text, counts, diversity, token use,
      and score range without logging sensitive source bodies.
- [ ] Add the focused retrieval evaluation set, calibrate retrieval constants, and compare against
      the unconditional-RAG baseline.
- [ ] Remove the fallback only after required-retrieval recall, unnecessary-call rate,
      groundedness, latency, and cost meet accepted thresholds.
- [ ] Defer extra tools, reranking, hybrid search, and separate query rewriting until evaluation
      demonstrates need.

### Frontend

- [x] Reuse the AI Judge card hierarchy for the empty, configured, invalid, and non-base-language
      `AI Mentor behavior` states.
- [x] Expose one quiet manual `Configure manually` action in the empty state; do not add AI actions in
      this slice.
- [x] Add the single bounded mobile-drawer configuration dialog with a fixed header and footer.
- [x] Move the Teacher/Roleplay selector into the dialog as an accessible radio-card group; do not
      retain a standalone type selector in the lesson form.
- [x] Add Teacher core fields in the agreed order, led by `Expertise`, plus the collapsed optional
      refinement fields.
- [x] Add Roleplay core fields in the agreed order, led by `AI role` and `Learner role`, plus the collapsed optional
      refinement fields.
- [x] Use bounded rich-text editors for long core and fine-tuning fields.
- [x] Add type-switch replacement confirmation with a clear modal overlay and discard stale
      mode-specific form state.
- [x] Add four one-time scenario examples outside the dialog that fill task description, Mentor
      behavior, fine-tuning guidance, and Judge completion conditions, with overwrite confirmation
      when authored content already exists.
- [x] Keep Judge `Create with AI` visible but disabled with an explanatory tooltip until Mentor
      behavior is configured.
- [x] Add translation-mode locking and missing-translation warnings.
- [x] Use a manual-only footer with `Cancel` and `Apply configuration`/`Save configuration`.
- [x] Synchronize successful existing-lesson saves with React Hook Form defaults.
- [x] Regenerate the web client after API contract changes.
- [x] Add all visible strings to every supported locale.

### Frontend AI Generation — Later Slice

- [x] Add the brief-first AI creation dialog with explicit creator-owned mode selection and the reused
      `Draft` → `Quality check` → `Ready` progression.
- [x] Add mode-specific improvement shortcuts and improve/validate/revise/review flows using
      generated API hooks.
- [x] Stage generated drafts without saving them.
- [x] Never map or apply type from an AI result; block applying a result if the current form type
      differs from the type captured when the action started.
- [x] Keep AI actions unavailable outside the base language.

### Documentation

- [x] Update `docs/specs/ai-mentor-lessons-business-spec.md` with the accepted behavior.
- [x] Document the legacy Mentor conversion and cleanup phase.
- [x] Keep this checklist synchronized with actual implementation progress.

## Edge Cases

- Existing `mentor` lesson: continue legacy runtime behavior and require explicit conversion before
  structured editing; do not guess Teacher versus Roleplay.
- Existing Teacher/Roleplay lesson with only free-form instructions: allow AI/manual conversion and
  preserve old localized instructions as initial advanced context.
- New lesson: stage configuration until the parent lesson create succeeds transactionally.
- Existing lesson: save configuration directly, then reset the parent form field default to the
  saved value.
- Type switch with dirty fields: require confirmation and discard only mode-specific staged data.
- Type switch during generation or after quality check: invalidate the open result and require a
  fresh action for the current creator-selected type.
- Translation missing: return empty authoring fields and backend-owned completeness status.
- Non-base language: prevent changes to type, teaching style, difficulty, and field structure.
- AI generation reconnect: restore the ownership-checked BullMQ snapshot and attempt history.
- Cancel during generation: stop cooperatively and retain the latest inspectable draft.
- Invalid provider structure: reject it and use the configured fallback policy.
- Lesson has no resources: do not expose the retrieval tool to the model.
- Agent skips retrieval for a source-dependent claim: capture it as a required-retrieval evaluation
  failure and retain the compatibility fallback until recall is acceptable.
- Agent attempts repeated retrieval: stop at the configured call/step limit and do not execute a
  second successful search in the initial release.
- Runtime retrieval returns no chunks: answer only from configuration, lesson, and conversation
  context without inventing source-specific facts.
- Core supports the tool loop while Luma does not: keep the explicit compatibility fallback or hold
  rollout; do not silently change behavior by provider.
- Overlapping top RAG chunks: merge the shared neighbor range once rather than injecting duplicate
  source text.
- One document dominates semantic results: enforce the per-document context cap.
- Retrieved document contains prompt injection: retain it only as delimited source evidence and
  never allow it to alter platform or configured behavior.
- Langfuse still serves an old Teacher/Roleplay template: fail or hold rollout through explicit
  prompt-contract/version checks rather than silently rendering the wrong variables.
- Learner changes groups during an active thread: keep that attempt stable; a new thread/retake
  resolves current groups.
- Opening generation fails: surface a stable retryable start error; do not inject the opening
  instruction into every later turn as a workaround.
- Judge configuration changes: runtime Teacher/Roleplay behavior remains independent.
- Configuration root has no subtype, both subtypes, or the wrong subtype: reject the graph, emit an
  operational integrity signal, and never guess which behavior to compile.

## Tests And Validation

Backend unit tests:

- Teacher and Roleplay schema acceptance and mixed-mode rejection.
- Root/subtype graph validation, missing/mixed subtype rejection, and temporary root/lesson type
  mismatch detection.
- Exact-language reads, translation updates, and missing-translation detection.
- Per-field localized update/removal preserves every unrelated language, field, and structural
  value.
- Type conversion deletes the incompatible subtype and writes root type, new subtype, and temporary
  lesson type atomically.
- Runtime compiler output and prompt-boundary placement.
- Teacher/Roleplay prompt compilation with absent and populated optional fields.
- Legacy Mentor prompt selection only for unconverted legacy lessons.
- Opening instruction excluded from ongoing prompts and included in welcome generation.
- Tool registration only for lessons with resources and backend resolution of all authorization
  context.
- Agent no-tool response, one-tool response, empty-result response, tool-failure response, and
  step/call-limit behavior.
- Model-proposed query normalization, source-window deduplication/order, token budgets, and
  per-document caps.
- Retrieved-source boundaries and exclusion of tool calls/results from learner-visible persistence.
- Deterministic and semantic validation targeting.
- Generator output cannot return or change Teacher/Roleplay type; the server reattaches the trusted
  request type.
- Queue ownership, revision idempotency, cancellation, and reconnect snapshots.
- Legacy Mentor fallback and explicit conversion.

Backend E2E tests:

- Apply the additive migration over representative legacy `mentor`, Teacher, and Roleplay rows and
  verify every existing value is preserved and no configuration roots are fabricated.
- Create a new Teacher and Roleplay lesson with structured configuration.
- Read, replace, and translate configuration with permissions and tenant isolation.
- Reject unsupported languages and non-base structural writes.
- Start, snapshot, revise, cancel, and independently validate deterministic mocked generation.
- Build a learner thread using localized configuration and backend-resolved learner/group context.
- Let the agent retrieve relevant lesson sources without duplicate neighbor windows, skip retrieval
  for a conversational message, and continue cleanly when no chunk passes the threshold.
- Verify equivalent Core/Luma behavior or the explicit compatibility fallback.
- Preserve historical learner/Judge behavior while configuration is later edited.

Frontend component/unit tests:

- Empty, configured, invalid, and non-base-language card hierarchy.
- Teacher and Roleplay core/optional field visibility and ordering.
- Keyboard-accessible mode and behavior selectors.
- Type switching without data, confirmation with dirty data, and discarded hidden fields.
- Mobile drawer sizing and fixed footer.
- Translation structural locking and empty missing translations.
- Creation and improvement generation/validation reducer transitions.
- Current unsaved values and current selected type are used by Improve and Check quality.
- A result created for a previous type cannot be applied after a creator-owned type switch.
- Real active revision state and repeated-action locking.
- Field-targeted findings and diffs.
- Invalid optional field automatically opens the refinement section and receives focus.
- Saved configuration resets the parent form default.

Frontend E2E:

- Create and reopen a manual Teacher configuration.
- Create and reopen a manual Roleplay configuration.
- Translate both configuration types and clear course translation warnings.
- Use deterministic mocked AI generation to review and apply a draft without auto-saving.
- Confirm existing preview and learner conversation entry still work.
- Do not call live AI providers from Playwright.

Validation commands:

- `pnpm --filter @repo/shared build`
- `pnpm generate:client`
- `pnpm lint-tsc-api`
- `pnpm lint-tsc-web`
- Focused API Jest tests for configuration, generation, runtime compilation, and translation.
- Focused RAG evaluation/contract tests for retrieval relevance, context budgets, and source
  injection resistance.
- Focused web Vitest tests for the dialog, state reducer, mappings, and hooks.
- Relevant AI Mentor Playwright curriculum specs.
