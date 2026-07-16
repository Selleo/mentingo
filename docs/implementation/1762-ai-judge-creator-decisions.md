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
