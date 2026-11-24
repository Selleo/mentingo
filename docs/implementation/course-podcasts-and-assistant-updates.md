# Lesson podcasts, Assistant realtime updates, and mobile practice

This change stacks on [Core PR #2330](https://github.com/Selleo/mentingo/pull/2330) and pairs with a Mentingo AI change stacked on [AI PR #73](https://github.com/Selleo/mentingo-ai/pull/73). Core uses the parent branch’s published Luma SDK dependency and validates the lesson podcast export in its application contract.

## Lesson podcasts

The planner can propose a podcast inside a content lesson when two perspectives, a worked case, or a trade-off help teach the lesson. Follow the course harness guidance for natural dialogue, explicit author requests and exclusions, and a flexible four-to-six-minute target. Use the lesson draft and its sources for script grounding. Produce a native inline MP3, with a playable draft preview and the existing learner lesson audio player.

### Voice configuration

- [x] In Mentingo AI Runtime, add typed language settings to the selected TTS provider configuration. Use an English and Polish language picker and female and male default voice ID fields. Organization-owned settings can be reused through existing integration-key runtime assignments. Support the built-in provider selection as well as custom profiles.
- [x] Add a provider-specific podcast voice pool for each language. Choose one female and one male voice at random from available pool entries and persist the resolved cast for the episode. Validate distinct IDs and isolate resolution to the organization and its selected provider.
- [x] With no override, retain existing Voice Mentor presets. Seed the ElevenLabs Polish podcast pair with Magdalena (`N0GCuK2B0qwWozQNTS8F`) and Oscar (`04BD7Fenyf9Ysq983wrd`). For other provider and language combinations, use that provider's eligible built-in pair or existing language defaults. Verify synthesis access using the deployment's configured provider credentials before rollout. The planner should consider automatic podcasts only when the selected provider can resolve two eligible voices.

### Generation and application

- [x] Generate the structured dialogue and review factual fidelity before synthesis. Start lesson audio work as soon as the grounded lesson draft is ready, alongside visuals. Use a bounded queue for independent speech turns, with concurrency limits keyed to the provider and credential scope. Persist completed clips and the selected cast. Reconcile an ambiguous paid request before retrying that turn.
- [x] Measure clips, mix scenes in script order, preserve intentional gaps and overlaps, normalize loudness, and encode MP3. Provide FFmpeg and FFprobe in the worker runtime. Persist the final asset with tenant-scoped storage and clean up temporary files.
- [x] Extend the authoring asset contract to carry podcast state, MIME type, duration, and stable asset and placement IDs. Reuse the review preview and native lesson resource pipeline. Validate the resulting audio and attach the lesson resource idempotently. Regenerate SDK, OpenAPI and client artifacts through repository commands.
- [x] Keep the lesson in Generating while planned assets are pending. Let the author inspect the draft and retry an audio failure while Apply waits for the podcast. Include the ready audio in the same native apply operation and use the existing revision and permission checks.
- [x] Show pending and failed states at the placement and offer an audio-only retry. Reuse finished clips and keep manual lesson edits. On success, render the native player with no autoplay.

A disposable Hangar run selected a worked case, queued its podcast, and returned a 7:02 Polish MP3 that decoded in full. Hosted stage timings and learner-player playback still need verification.

## Assistant realtime ([#2088](https://github.com/Selleo/mentingo/issues/2088))

- [x] Reuse Core Socket.IO for persisted Assistant message checkpoints, activity, and terminal run updates. Publish after commit, carry stable message and run identifiers and ordering information, and retain the existing durable workflow.
- [x] Authorize subscriptions by tenant, actor, session and thread. Cover logout, impersonation and permission loss using existing socket session invalidation.
- [x] Update the Assistant transcript cache for partial and terminal events. Use HTTP on initial load, successful room join or reconnect, and when an event reveals a newer run. Resolve stale pending message state on run termination. Transcript reads have no scheduled poll.
- [ ] Verify reload, disconnect, duplicate and stale events, minimization, and terminal and idle states. Compare request rate, database load and update latency with the polling baseline, including 500 concurrent conversations where feasible. Report transport and provider limits independently.

## Mobile AI Mentor Practice ([#1975](https://github.com/Selleo/mentingo/issues/1975))

- [x] Keep the full practice composer visible on mobile with a long transcript, keyboard open, and browser chrome and safe-area changes. Preserve text send, voice controls, and evaluation actions.
- [x] Add a voice action to the active dashboard practice widget. It opens the existing full-screen practice session directly in voice mode. Use the existing voice session and permission flow. If the browser requires a gesture or microphone permission on the destination screen, show the existing control or prompt there.
- [ ] Verify the dashboard action opens the same practice session, and validate keyboard and microphone behavior on mobile Safari and Chromium.

## Delivery and validation

- [ ] Run focused provider-resolution, podcast retry and audio apply tests, Assistant realtime and isolation tests, and practice composer and routing tests. Run `pnpm test:ai:regression` after meaningful AI changes.
- [ ] Verify real generated audio in the author preview and the learner player, including seeking. Listen to the built-in Polish cast and verify a second provider through its own pool. Validate repeat apply and inspect existing lesson edits.
- [ ] Update the matching business specs and check self-onboarding catalog and recording coverage for changed flows as required by Core repository instructions.
