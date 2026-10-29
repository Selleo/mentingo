import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  bundlePath,
  bunnyUrl,
  canonicalJson,
  PublicationPendingError,
  publishBundle,
  readBundle,
  saveJson,
  uploadToBunny,
} from "./publisher.mjs";

const REVISION = "10000000-0000-4000-8000-000000000001";
const NEXT_REVISION = "10000000-0000-4000-8000-000000000002";
const MEDIA = "20000000-0000-4000-8000-000000000001";
const FINALIZE = "30000000-0000-4000-8000-000000000001";
const VIDEO = "40000000-0000-4000-8000-000000000001";
const COMMIT = "a".repeat(40);
const UPLOAD = "https://video.bunnycdn.com/tusupload/owned-resource";
const SECRET = "temporary-signature-never-in-checkpoint";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "helpdesk-publisher-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from("deterministic synthetic video bytes");
  writeFileSync(join(root, "video.mp4"), bytes);
  const metadata = {
    domain: "development-paths",
    language: "en",
    title: "Development paths",
    description: "Create and assign a path.",
    keywords: ["paths"],
    pageKeys: ["development-paths"],
    audiences: ["administrator"],
    featureRequirements: [],
    expectedDurationMs: 30_000,
    compatibility: { minVersionInclusive: "4.26.0", maxVersionExclusive: null },
    source: {
      commit: COMMIT,
      workflowRunId: "12345",
      specPaths: ["docs/specs/learning-paths-business-spec.md"],
    },
    chapters: [
      {
        id: "create-path",
        title: "Create a path",
        description: "Save a new path.",
        transcript: "Open paths and create a path.",
        startMs: 0,
        endMs: 30_000,
      },
    ],
  };
  const entry = {
    key: "development-paths.overview",
    language: "en",
    metadata,
    video: "video.mp4",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.length,
  };
  const manifest = {
    schemaVersion: 1,
    commit: COMMIT,
    version: "4.26.0",
    workflowRunId: "12345",
    domains: [entry],
  };
  const statePath = join(root, "private-state.json");
  const outputPath = join(root, "output.json");
  const write = () => writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  write();
  return {
    root,
    metadata,
    entry,
    manifest,
    statePath,
    outputPath,
    write,
    options: { bundle: root, statePath, outputPath },
  };
}

function stub() {
  const calls = [];
  const operation = (id, version = 2) => ({
    id,
    revisionId: REVISION,
    revisionVersion: version,
    status: "succeeded",
  });
  const methods = {
    createRevision: async () => ({ id: REVISION, version: 1 }),
    getRevision: async () => ({ id: REVISION, version: 2 }),
    prepareMedia: async () => operation(MEDIA),
    getOperation: async () => operation(MEDIA),
    retryOperation: async () => operation(MEDIA),
    createUploadAuthorization: async () => ({ headers: { secret: SECRET } }),
    finalizeRevision: async () => operation(FINALIZE, 3),
    getFinalizationOperation: async () => operation(FINALIZE, 3),
    retryFinalizationOperation: async () => operation(FINALIZE, 3),
    publishRevision: async () => ({ id: REVISION, version: 4, state: "published" }),
  };
  const publishing = Object.fromEntries(
    Object.keys(methods).map((name) => [
      name,
      async (...args) => {
        calls.push({ name, args });
        return methods[name](...args);
      },
    ]),
  );
  const upload = async ({ progress, save }) => {
    calls.push({ name: "upload", args: [] });
    progress.uploadUrl = UPLOAD;
    progress.uploadComplete = true;
    save();
  };
  return { client: { publishing }, methods, calls, upload, operation };
}

function progressOf(path) {
  const state = JSON.parse(readFileSync(path, "utf8"));
  return Object.values(state.publications)[0];
}

function grantFor(entry) {
  return {
    endpoint: "https://video.bunnycdn.com/tusupload",
    expectedSha256: entry.sha256,
    expectedSizeBytes: entry.sizeBytes,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    headers: {
      VideoId: VIDEO,
      LibraryId: "123",
      AuthorizationExpire: `${Math.floor(Date.now() / 1000) + 3600}`,
      AuthorizationSignature: "a".repeat(64),
    },
    metadata: { filetype: "video/mp4", title: "Tutorial" },
  };
}

