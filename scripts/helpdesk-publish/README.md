# Helpdesk bundle publisher

This trusted publishing step consumes the reviewed tutorial bundle. It uses the
existing vendored `@mentingo/guide-sdk` for all Helpdesk JSON/control requests and
the existing `tus-js-client` for direct, streamed Bunny uploads. It installs no
additional dependencies and has no separate package or lockfile.

Run from the repository after the normal `pnpm install --frozen-lockfile`:

```sh
node scripts/helpdesk-publish/publisher.mjs \
  --bundle /path/to/reviewed-bundle \
  --state /path/to/private/publisher-state.json \
  --output /path/to/safe-publication-summary.json
```

Required environment:

- `GUIDE_API_URL`: the deployed Helpdesk HTTPS origin; loopback HTTP works locally.
- `GUIDE_PUBLISH_API_KEY`: the dedicated Helpdesk publisher key. Only this job
  receives it. Bunny library credentials and OpenAI credentials stay in Helpdesk.

The publisher resolves the Guide SDK through `apps/api/package.json` and TUS
through `apps/web/package.json`, so its versions follow the root lockfile and
vendored SDK already used by Core. Tests use the same SDK through an Axios adapter.

## Bundle contract

`manifest.json` has this shape. Each entry describes one combined feature-area
video in one language; its chapters represent independently recorded flows.

```json
{
  "schemaVersion": 1,
  "commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "version": "4.26.0",
  "workflowRunId": "123456",
  "domains": [
    {
      "key": "development-paths.overview",
      "language": "en",
      "metadata": "RevisionMetadata object from the generated Guide SDK",
      "video": "development-paths/en/video.mp4",
      "sha256": "64 lowercase hexadecimal characters",
      "sizeBytes": 123456
    }
  ]
}
```

The metadata uses the current Helpdesk OpenAPI contract, including the source
commit, recording workflow run ID, spec paths, version compatibility, domain,
language, title/description, tags and ordered chapters. Every chapter has a stable
ID, title, description, transcript and final `startMs`/`endMs`. Source commit and
workflow run ID must match the manifest. The publisher validates the entire
bundle, chapter bounds, plain paths, file sizes and streamed hashes before the
first network mutation. Symlinks and traversal are rejected. The upstream trusted
job must also check the artifact's recording workflow identity and source commit;
checksums alone do not establish that provenance.

## Lifecycle and recovery

For each entry, the publisher:

1. Creates a draft using the saved published predecessor and a deterministic
   idempotency key bound to the video hash and complete metadata.
2. Saves the starting edit version, prepares media, then polls its operation.
3. Gets a short-lived upload grant and streams 8 MiB chunks directly to Bunny.
4. Saves the starting finalization version, requests verification/indexing, and
   polls the durable finalization operation.
5. Explicitly publishes using the version returned by successful finalization.

The checkpoint is written atomically with mode `0600` before and after relevant
side effects. Lost creation/preparation/finalization responses replay the same
idempotency key and original version. Upload interruption resumes the saved TUS
resource and requests a refreshed grant for the same Bunny asset. TUS requests
are restricted to Bunny's official HTTPS upload endpoint and resource URLs.
Refreshing a grant does not extend an existing TUS resource's lifetime. If a
resume `HEAD` on the exact saved URL returns `404` or `410`, the publisher clears
and checkpoints that URL, then creates one fresh TUS resource for the **same**
unfinished video, draft and checksum-bound file. It permits this recovery once
per invocation. Other HEAD errors, PATCH failures and network failures preserve
the URL and stop. The TUS client's broader automatic restart behavior is disabled.
No replacement Bunny video or draft is allocated, and media can never be uploaded
again once finalization or publication has started.

The default deadline is 45 minutes (`--deadline-ms` changes it, up to six hours).
Exit status `75` means the deadline/cancellation left resumable work. The same
bundle and private checkpoint must be restored for the next invocation. Failed
operations remain failed unless the operator selects `--retry-failed`; this
requests at most one retry per operation per invocation, subject to the service's
own retry limits. A concurrent-predecessor conflict is never retried as a new
draft. Older version bundles cannot replace newer published guidance, and one
version cannot silently move to a different commit.

The workflow must checkpoint this private state on failure as well as success.
It must not publish an older failed run's checkpoint as the current generation
state. The state contains TUS resource URLs and is **not** a public Actions report.
It never stores the Helpdesk key, Bunny authorization headers or temporary grant.
Only the `--output` summary is intended for an ordinary workflow report.

Checkpoint shape (generation fields outside these keys are preserved):

```text
{
  schemaVersion: 1,
  publications: {
    [artifactIdentity]: {
      key, language, sha256, expectedPublishedRevisionId,
      draftId?, prepareVersion?, mediaOperationId?, videoId?,
      uploadUrl?, uploadComplete?, finalizeVersion?,
      finalizationOperationId?, publishVersion?, publishedRevisionId?
    }
  },
  published: {
    ["tutorial-key:language"]: { revisionId, artifactId, commit, version }
  }
}
```

## Validation

```sh
node --test scripts/helpdesk-publish/publisher.test.mjs
node scripts/helpdesk-publish/publisher.mjs --help
```

The deterministic tests cover integrity/provenance/path validation, complete
publication ordering, the actual vendored SDK's HTTP contract, lost responses,
interrupted/expired upload resumes, pending deadlines, explicit recoverable retries,
Retry-After, stale publication conflicts, older-version rejection, private state
permissions and Bunny upload URL/streaming limits. They make no provider calls.
