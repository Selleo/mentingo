# Locally installed Guide SDK

Core consumes a portable client-only package built from `mentingo-plugins/packages/guide`.
The relative `file:` dependency in `apps/api/package.json` works after a fresh checkout;
it does not depend on a developer's plugins checkout. The source commit, exact artifact
name and SHA256 are recorded in `mentingo-guide-sdk.json`. This is a local installation,
not an npm publication.

To replace it after changing the authoritative Rust OpenAPI contract or SDK:

1. In the plugins worktree, regenerate OpenAPI and the SDK through its documented
   scripts, run SDK typechecking/tests, and commit the source.
2. From `packages/guide`, run `pnpm pack --pack-destination /tmp/guide-sdk`.
   The package's `prepack` verifies its build and tests. Inspect the tarball contents;
   it must contain only the public client, types, package metadata and documentation.
3. Copy it here using a filename containing the version and SHA256 prefix. Update
   `mentingo-guide-sdk.json`, the API's relative dependency and `pnpm-lock.yaml` with
   `pnpm install --filter api`. Remove only the superseded SDK artifact.
4. Run the Core Helpdesk/MCP tests. For Core relay contract changes, run
   `pnpm --filter api helpdesk:generate-schema` and `pnpm --filter web generate:client`.

Use the repository's Node/pnpm versions. No publishing key is required by Core's
read-only SDK provider. The trusted video-generation workflow will use the SDK's
publishing surface separately; video bytes upload directly to Bunny.
