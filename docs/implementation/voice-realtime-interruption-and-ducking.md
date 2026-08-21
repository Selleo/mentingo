# Voice Realtime Interruption And Playback Ducking

## Summary

Make realtime voice conversations feel interruptible without reintroducing the
frontend-VAD packet-gating problem. Continuous realtime capture will keep
forwarding every PCM frame to Gladia. Gladia's provider `speech_start` remains
the authoritative server interruption signal, while a small local activity
detector is used only to duck mentor playback immediately and to drive the
listening visualizer.

## Product Decisions And Constraints

- Realtime Gladia mode sends every captured PCM frame; local activity detection
  must never drop, delay, reorder, or renumber audio chunks.
- Gladia `speech_start` is the only authoritative realtime interruption marker.
  A local signal must not independently cancel a server turn, otherwise one
  utterance can produce two competing interruption events.
- Pause/batch and manual transcription keep their existing VAD-segmented flow;
  their client speech boundary remains the interruption marker.
- Playback ducking is immediate and local. It should reduce mentor audio to a
  low gain rather than hard-stop it while the provider signal is in flight.
- The model should receive interruption context as a one-turn, trusted runtime
  instruction, not as a permanent change to the base system prompt and not as
  learner-authored text.
- Interruption context is advisory: the mentor may acknowledge or adapt to the
  interruption when natural, but must not expose internal event names, Redis
  state, or implementation details.

## Current Defects To Close First

- Verify that Luma receives Gladia `speech_start` messages in the production
  SDK path and that the active mentor turn is still claimable when the event
  arrives.
- Emit trace fields for provider message type, active turn id, speech epoch,
  and interruption result (`interrupted_turn_id` or `no_active_turn`).
- Ensure `audio:output:interrupted` reaches the browser and resets the player,
  mentor-turn UI state, and playback ducking state.
- Keep the per-session audio-chunk lock around sequence claiming and provider
  forwarding so provider events are not starved by concurrent chunk handlers.

## Runtime Flow

```text
Microphone
   ├─ same PCM frame ───────────────► Gladia realtime stream
   │                                      │
   └─ local RMS activity observer         └─ speech_start
          │                                      │
          ├─ update listening visualizer         ├─ request_interrupt()
          └─ duck mentor playback                ├─ publish audio.output.interrupted
                                                 ├─ mark active turn cancelling
                                                 └─ store one-turn interruption context

Next finalized learner turn
   └─ LLM prompt builder consumes interruption context once
```

## Frontend Plan

### Capture and activity observer

- Extract a small `AudioActivityDetector` utility from the continuous
  `ScriptProcessorNode` path. It consumes the already-captured float PCM frame,
  so it does not open a second microphone stream or run a second audio graph.
- Use adaptive RMS/noise-floor detection with a short attack and release
  hysteresis (for example, roughly 60–120 ms attack and 200–300 ms release).
  Clamp the displayed level to a stable range and keep a minimum noise floor so
  laptop fan noise does not animate the UI continuously.
- Keep `onLevelChange` driven by measured frame energy in continuous mode. Do
  not derive the visualizer from whether a chunk was sent; continuous mode no
  longer calls the segmented-mode `onChunkSent` callback.
- Expose `onSpeechActivityStarted` and `onSpeechActivityEnded` as observer
  callbacks. They are local UI/audio controls only in the first iteration.

### Playback ducking

- Add a ducking method to the existing realtime PCM player, backed by a
  `GainNode` ramp rather than abrupt volume changes.
- When local activity starts while mentor audio is playing, ramp to a low
  playback gain (for example 0.10–0.20) within one audio frame. Restore the
  normal gain after the activity release or when the server interruption event
  arrives.
- Do not duck when the microphone is muted, capture is inactive, or no mentor
  audio is currently queued.
- A server `audio:output:interrupted` event must clear the ducking state even if
  the local release callback never fires.

### UI state

- Keep the listening visualizer driven by the continuous activity level even
  while the server is waiting for a provider speech event.
- Treat the server interruption event as the state transition from speaking
  back to listening. Local activity can animate the visualizer before that
  event, but must not claim that the turn was cancelled.
- Add a small debug-only indicator/trace field for local activity versus
  provider-confirmed interruption; do not expose transport terminology in the
  learner-facing UI.

## Luma Backend Plan

### Unified interruption event

- Normalize all interruption sources to one coordinator operation:
  `request_interrupt(session_id, reason, trigger, source, detected_at_ms)`.
