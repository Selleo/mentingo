# AI SDK v7 Stream Migration

## Goal

Move Mentingo chat consumers to AI SDK v7 while keeping Luma/mentingo-ai as the upstream source of truth for course generation.

## Decisions

- Luma/mentingo-ai continues to emit legacy LangChain-compatible data stream frames:
  - `0:"text"` for assistant text.
  - `2:[{...}]` for course-generation progress and generated-course events.
- Mentingo API is the adapter boundary. It reads upstream `0:` and `2:` frames and returns AI SDK v7 UI message chunks to the web app.
- Mentingo web uses `useChat` with `DefaultChatTransport`.
- Chat components render `UIMessage.parts` directly. Do not add global conversion helpers that reshape UI messages back to the old `content` contract.
- No stream-version negotiation is needed until the public Luma stream protocol changes.

## Implementation Checklist

- [x] Update Mentingo API mentor chat endpoint to return UI message streams.
- [x] Update Mentingo API course-generation chat endpoint to map upstream `0:`/`2:` frames to UI message chunks.
- [x] Update course-generation web chat to use `DefaultChatTransport`.
- [x] Update AI mentor web chat to use `DefaultChatTransport`.
- [x] Render text from `UIMessage.parts` in the shared AI mentor chat message component.
- [x] Regenerate API client after request-schema changes.
- [x] Run focused API and web type checks.

## Current Status

- Done: Node/package upgrade groundwork is in place.
- Done: `OPENAI_MODELS.BASIC` now points to `gpt-5.4-nano`.
- Done: Mentor chat request normalization moved into `AiService`, with `common.validation.messageRequired` as the empty-message error key.
- Done: Shared UI message text extraction types live outside controllers.
- Done: The shared AI mentor `ChatMessage` component can render `UIMessage.parts`.
- Done: Course-generation stream adapter service maps upstream `0:`/`2:` frames and the controller only pipes the UI stream.
- Done: Course-generation web chat uses v7 `DefaultChatTransport`.
- Done: AI mentor web chat uses v7 `DefaultChatTransport`.
- Done: Generated API client is refreshed after request-schema changes.
- Done: Focused API and web validation commands pass.

## Fallback Routing Checklist

- [x] Inventory AI runtime call sites and assign each flow to `core`, `luma`, or fallback-capable routing.
- [x] Add an API-side Luma runtime configuration resolver with a short cache so chat/embed requests do not call Luma configuration every time.
- [x] Route AI mentor chat through a helper that chooses Luma when configured and core otherwise.
- [x] Route AI mentor welcome/summary text generation through a helper that chooses Luma when configured and core otherwise.
- [x] Route AI mentor judge through a helper that chooses Luma when configured and core otherwise.
- [x] Route AI mentor/RAG embeddings through a helper that chooses Luma when configured and core otherwise.
- [x] Route missing-translation generation through a helper that chooses Luma when configured and core otherwise.
- [x] Route dictation transcription through a helper that chooses Luma when configured and core otherwise.
- [x] Route voice-mode AI mentor chat through the same mentor chat helper and pass `voiceSessionId` to Luma.
- [ ] Keep course generation on the existing Luma course-generation endpoint; only add explicit core fallback if product needs it later.
- [ ] Add focused tests or service-level coverage for `core`, `luma`, and fallback cases.
- [ ] Run focused API and web validation after routing changes.

## Fallback Routing Inventory

- AI mentor chat: fallback-capable routing. Use Luma when `aiMentorChat` is enabled for Luma/custom runtime, otherwise use core.
- AI mentor chat streaming: use Luma `mentor.streamChat` for normal turns. Voice-mode mentor chat passes `voiceSessionId` through the same request so Luma can bind the text response to the active voice session directly.
- AI mentor welcome message: fallback-capable routing. Use Luma `mentor.generateChat` when `aiMentorChat` is enabled for Luma, otherwise use core.
- AI mentor summary generation: fallback-capable routing. Use Luma `mentor.generateChat` when `aiMentorChat` is enabled for Luma, otherwise use core.
- AI mentor judge: fallback-capable routing. Use Luma `mentor.judge` when `aiMentorJudge` is enabled for Luma, otherwise use core.
- AI mentor RAG embeddings: fallback-capable routing. Use Luma when `aiMentorRagEmbeddings` is enabled for Luma/custom runtime, otherwise use core.
- Ingestion embeddings: fallback-capable routing if this uses the same mentor/RAG embedding capability; otherwise keep core until product separates the capability.
- Missing translations: fallback-capable routing. Use Luma `ai.generateTranslations` when `translationGeneration` is enabled for Luma, otherwise use core.
- Dictation transcription: fallback-capable routing. Use Luma `ai.transcribeDictation` when `dictationTranscription` is enabled for Luma, otherwise use core.
- Voice mentor chat: uses the same mentor chat routing as text chat and passes `voiceSessionId` to Luma.
- Voice mentor transcription and TTS: decide separately because they use voice-session semantics rather than the existing dictation endpoint.
- Course generation: stays on the existing Luma course-generation endpoint for now.

## Fallback Routing Status

- Done: `AiRuntimeService` caches Luma runtime configuration for 60 seconds.
- Done: `AiRuntimeService` resolves runtime source as `core` or `luma` from Luma capability status.
- Done: AI mentor chat, including voice-mode chat, uses Luma when `aiMentorChat` resolves to Luma, with core fallback.
- Done: AI mentor welcome/summary generation uses Luma when `aiMentorChat` resolves to Luma, with core fallback.
- Done: AI mentor judge uses Luma when `aiMentorJudge` resolves to Luma, with core fallback.
- Done: AI mentor RAG embeddings and ingestion embeddings use Luma embeddings when `aiMentorRagEmbeddings` resolves to Luma, with core fallback on missing config or Luma failure.
- Done: missing-translation generation uses Luma when `translationGeneration` resolves to Luma, with core fallback.
- Done: dictation transcription uses Luma when `dictationTranscription` resolves to Luma, with core fallback.
- Remaining: Voice mentor transcription and TTS are still separate socket/audio flows and remain out of scope for this fallback pass.

## Deployment Note

The API request body changes from old `content` payloads to v7 `message` payloads. Deploy the web and API together for this migration.