test("validates the whole bundle before calls and hashes video without changing it", async (t) => {
  const f = fixture(t);
  const parsed = await readBundle(f.root);
  assert.equal(parsed.entries[0].slot, "development-paths.overview:en");
  assert.match(parsed.entries[0].identity, /^[a-f0-9]{64}$/);
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  f.entry.sha256 = "0".repeat(64);
  f.write();
  const s = stub();
  await assert.rejects(publishBundle({ ...f.options, ...s }), /integrity/);
  assert.equal(s.calls.length, 0);
});

test("isolated test bundles cannot enter the publishing lifecycle", async (t) => {
  const f = fixture(t);
  f.manifest.testMode = true;
  f.write();
  const s = stub();
  await assert.rejects(publishBundle({ ...f.options, ...s }), /cannot be published/);
  assert.equal(s.calls.length, 0);
});

test("rejects traversal, symlinks, duplicate tutorials and mismatched provenance", async (t) => {
  const f = fixture(t);
  assert.throws(() => bundlePath(f.root, "../video.mp4"), /path/);
  assert.throws(() => bundlePath(f.root, "/video.mp4"), /path/);
  symlinkSync(join(f.root, "video.mp4"), join(f.root, "linked.mp4"));
  assert.throws(() => bundlePath(f.root, "linked.mp4"), /symlink/);
  f.manifest.domains.push(f.entry);
  f.write();
  await assert.rejects(readBundle(f.root), /Duplicate/);
  f.manifest.domains.pop();
  f.metadata.source.commit = "b".repeat(40);
  f.write();
  await assert.rejects(readBundle(f.root), /provenance/);
});

test("rejects overlapping chapters and invalid or empty transcripts", async (t) => {
  const f = fixture(t);
  f.metadata.chapters.push({ ...f.metadata.chapters[0], id: "assign-path", startMs: 20_000 });
  f.write();
  await assert.rejects(readBundle(f.root), /timeline/);
  f.metadata.chapters.pop();
  f.metadata.chapters[0].transcript = "";
  f.write();
  await assert.rejects(readBundle(f.root), /text/);
});

test("publishes explicitly only after upload, verification and indexing; keeps secrets out of state/output", async (t) => {
  const f = fixture(t),
    s = stub();
  saveJson(f.statePath, { schemaVersion: 1, generation: { preserved: true } });
  const result = await publishBundle({ ...f.options, ...s });
  assert.equal(result.ok, true);
  assert.deepEqual(
    s.calls.map((call) => call.name),
    [
      "createRevision",
      "getRevision",
      "prepareMedia",
      "getOperation",
      "createUploadAuthorization",
      "upload",
      "getRevision",
      "finalizeRevision",
      "getFinalizationOperation",
      "publishRevision",
    ],
  );
  const create = s.calls[0];
  assert.equal(create.args[1].expectedPublishedRevisionId, null);
  assert.equal(s.calls.at(-1).args[1].expectedVersion, 3);
  const state = JSON.parse(readFileSync(f.statePath, "utf8"));
  assert.equal(state.generation.preserved, true);
  assert.equal(state.published["development-paths.overview:en"].revisionId, REVISION);
  assert.equal(statSync(f.statePath).mode & 0o777, 0o600);
  assert.ok(!readFileSync(f.statePath, "utf8").includes(SECRET));
  assert.ok(!readFileSync(f.outputPath, "utf8").includes(UPLOAD));
  s.calls.length = 0;
  const replay = await publishBundle({ ...f.options, ...s });
  assert.equal(replay.tutorials[0].status, "already-published");
  assert.equal(s.calls.length, 0);
});

