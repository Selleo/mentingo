# Voice Mentor preview verification

## Scope

Authors with `COURSE_UPDATE_OWN` can preview their own lesson; `COURSE_UPDATE` permits previewing existing lessons in the authenticated tenant. Both require `AI_USE`. Preview startup carries an explicit boolean flag and rejects malformed or mixed lesson/Practice targets. Preview authorization is checked before thread creation and again before spoken turns. Ordinary learner enrollment and Practice ownership checks remain unchanged.

The editor preview and authorized course preview expose Voice Mentor without requiring Learn mode. Preview grading stays disabled in the composer and desktop/mobile voice overlays. Starting or streaming a preview does not invoke the judge, reset lesson progress, or publish completion events. Conversation threads/messages still use the existing caller-owned lesson conversation path; this is not an ephemeral or separately persisted preview conversation.

## Local validation

- Full web suite: 348 files passed, 2 skipped; 2,047 tests passed, 12 skipped (Node 24.22.2; `NODE_OPTIONS=--no-experimental-webstorage`).
- Full API suite: 316 suites passed, 1 skipped; 2,871 tests passed, 51 skipped (CI-pinned Node 22.15.0).
- Focused UI/protocol regressions: 16 passed.
- Focused API authorization/voice regressions: 36 passed.
- Web and API `lint-tsc`: passed, with three pre-existing frontend import warnings.
- Web production build and API build, including Workflow typecheck/build: passed on Node 22.15.0.
- Changed-file formatting and `git diff --check`: checked before commit.

The initial complete API run on Node 24 failed in two unrelated assistant suites because Nest's scheduler uses removed `util.isString`. Both suites pass, along with the complete API suite, on the repository's CI Node 22.15.0 runtime. No unrelated runtime compatibility changes were made.

## Browser evidence and limitations

The attached desktop controls and mobile overlay screenshots were captured in an isolated real-browser component harness using sample lesson data and a mocked audio provider. The harness verified that the voice action is enabled, its target includes `preview: true`, text/dictation controls are disabled for a threadless preview, and desktop/mobile grading controls are disabled. The mobile view had no horizontal overflow. The harness server was stopped after capture.

These screenshots are **not full application E2E or live-provider audio evidence**. No real microphone-to-provider-to-playback round trip was performed. The curriculum Playwright scenario was extended to assert the author-preview Voice Mentor action and disabled grading in the real application; its provider-availability request is deliberately stubbed and it does not initiate an external voice call. PR CI/E2E status is recorded in the pull request rather than asserted here.

- [Desktop component harness](mentingo-voice-preview-controls.png)
- [Mobile component harness](mentingo-voice-preview-mobile.png)
