# Voice Mentor sentence delivery

## Decision

Every generated Voice Mentor reply uses structured sentence delivery by default,
in both Core's native runtime and the Luma backend. There is no environment flag,
request option, provider restriction, or second model call. Text chat keeps its
existing streaming path.

The model returns one object per sentence, containing a hidden English `cue` and
spoken `text`. It chooses emotional continuity from conversation context; the
application does not copy cues or impose an emotion decay schedule. A required
cue field prevents omission, but semantic emotion and grammatical sentence
boundaries remain model responsibilities.

## Flow and ownership

- `PromptService.buildPrompt` selects bundled provider-specific voice guidance.
  It keeps the sentence contract aligned without publishing Langfuse changes;
  scenario, security, interruption and timing prompts retain managed loading.
- Core's native `AiService.streamCoreMentorChat` uses the installed AI SDK's
  `Output.array` and `elementStream`. `voice-delivery.ts` validates each complete
  element, emits normal voice markup, and requires final output validation before
  persisting a completed turn. Native text responses retain their SDK UI stream.
- For Luma calls, Core sends the existing `voiceSessionId`; no SDK or public
  request contract change is required. The backend validates the owned active
  session and automatically requests its sentence schema. Its bounded incremental
  parser emits complete sentences through the existing interruption and TTS path.
- Both paths project objects into `⟦cue:...⟧sentence` markup. Existing caption and
  history filters hide controls; say/spell spans retain pronunciation behavior.
  Luma's speech parser maps free-form cues to ElevenLabs audio tags, exact allowed
  emotion values to SSML emotion controls, and drops cues for plain speech
  providers. Generic guidance requests an allowed emotion value for each cue.

The schema envelopes differ internally (SDK array output versus Luma `segments`),
but the downstream voice contract is identical. The model must support structured
streaming; unsupported models fail through the existing error path.

## Failure and cancellation

Only completed objects reach speech. Both paths bound cue/text length and sentence
count, reject control injection, and close their generators on cancellation.
Malformed or truncated output fails without reading JSON or replaying sentences.
Previously queued audio cannot be undone. Cancelled/invalid native generations
do not persist a completed mentor reply.

## Alternatives and rollout

Prompt-only inline generation allowed missing cues; automatically repeating cues
previously caused unnatural speech. A separate rewriting model adds latency.
Structured sentence generation retains one model call and starts speech before
the full response completes.

Ship this Core PR with AI PR #53. Existing request fields and socket events remain
unchanged; there is no feature toggle. Use a fresh voice session when testing.
Langfuse v6 remains unchanged. Human listening is required across supported
providers; text/schema coverage does not establish audible emotion or naturalness.

## Validation

79 focused Core tests passed across prompt selection, runtime routing, native model
settings, persistence/cancellation, voice control filtering and sentence validation.
Two of these use the installed AI SDK with a synthetic streaming model: the first
sentence is released after the next object starts, before the remainder finishes;
a truncated final envelope fails. No external provider request is made. API
TypeScript checking and scoped ESLint passed on Node 22.15.0. The prompt package
build passed and both YAML templates match the AI backend's bundled fallbacks.
The matching backend passed 2,349 unit tests and its scoped lint/format/type checks.
Live provider audio and human listening are still pending.