test("replays lost preparation response with original idempotency key and edit version", async (t) => {
  const f = fixture(t),
    s = stub();
  s.methods.getRevision = async () => ({ id: REVISION, version: 1 });
  s.methods.prepareMedia = async () => {
    throw new Error("response lost");
  };
  await assert.rejects(publishBundle({ ...f.options, ...s }), /response lost/);
  const first = s.calls.find((call) => call.name === "prepareMedia");
  assert.equal(progressOf(f.statePath).prepareVersion, 1);
  s.methods.getRevision = async () => ({ id: REVISION, version: 2 });
  s.methods.prepareMedia = async () => s.operation(MEDIA);
  s.calls.length = 0;
  await publishBundle({ ...f.options, ...s });
  const retry = s.calls.find((call) => call.name === "prepareMedia");
  assert.equal(retry.args[2].expectedVersion, first.args[2].expectedVersion);
  assert.equal(retry.args[2].idempotencyKey, first.args[2].idempotencyKey);
  assert.equal(s.calls.filter((call) => call.name === "createRevision").length, 0);
});

test("replays lost finalization response with frozen version and never repeats upload", async (t) => {
  const f = fixture(t),
    s = stub();
  s.methods.finalizeRevision = async () => {
    throw new Error("response lost");
  };
  await assert.rejects(publishBundle({ ...f.options, ...s }), /response lost/);
  const first = s.calls.find((call) => call.name === "finalizeRevision");
  s.methods.getRevision = async () => ({ id: REVISION, version: 3 });
  s.methods.finalizeRevision = async () => s.operation(FINALIZE, 3);
  s.calls.length = 0;
  await publishBundle({ ...f.options, ...s });
  const replay = s.calls.find((call) => call.name === "finalizeRevision");
  assert.equal(replay.args[1].expectedVersion, first.args[1].expectedVersion);
  assert.equal(replay.args[1].idempotencyKey, first.args[1].idempotencyKey);
  assert.ok(!s.calls.some((call) => ["upload", "createUploadAuthorization"].includes(call.name)));
});

test("resumes interrupted TUS upload on the same draft, asset and URL", async (t) => {
  const f = fixture(t),
    s = stub();
  const originalUpload = s.upload;
  s.upload = async ({ progress, save }) => {
    progress.uploadUrl = UPLOAD;
    save();
    throw new Error("interrupted");
  };
  await assert.rejects(publishBundle({ ...f.options, ...s }), /interrupted/);
  assert.equal(progressOf(f.statePath).uploadUrl, UPLOAD);
  s.upload = async (args) => {
    assert.equal(args.progress.uploadUrl, UPLOAD);
    await originalUpload(args);
  };
  s.calls.length = 0;
  await publishBundle({ ...f.options, ...s });
  assert.ok(!s.calls.some((call) => ["createRevision", "prepareMedia"].includes(call.name)));
  assert.equal(s.calls.filter((call) => call.name === "createUploadAuthorization").length, 1);
});

test("bounded finalization deadline produces resumable private checkpoint, never publication", async (t) => {
  const f = fixture(t),
    s = stub();
  let now = 0;
  s.methods.getFinalizationOperation = async () => ({
    ...s.operation(FINALIZE, 3),
    status: "running",
  });
  await assert.rejects(
    publishBundle({
      ...f.options,
      ...s,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
      deadlineMs: 12_000,
    }),
    PublicationPendingError,
  );
  assert.equal(progressOf(f.statePath).finalizationOperationId, FINALIZE);
  assert.equal(JSON.parse(readFileSync(f.outputPath, "utf8")).pending, true);
  assert.ok(!s.calls.some((call) => call.name === "publishRevision"));
  s.methods.getFinalizationOperation = async () => s.operation(FINALIZE, 3);
  s.calls.length = 0;
  await publishBundle({ ...f.options, ...s });
  assert.ok(!s.calls.some((call) => ["upload", "finalizeRevision"].includes(call.name)));
});

test("processing failure remains private; retry must be explicit and is bounded", async (t) => {
  const f = fixture(t),
    s = stub();
  s.methods.getFinalizationOperation = async () => ({
    ...s.operation(FINALIZE, 3),
    status: "failed",
    retryable: true,
  });
  await assert.rejects(publishBundle({ ...f.options, ...s }), /processing failed/);
  assert.ok(
    !s.calls.some((call) => ["publishRevision", "retryFinalizationOperation"].includes(call.name)),
  );
  s.calls.length = 0;
  await assert.rejects(
    publishBundle({ ...f.options, ...s, retryFailed: true }),
    /processing failed/,
  );
  assert.equal(s.calls.filter((call) => call.name === "retryFinalizationOperation").length, 1);
  assert.ok(!s.calls.some((call) => call.name === "publishRevision"));
});

