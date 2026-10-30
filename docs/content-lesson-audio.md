# Audio in content lessons

## Author and learner workflow

Audio is a resource inside a **content lesson**, not a new lesson type or a separate podcast library. Authors use the audio upload control, the existing resource picker, or file drag-and-drop. A successful upload inserts a native inline player. Multiple players can be mixed with text, images, video, and downloadable resources. An audio-only lesson is valid.

The upload queue shows pending work and failures. An upload that fails must not insert a playable-looking node. Authors remove a player with the normal editor node controls or selection/deletion. This removes the occurrence, not the stored resource; other references remain intact.

Learners use native browser controls for play/pause, seeking, volume, and duration when available. There is no autoplay and no new listening-percentage completion rule. Audio does not enter the video transcoding, video-provider, or video-progress subsystem.

## Storage and access

The editor persists a stable `/api/lesson/lesson-resource/<resource-id>` reference. It does not persist a local blob URL, base64 audio, or an expiring storage URL. The existing resource association and language-aware lesson save flow link the upload to lesson content. The same node is registered in the editable and read-only rich-text schemas.

Media requests use the existing lesson-resource endpoint and its tenant, lesson access, visibility, and freemium/public-access rules. Audio does not make a private course or resource public. Seeking uses the existing authenticated resource streaming path and HTTP byte-range handling, rather than exposing private storage credentials.

Generic resource extraction and reference rewriting must preserve audio through duplication, course transfer, and native archive export/import. Audio is not a separate storage category or database schema.

## Browser compatibility

A file extension or MIME allowlist entry is **not** a guarantee of browser playback. The server must validate the actual container and codec; the browser still needs a decoder for that combination. MP3 and uncompressed 16-bit PCM WAV are the safest interchange choices. AAC in M4A/MP4 depends on browser/operating-system codec availability (especially Firefox/Linux). Ogg Vorbis/Opus and WebM Opus require a browser version with the relevant container and codec support; older Safari/iOS versions are not a safe target for every combination. Native volume controls and output-volume adjustment vary on mobile browsers.

No transcoding or alternate-format fallback is introduced. If a browser cannot decode an accepted file, the player reports a playback error; authors should provide an MP3 version for broad compatibility.

Compatibility references:

- [MDN: media container formats](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)
- [MDN: audio codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs)

## Accepted uploads and verification

The maximum audio upload is 200 MiB. The API probes the container and decodes the
uploaded bytes locally before storing them unchanged. Supported combinations are:
MP3; M4A/MP4 with AAC-LC; WAV with 16-bit PCM; Ogg Vorbis/Opus; and WebM Opus.
Raw AAC and containers containing video streams are rejected. Audio delivery
requires an authenticated, authorized user, including for freemium lessons.

The dedicated upload control is the supported audio upload entry point. The
resource picker can reuse stored audio, but its generic upload endpoint does not
accept audio files.

Executed verification:

- Chromium E2E: author creates a lesson in the UI, uploads the real 12-second WAV,
  saves, reloads and reopens the editor; a learner enrolls, plays with advancing
  `currentTime`, seeks and resumes; authenticated full and byte-range responses
  match the fixture exactly, including content/range headers.
- API: 61 focused tests passed across 11 suites, covering validation, upload,
  authorization, delivery, checksums, resource references, archive assets and MCP
  audio-node rendering.
- Web: 41 focused tests passed across six files.
- API and web TypeScript checks, touched-file ESLint, and both builds passed.

The browser run uses a task-owned API/web, PostgreSQL, Redis, filesystem-backed
S3-compatible storage and local mail capture. No live media or AI provider is
used. The deterministic fixture and regeneration instructions live under
`apps/web/e2e/data/test-data/audio/`. Browser playback on Firefox, Safari and mobile
has not been verified by this local run.
