# Incremental Voice Mentor delivery

Voice replies keep the existing structured sentence envelope and per-sentence emotional cues. Core decodes `streamText().textStream` rather than the SDK's complete-element stream. `VoiceDeliveryParser` forwards decoded text as soon as that sentence's cue is complete and valid, before the sentence closes. `streamVoiceSentenceMarkup` retains completion validation and upstream iterator cleanup. The visible transcript removes control markup; speech retains pronunciation and delivery controls.

The path is `AiService.streamCoreMentorChat` → `streamVoiceSentenceMarkup` → `ExternalAudioService.handleLearnerTranscription` → Luma speech input. Core flushes an accumulated speech fragment when it contains a word boundary, rather than requiring a boundary at its end. Luma retains unfinished words and pronunciation spans for TTS. This matters because partial JSON text fragments often end inside a word and trailing whitespace is withheld until subsequent text confirms that it is internal to the sentence.

The parser accepts either field order. When text precedes its cue, that sentence stays buffered until the complete cue can be validated. It rejects unknown/duplicate keys, malformed escapes and envelopes, reserved inline delivery controls, more than 12 sentences, cues over 128 UTF-16 code units, sentence text over 2,048 UTF-16 code units and envelopes over 200,000 code units. Incomplete JSON escapes, surrogate pairs and possible forbidden control prefixes are withheld across fragments. Normal completion still requires a valid complete envelope and the SDK's structured-output validation.

Malformed suffixes can fail after earlier text has reached the learner or TTS. Already delivered speech cannot be retracted. Core aborts the model controller, sends a sanitized `mentor.text.error` rather than normal EOF, and clears the matching active audio turn. The persistence wrapper does not save it as a completed reply. Luma's error consumer leaves the text source pending until TTS cancellation, preventing normal EOF from flushing an unfinished pronunciation span. Cancellation closes the upstream iterator; provider cancellation remains tied to the existing abort signal and Luma interruption handling.

Luma implements the corresponding prefix decoder for its existing `segments` envelope. The wire format and SDK API are unchanged, so Core and Luma can deploy independently. Both need the fix to improve both runtime routes. No migration, dependency upgrade, generated client change or managed-prompt publication is required.

## Validation

Offline checks cover the installed AI SDK delivering an open sentence, Core service wiring, Core speech forwarding before sentence completion, split Unicode/JSON escapes, pronunciation markup and display projection, invalid/truncated output, cancellation and persistence. The Luma companion change verifies partial text through its actual speech parser and ElevenLabs text framing. These checks do not measure provider TTFT or browser first-audio latency. Word buffering, pronunciation spans and the speech provider's generation threshold can still delay audio after the first application text delta.

See [AI Mentor lessons](specs/ai-mentor-lessons-business-spec.md) for the existing user flow. This repair restores that documented streaming behavior.

### Local checks (2026-11-16)

- `pnpm --filter=api test --runInBand --runTestsByPath src/ai/utils/voice-delivery.spec.ts src/ai/utils/voice-delivery-sdk.spec.ts src/ai/services/ai-core-voice-stream.spec.ts src/ai/services/ai-voice-stream.spec.ts src/audio/external-audio.service.spec.ts src/audio/external-audio-practice.spec.ts src/ai/utils/__tests__/voiceControlTags.spec.ts`: 99 tests passed across seven suites. The six transport tests were rerun after adding explicit controller cancellation and passed.
- `pnpm --filter=api exec tsc --noEmit`: passed. Scoped `eslint` for changed TypeScript and `prettier --check` for changed TypeScript/Markdown passed under Node 22.23.5.
- A deterministic corpus of 50 valid envelopes produced identical normalized output from the Core and Luma parsers, including both field orders, fragmented Unicode escapes, pronunciation controls and whitespace.
- The Luma companion worktree passed 254 focused tests, including early speech framing, public bridge errors and delayed/failed error publication in the turn runner. Scoped Ruff, Black and compilation checks passed. BasedPyright was clean on changed parser production modules and parser tests; the public execution test module retained its existing 38 errors/52 warnings without new diagnostics. Independent review verified the three error-race/cleanup regressions.
- No browser microphone test, external provider request, managed-prompt publication or deployment was performed. No generated API artifacts or database migration are needed.

The Luma runner/test BasedPyright check also retains three existing mock-assertion errors and 32 warnings, including protected-method access in unit tests. These diagnostics do not block the focused Python runtime tests; they are not reported as a clean repository-wide type check.