test("polling honors Retry-After for retryable service capacity errors", async (t) => {
  const f = fixture(t),
    s = stub();
  let now = 0,
    failed = false;
  const waits = [];
  s.methods.getFinalizationOperation = async () => {
    if (!failed) {
      failed = true;
      throw { status: 429, retryable: true, retryAfter: "12" };
    }
    return s.operation(FINALIZE, 3);
  };
  await publishBundle({
    ...f.options,
    ...s,
    now: () => now,
    sleep: async (ms) => {
      waits.push(ms);
      now += ms;
    },
    deadlineMs: 30_000,
  });
  assert.deepEqual(waits, [12_000]);
});

test("successor uses trusted predecessor and refuses older versions", async (t) => {
  const f = fixture(t),
    s = stub();
  saveJson(f.statePath, {
    schemaVersion: 1,
    published: {
      "development-paths.overview:en": {
        revisionId: NEXT_REVISION,
        artifactId: "old",
        commit: COMMIT,
        version: "4.25.0",
      },
    },
    publications: {},
  });
  await publishBundle({ ...f.options, ...s });
  assert.equal(s.calls[0].args[1].expectedPublishedRevisionId, NEXT_REVISION);
  f.manifest.version = "4.24.0";
  f.write();
  s.calls.length = 0;
  await assert.rejects(publishBundle({ ...f.options, ...s }), /older version/);
  assert.equal(s.calls.length, 0);
});

test("conflict does not get retried or overwrite the published predecessor", async (t) => {
  const f = fixture(t),
    s = stub();
  s.methods.publishRevision = async () => {
    throw { status: 409, code: "conflict", retryable: false };
  };
  await assert.rejects(publishBundle({ ...f.options, ...s }));
  assert.equal(s.calls.filter((call) => call.name === "publishRevision").length, 1);
  assert.deepEqual(JSON.parse(readFileSync(f.statePath, "utf8")).published, {});
  assert.equal(progressOf(f.statePath).publishVersion, 3);
});

test("Bunny URL validation refuses foreign origins, redirect destinations and unsafe resource paths", () => {
  assert.equal(bunnyUrl(UPLOAD, false), UPLOAD);
  for (const url of [
    "https://evil.test/tusupload/owned",
    "http://video.bunnycdn.com/tusupload/owned",
    "https://video.bunnycdn.com/tusupload/../secrets",
    "https://video.bunnycdn.com/tusupload/id?key=secret",
    "https://video.bunnycdn.com/tusupload/id#fragment",
    "https://user:pass@video.bunnycdn.com/tusupload/id",
  ]) {
    assert.throws(() => bunnyUrl(url, false), /Bunny/);
  }
});

test("TUS adapter validates fresh grant, persists URL before bytes, and uses bounded chunks without retries", async (t) => {
  const f = fixture(t);
  const progress = {};
  const snapshots = [];
  let options;
  class Upload {
    constructor(file, value) {
      assert.equal(file.path, join(f.root, "video.mp4"));
      options = value;
      this.url = UPLOAD;
    }
    start() {
      options.onBeforeRequest({ getURL: () => UPLOAD });
      options.onUploadUrlAvailable();
      options.onSuccess();
    }
    abort() {
      return Promise.resolve();
    }
  }
  const grant = {
    endpoint: "https://video.bunnycdn.com/tusupload",
    expectedSha256: f.entry.sha256,
    expectedSizeBytes: f.entry.sizeBytes,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    headers: {
      VideoId: VIDEO,
      LibraryId: "123",
      AuthorizationExpire: `${Math.floor(Date.now() / 1000) + 3600}`,
      AuthorizationSignature: "a".repeat(64),
    },
    metadata: { filetype: "video/mp4", title: "Tutorial" },
  };
  await uploadToBunny({
    entry: { ...f.entry, path: join(f.root, "video.mp4") },
    grant,
    progress,
    save: () => snapshots.push(structuredClone(progress)),
    deadline: Date.now() + 5_000,
    Upload,
  });
  assert.equal(progress.uploadComplete, true);
  assert.ok(snapshots.some((value) => value.uploadUrl === UPLOAD && !value.uploadComplete));
  assert.equal(options.chunkSize, 8 * 1024 * 1024);
  assert.equal(options.retryDelays, null);
  assert.equal(options.storeFingerprintForResuming, false);
  assert.throws(
    () => options.onBeforeRequest({ getURL: () => "https://evil.test/tusupload" }),
    /Bunny/,
  );
  assert.ok(!JSON.stringify(snapshots).includes(grant.headers.AuthorizationSignature));
  await assert.rejects(
    uploadToBunny({
      entry: { ...f.entry, path: join(f.root, "video.mp4") },
      grant: { ...grant, expectedSha256: "0".repeat(64) },
      progress,
      save: () => {},
      deadline: Date.now() + 5_000,
      Upload,
    }),
    /grant/,
  );
});