- Realtime Gladia `speech_start` calls that operation. Pause/batch client VAD
  uses the same operation with the client source. The coordinator remains the
  only component that claims the active turn and publishes
  `audio.output.interrupted`.
- Make the Gladia callback path observable and idempotent. Duplicate
  `speech_start` messages for the same speech epoch must not publish duplicate
  interruption events.
- Keep the interrupt marker and source in the trace (`provider_speech_start`,
  `client_speech_start`, or future source), together with the interrupted turn
  id and detection timestamp.

### One-turn interruption context

- Add a typed runtime context, for example:

  ```text
  VoiceInterruptionContext {
    source: gladia | client
    reason: user_speech | session_stopped | ...
    interrupted_turn_id: string
    detected_at_ms: number
  }
  ```

- Persist it with the active voice session/turn in Redis when the coordinator
  claims an interruption. Do not persist it as a conversation message.
- When the next learner turn is committed, atomically consume the context and
  pass it to the LLM prompt adapter. A retry must not inject the same context a
  second time.
- Render it as a bounded trusted runtime instruction such as: “The learner
  started speaking while your previous response was being delivered. Continue
  naturally from the learner's new message; acknowledge the interruption only
  if useful.” Never interpolate raw event payloads into the instruction.
- Keep the base Mentor/Teacher/Roleplay system prompt unchanged. The context is
  an ephemeral turn addendum and must not alter the configured persona.

### Provider and worker behavior

- Confirm the worker cancels the TTS task after the coordinator marks the turn
  interrupted, and that late LLM/TTS deltas are discarded for the interrupted
  job.
- Preserve mentor response traces and mark the interrupted turn consistently
  even when no audio chunk has been emitted yet.
- Keep the per-session chunk lock in `VoiceSessionFacade`; serialize recovery,
  stop, and disconnect cleanup with chunk handling.

## API, Types, And Observability

- Keep public constants as `as const` objects/types, not TypeScript enums, for
  socket events, capture modes, provider names, and interruption sources.
- Add/extend internal schemas only where the browser or another service needs
  the event. Local activity callbacks do not need a network event in the first
  slice.
- Add trace milestones for provider message receipt, interruption request,
  output interruption publication, turn cancellation, and interruption-context
  consumption. Include `speech_epoch`, source, active/interrupted turn ids,
  and latency from detection to output interruption.
- Include `received_seq` and `expected_seq` in sequence-gap diagnostics so a
  future transport regression is immediately distinguishable from a provider
  problem.

## Implementation Checklist

- [ ] Finish the Gladia callback/active-turn diagnostics and verify a real
      `speech_start` reaches `request_interrupt`.
- [ ] Add the shared interruption source/context types and Redis lifecycle.
- [ ] Make interruption claiming and publication idempotent per speech epoch.
- [ ] Add the same-frame adaptive RMS activity detector to continuous capture.
- [ ] Wire the detector to the listening visualizer without gating audio sends.
- [ ] Add gain-ramped mentor playback ducking and reset it on provider-confirmed
      interruption.
- [ ] Consume the one-turn interruption context in the next LLM prompt.
- [ ] Add Luma unit tests for provider interruption, duplicate events, context
      consumption, and interrupted worker cleanup.
- [ ] Add web unit tests for activity thresholds, level updates, ducking, and
      recovery after `audio:output:interrupted`.
- [ ] Run API/web typechecks, focused tests, and a manual realtime session with
      mentor speech, learner interruption, and quiet speech.

## Edge Cases

- A learner speaks quietly: audio still reaches Gladia; local ducking may be
  absent, but provider interruption must still cancel the turn.
- Echo from mentor audio triggers local activity: ducking is allowed, but no
  server interruption occurs without Gladia confirmation.
- Gladia sends duplicate or late speech events: speech epoch and idempotent
  turn claims prevent duplicate cancellation/context injection.
- The learner starts speaking while no mentor turn is active: update the
  listening state but do not create an interruption context.
- The socket reconnects while audio is flowing: sequence replay remains ordered
  and does not cause a second interruption.
- The model finishes before the provider event arrives: the event becomes a
  no-op for turn cancellation, but remains traceable as a provider speech
  signal.

## Tests And Validation

- Luma: focused realtime-runtime and coordinator tests, facade concurrency test,
  worker interruption test, and prompt-context consumption test.
- Mentingo web: `pnpm lint-tsc-web`, focused Voice tests, and a manual browser
  test with both normal and quiet speech while mentor audio is playing.
- Regression criteria: no sequence-gap flood, no audio packet gating in
  realtime mode, one interruption event per active turn, immediate local duck,
  and a single interruption note in the next model turn.