test("checkpoint replaces permissive file with private mode", (t) => {
  const f = fixture(t);
  writeFileSync(f.statePath, "{}");
  chmodSync(f.statePath, 0o644);
  saveJson(f.statePath, { schemaVersion: 1 });
  assert.equal(statSync(f.statePath).mode & 0o777, 0o600);
});

test("expired resume HEAD 404/410 restarts only the TUS resource on the same unfinished Bunny video", async (t) => {
  for (const status of [404, 410]) {
    const f = fixture(t),
      progress = { videoId: VIDEO, uploadUrl: UPLOAD, draftId: REVISION };
    const snapshots = [],
      attempts = [];
    const fresh = `${UPLOAD}-replacement`;
    class Upload {
      constructor(_file, options) {
        this.options = options;
        attempts.push(options);
        this.url = fresh;
      }
      start() {
        if (this.options.uploadUrl) {
          assert.equal(
            this.options.endpoint,
            null,
            "Disable tus-js-client's broad automatic restart policy",
          );
          this.options.onError({
            originalRequest: { getMethod: () => "HEAD", getURL: () => UPLOAD },
            originalResponse: { getStatus: () => status },
          });
        } else {
          assert.equal(this.options.endpoint, "https://video.bunnycdn.com/tusupload");
          this.options.onUploadUrlAvailable();
          this.options.onSuccess();
        }
      }
      abort() {
        return Promise.resolve();
      }
    }
    const grant = grantFor(f.entry);
    await uploadToBunny({
      entry: { ...f.entry, path: join(f.root, "video.mp4") },
      grant,
      progress,
      save: () => snapshots.push(structuredClone(progress)),
      deadline: Date.now() + 5_000,
      Upload,
    });
    assert.equal(attempts.length, 2);
    assert.equal(progress.draftId, REVISION);
    assert.equal(progress.videoId, VIDEO);
    assert.equal(progress.uploadUrl, fresh);
    assert.equal(progress.uploadComplete, true);
    assert.ok(snapshots.some((value) => !value.uploadUrl && !value.uploadComplete));
    assert.deepEqual(attempts[0].headers, attempts[1].headers);
    assert.equal(attempts[0].uploadSize, attempts[1].uploadSize);
  }
});

test("network/HEAD503/PATCH404 failures preserve the saved resource and never restart", async (t) => {
  for (const [method, status] of [
    ["HEAD", null],
    ["HEAD", 503],
    ["PATCH", 404],
    ["PATCH", 410],
  ]) {
    const f = fixture(t),
      progress = { videoId: VIDEO, uploadUrl: UPLOAD };
    let attempts = 0;
    class Upload {
      constructor(_file, options) {
        this.options = options;
        attempts += 1;
      }
      start() {
        this.options.onError({
          originalRequest: { getMethod: () => method, getURL: () => UPLOAD },
          originalResponse: status === null ? null : { getStatus: () => status },
        });
      }
      abort() {
        return Promise.resolve();
      }
    }
    await assert.rejects(
      uploadToBunny({
        entry: { ...f.entry, path: join(f.root, "video.mp4") },
        grant: grantFor(f.entry),
        progress,
        save: () => {},
        deadline: Date.now() + 5_000,
        Upload,
      }),
      /Direct Bunny upload failed/,
    );
    assert.equal(attempts, 1);
    assert.equal(progress.uploadUrl, UPLOAD);
    assert.ok(!progress.uploadComplete);
  }
});

test("fresh resource attempt is bounded and no media is reuploaded after finalization starts", async (t) => {
  const f = fixture(t);
  let attempts = 0;
  class Upload {
    constructor(_file, options) {
      this.options = options;
      attempts += 1;
      this.url = `${UPLOAD}-replacement`;
    }
    start() {
      const resumed = Boolean(this.options.uploadUrl);
      if (!resumed) this.options.onUploadUrlAvailable();
      this.options.onError({
        originalRequest: {
          getMethod: () => (resumed ? "HEAD" : "PATCH"),
          getURL: () => (resumed ? UPLOAD : this.url),
        },
        originalResponse: { getStatus: () => 404 },
      });
    }
    abort() {
      return Promise.resolve();
    }
  }
  const options = {
    entry: { ...f.entry, path: join(f.root, "video.mp4") },
    grant: grantFor(f.entry),
    save: () => {},
    deadline: Date.now() + 5_000,
    Upload,
  };
  const progress = { videoId: VIDEO, uploadUrl: UPLOAD };
  await assert.rejects(uploadToBunny({ ...options, progress }), /Direct Bunny upload failed/);
  assert.equal(attempts, 2);
  assert.equal(progress.uploadUrl, `${UPLOAD}-replacement`);
  for (const flag of [
    { uploadComplete: true },
    { finalizeVersion: 3 },
    { finalizationOperationId: FINALIZE },
    { publishedRevisionId: REVISION },
  ]) {
    attempts = 0;
    await assert.rejects(
      uploadToBunny({ ...options, progress: { videoId: VIDEO, uploadUrl: UPLOAD, ...flag } }),
      /after finalization/,
    );
    assert.equal(attempts, 0);
  }
});

test("real vendored Guide SDK emits authenticated JSON controls and exact edit/idempotency headers", async (t) => {
  const f = fixture(t);
  const apiRequire = createRequire(new URL("../../apps/api/package.json", import.meta.url));
  const { createGuideClient } = apiRequire("@mentingo/guide-sdk");
  const key = "publisher-test-key-not-a-real-secret-123456";
  const wire = [];
  const adapter = async (config) => {
    assert.equal(config.headers.Authorization, `Bearer ${key}`);
    assert.ok(!config.data || typeof config.data === "string");
    assert.equal(config.maxRedirects, 0);
    assert.ok(config.url.startsWith("/api/v1/admin/"));
    wire.push(config);
    let data;
    if (config.url.endsWith("/revisions")) data = { id: REVISION, version: 1 };
    else if (config.url.endsWith("/media") || config.url.includes(`/operations/${MEDIA}`))
      data = { id: MEDIA, revisionId: REVISION, revisionVersion: 2, status: "succeeded" };
    else if (
      config.url.endsWith("/finalize") ||
      config.url.includes(`/finalization-operations/${FINALIZE}`)
    )
      data = { id: FINALIZE, revisionId: REVISION, revisionVersion: 3, status: "succeeded" };
    else if (config.url.endsWith("/upload-authorizations")) data = { temporary: "grant" };
    else if (config.url.endsWith("/publish"))
      data = { id: REVISION, state: "published", version: 4 };
    else data = { id: REVISION, version: 2 };
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  const client = createGuideClient({ baseURL: "https://help.example.test", apiKey: key, adapter });
  const upload = async ({ progress, save }) => {
    progress.uploadComplete = true;
    save();
  };
  await publishBundle({ ...f.options, client, upload });
  assert.equal(wire.length, 9);
  const creation = wire.find((request) => request.url.endsWith("/revisions"));
  const media = wire.find((request) => request.url.endsWith("/media"));
  const finalization = wire.find((request) => request.url.endsWith("/finalize"));
  const publication = wire.find((request) => request.url.endsWith("/publish"));
  assert.match(creation.headers["Idempotency-Key"], /^helpdesk-[a-f0-9]{64}-draft$/);
  assert.equal(media.headers["If-Match"], '"2"');
  assert.equal(finalization.headers["If-Match"], '"2"');
  assert.equal(publication.headers["If-Match"], '"3"');
  assert.equal(JSON.parse(media.data).contentType, "video/mp4");
  assert.ok(!readFileSync(f.statePath, "utf8").includes(key));
});
