#!/usr/bin/env node
/**
 * Publish a checksummed tutorial bundle using the generated Guide SDK. Checkpoint
 * every side effect before advancing; process interruption never creates a new
 * draft, asset or finalization identity. Video bytes go directly to Bunny TUS.
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { setTimeout as sleepTimer } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const KEY = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const DOMAINS = new Set(["development-paths", "course-authoring", "course-learning"]);
const BUNNY_TUS = "https://video.bunnycdn.com/tusupload";
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 5 * 1024 ** 3;
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_DEADLINE_MS = 45 * 60_000;
const STATUS = Object.freeze({
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
});

/** A deadline preserves the checkpoint for a later publishing invocation. */
export class PublicationPendingError extends Error {
  constructor() {
    super("Publication is still pending; resume with the same bundle and state.");
    this.name = "PublicationPendingError";
  }
}

/** Local validation errors contain fixed messages, never provider responses. */
export class PublisherInputError extends Error {}

function check(condition, message) {
  if (!condition) throw new PublisherInputError(message);
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value, max) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value) <= max
  );
}

function textList(values, maxCount = 64) {
  return (
    Array.isArray(values) &&
    values.length <= maxCount &&
    values.every((value) => text(value, 200)) &&
    new Set(values).size === values.length
  );
}

function integer(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function validVersion(value) {
  if (typeof value !== "string") return false;
  const parsed = VERSION.exec(value);
  return (
    parsed !== null &&
    (!parsed[4] ||
      parsed[4]
        .split(".")
        .every(
          (part) =>
            part.length > 0 && (!/^\d+$/.test(part) || part.length === 1 || !part.startsWith("0")),
        ))
  );
}

/** Reject traversal and symlink components before reading any bundle artifact. */
export function bundlePath(root, name) {
  check(
    typeof name === "string" && name.length > 0 && !name.includes("\\") && !isAbsolute(name),
    "Invalid bundle path.",
  );
  const parts = name.split("/");
  check(
    parts.every((part) => part !== "" && part !== "." && part !== ".."),
    "Invalid bundle path.",
  );
  let current = resolve(root);
  check(
    lstatSync(current).isDirectory() && !lstatSync(current).isSymbolicLink(),
    "Bundle must be a plain directory.",
  );
  for (const part of parts) {
    current = resolve(current, part);
    const stat = lstatSync(current);
    check(!stat.isSymbolicLink(), "Bundle symlinks are not allowed.");
  }
  const inside = relative(resolve(root), current);
  check(
    inside !== ".." && !inside.startsWith(`..${sep}`) && lstatSync(current).isFile(),
    "Invalid bundle artifact.",
  );
  return current;
}

function loadJson(path, fallback) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw new Error("Required JSON file is unavailable.");
  }
  check(
    stat.isFile() && !stat.isSymbolicLink() && stat.size <= MAX_JSON_BYTES,
    "Invalid JSON file.",
  );
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("Invalid JSON document.");
  }
}

/** Atomic private checkpoint; never include API keys or temporary Bunny headers. */
export function saveJson(path, value) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const temporary = `${resolve(path)}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "w" });
  renameSync(temporary, resolve(path));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateMetadata(metadata, manifest, entry) {
  check(
    object(metadata) && Buffer.byteLength(JSON.stringify(metadata)) <= 2 * 1024 * 1024,
    "Invalid tutorial metadata.",
  );
  check(
    DOMAINS.has(metadata.domain) && metadata.language === entry.language,
    "Invalid tutorial domain or language.",
  );
  let language;
  try {
    [language] = Intl.getCanonicalLocales(entry.language);
  } catch {
    throw new Error("Invalid tutorial language.");
  }
  check(language === entry.language, "Tutorial language must be canonical.");
  check(
    text(metadata.title, 200) && text(metadata.description, 8_000),
    "Invalid tutorial title or description.",
  );
  check(
    ["keywords", "pageKeys", "audiences", "featureRequirements"].every((field) =>
      textList(metadata[field]),
    ),
    "Invalid tutorial tags.",
  );
  check(integer(metadata.expectedDurationMs, 1, 86_400_000), "Invalid tutorial duration.");
  check(
    object(metadata.compatibility) &&
      validVersion(metadata.compatibility.minVersionInclusive) &&
      (metadata.compatibility.maxVersionExclusive == null ||
        validVersion(metadata.compatibility.maxVersionExclusive)),
    "Invalid tutorial compatibility.",
  );
  check(
    metadata.compatibility.maxVersionExclusive == null ||
      compareVersion(
        metadata.compatibility.minVersionInclusive,
        metadata.compatibility.maxVersionExclusive,
      ) < 0,
    "Invalid tutorial compatibility interval.",
  );
  const source = metadata.source;
  check(
    object(source) &&
      source.commit === manifest.commit &&
      source.workflowRunId === manifest.workflowRunId,
    "Tutorial provenance does not match the bundle.",
  );
  check(
    Array.isArray(source.specPaths) &&
      source.specPaths.length > 0 &&
      source.specPaths.length <= 64 &&
      source.specPaths.every(
        (path) =>
          text(path, 500) &&
          path.startsWith("docs/") &&
          !path.includes("\\") &&
          path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
      ),
    "Invalid source spec paths.",
  );
  check(
    Array.isArray(metadata.chapters) &&
      metadata.chapters.length > 0 &&
      metadata.chapters.length <= 100,
    "Invalid tutorial chapters.",
  );
  const ids = new Set();
  let previousEnd = 0;
  for (const chapter of metadata.chapters) {
    check(
      object(chapter) && KEY.test(chapter.id) && !ids.has(chapter.id),
      "Invalid chapter identity.",
    );
    check(
      text(chapter.title, 200) &&
        text(chapter.description, 4_000) &&
        text(chapter.transcript, 10_000),
      "Invalid chapter text.",
    );
    check(
      integer(chapter.startMs, previousEnd, metadata.expectedDurationMs - 1) &&
        integer(chapter.endMs, chapter.startMs + 1, metadata.expectedDurationMs),
      "Invalid chapter timeline.",
    );
    ids.add(chapter.id);
    previousEnd = chapter.endMs;
  }
}

async function fileHash(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** Validate the complete batch before the first network mutation. */
export async function readBundle(root) {
  const manifest = loadJson(bundlePath(root, "manifest.json"));
  check(manifest?.testMode !== true, "Test video bundles cannot be published.");
  check(
    object(manifest) &&
      manifest.schemaVersion === 1 &&
      COMMIT.test(manifest.commit) &&
      validVersion(manifest.version) &&
      typeof manifest.workflowRunId === "string" &&
      /^\d{1,32}$/.test(manifest.workflowRunId),
    "Invalid bundle identity.",
  );
  check(
    Array.isArray(manifest.domains) &&
      manifest.domains.length > 0 &&
      manifest.domains.length <= 100,
    "Invalid bundle domains.",
  );
  const slots = new Set();
  const entries = [];
  for (const entry of manifest.domains) {
    check(
      object(entry) &&
        KEY.test(entry.key) &&
        text(entry.language, 35) &&
        SHA256.test(entry.sha256) &&
        integer(entry.sizeBytes, 1, MAX_VIDEO_BYTES),
      "Invalid bundle entry.",
    );
    const slot = `${entry.key}:${entry.language}`;
    check(!slots.has(slot), "Duplicate tutorial and language.");
    slots.add(slot);
    validateMetadata(entry.metadata, manifest, entry);
    const path = bundlePath(root, entry.video);
    check(
      lstatSync(path).size === entry.sizeBytes && (await fileHash(path)) === entry.sha256,
      "Video integrity check failed.",
    );
    const identity = digest(
      canonicalJson({
        key: entry.key,
        language: entry.language,
        sha256: entry.sha256,
        metadata: entry.metadata,
      }),
    );
    entries.push({ ...entry, path, slot, identity });
  }
  return { manifest, entries };
}

function stateFile(path) {
  const state = loadJson(path, { schemaVersion: 1, publications: {}, published: {} });
  check(object(state) && state.schemaVersion === 1, "Invalid publishing checkpoint.");
  state.publications ??= {};
  state.published ??= {};
  check(object(state.publications) && object(state.published), "Invalid publishing checkpoint.");
  return state;
}

function validId(value) {
  return typeof value === "string" && UUID.test(value);
}

/** Validate every Bunny request, including a resumed URL or server Location. */
export function bunnyUrl(value, allowEndpoint = true) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid Bunny upload URL.");
  }
  check(
    url.origin === "https://video.bunnycdn.com" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ((allowEndpoint && url.pathname === "/tusupload") ||
        /^\/tusupload\/[A-Za-z0-9._~-]+$/.test(url.pathname)),
    "Unexpected Bunny upload URL.",
  );
  return url.href;
}

function validateGrant(grant, entry) {
  check(
    object(grant) &&
      grant.endpoint === BUNNY_TUS &&
      grant.expectedSha256 === entry.sha256 &&
      grant.expectedSizeBytes === entry.sizeBytes &&
      object(grant.headers) &&
      object(grant.metadata),
    "Invalid Bunny upload grant.",
  );
  check(
    validId(grant.headers.VideoId) &&
      /^\d{1,20}$/.test(grant.headers.LibraryId) &&
      /^\d{1,20}$/.test(grant.headers.AuthorizationExpire) &&
      /^[a-f0-9]{64}$/i.test(grant.headers.AuthorizationSignature) &&
      grant.metadata.filetype === "video/mp4" &&
      text(grant.metadata.title, 500),
    "Invalid Bunny upload grant.",
  );
  check(
    integer(grant.expiresAt, 1, Number.MAX_SAFE_INTEGER) && grant.expiresAt * 1000 > Date.now(),
    "Bunny upload authorization expired.",
  );
}

class ExpiredUploadResourceError extends Error {}

function expiredResumeHead(error, resumeUrl) {
  try {
    return (
      resumeUrl &&
      error.originalRequest?.getMethod() === "HEAD" &&
      error.originalRequest.getURL() === resumeUrl &&
      [404, 410].includes(error.originalResponse?.getStatus())
    );
  } catch {
    return false;
  }
}

/** Stream bounded chunks; only an expired resume HEAD permits one fresh resource. */
export async function uploadToBunny(args) {
  const { entry, grant, progress, save, deadline, signal } = args;
  validateGrant(grant, entry);
  check(
    !progress.uploadComplete &&
      !["finalizeVersion", "finalizationOperationId", "publishVersion", "publishedRevisionId"].some(
        (field) => Object.hasOwn(progress, field),
      ),
    "Cannot upload media after finalization or publication has started.",
  );
  if (progress.videoId)
    check(progress.videoId === grant.headers.VideoId, "Bunny asset identity changed.");
  progress.videoId = grant.headers.VideoId;
  if (progress.uploadUrl) bunnyUrl(progress.uploadUrl, false);
  save();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (signal?.aborted || Date.now() >= deadline) throw new PublicationPendingError();
    try {
      await streamUpload(args);
      return;
    } catch (error) {
      if (!(error instanceof ExpiredUploadResourceError) || attempt !== 0) throw error;
      // The grant still identifies the same unfinished video and checksum-bound
      // file. Persist removal before creating a replacement TUS resource only.
      delete progress.uploadUrl;
      save();
    }
  }
}

async function streamUpload({ entry, grant, progress, save, deadline, signal, Upload }) {
  const resumeUrl = progress.uploadUrl ?? null;
  const file = createReadStream(entry.path);
  await new Promise((accept, reject) => {
    let settled = false;
    let upload;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      file.destroy();
      if (error) reject(error);
      else accept();
    };
    const cancel = () => {
      void upload?.abort(false).catch(() => {});
      finish(new PublicationPendingError());
    };
    const timer = setTimeout(cancel, Math.max(1, deadline - Date.now()));
    signal?.addEventListener("abort", cancel, { once: true });
    file.on("error", () => finish(new Error("Video became unreadable during upload.")));
    const options = {
      // tus-js-client otherwise silently creates another resource after ANY
      // unsuccessful resume HEAD. Recovery policy belongs to this orchestrator.
      endpoint: resumeUrl ? null : grant.endpoint,
      uploadUrl: resumeUrl,
      uploadSize: entry.sizeBytes,
      headers: grant.headers,
      metadata: grant.metadata,
      chunkSize: 8 * 1024 * 1024,
      retryDelays: null,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: false,
      onBeforeRequest: (request) => {
        bunnyUrl(request.getURL());
      },
      onUploadUrlAvailable: () => {
        try {
          progress.uploadUrl = bunnyUrl(upload.url, false);
          save();
        } catch {
          cancel();
        }
      },
      onError: (error) =>
        finish(
          expiredResumeHead(error, resumeUrl)
            ? new ExpiredUploadResourceError("Bunny TUS resource expired.")
            : new Error("Direct Bunny upload failed; resume the same checkpoint."),
        ),
      onSuccess: () => {
        try {
          progress.uploadComplete = true;
          save();
          finish();
        } catch {
          finish(new Error("Unable to checkpoint the completed upload."));
        }
      },
    };
    try {
      upload = new Upload(file, options);
      if (signal?.aborted) cancel();
      else upload.start();
    } catch {
      finish(new Error("Unable to start the direct Bunny upload."));
    }
  });
}

function compareVersion(left, right) {
  const a = VERSION.exec(left),
    b = VERSION.exec(right);
  check(a && b, "Invalid publishing version.");
  for (let index = 1; index <= 3; index += 1) {
    const difference = BigInt(a[index]) - BigInt(b[index]);
    if (difference !== 0n) return difference < 0n ? -1 : 1;
  }
  if (a[4] === b[4]) return 0;
  if (!a[4]) return 1;
  if (!b[4]) return -1;
  const leftParts = a[4].split("."),
    rightParts = b[4].split(".");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    if (leftParts[index] === rightParts[index]) continue;
    if (leftParts[index] === undefined) return -1;
    if (rightParts[index] === undefined) return 1;
    const numberA = /^\d+$/.test(leftParts[index]),
      numberB = /^\d+$/.test(rightParts[index]);
    if (numberA && numberB) return BigInt(leftParts[index]) < BigInt(rightParts[index]) ? -1 : 1;
    if (numberA !== numberB) return numberA ? -1 : 1;
    return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}

function retryDelay(error, now) {
  if (typeof error?.retryAfter === "string") {
    const seconds = Number(error.retryAfter);
    if (/^\d+$/.test(error.retryAfter) && Number.isSafeInteger(seconds))
      return Math.max(POLL_INTERVAL_MS, seconds * 1000);
    const date = Date.parse(error.retryAfter);
    if (Number.isFinite(date)) return Math.max(POLL_INTERVAL_MS, date - now);
  }
  return POLL_INTERVAL_MS;
}

/**
 * Injectable SDK/clock/upload boundary keeps lifecycle tests deterministic. The
 * SDK performs all JSON/control requests; only its temporary grant reaches TUS.
 */
export async function publishBundle({
  bundle,
  statePath,
  outputPath,
  client,
  upload,
  now = Date.now,
  sleep,
  deadlineMs = DEFAULT_DEADLINE_MS,
  retryFailed = false,
  signal,
}) {
  check(integer(deadlineMs, 1, 6 * 60 * 60_000), "Invalid publication deadline.");
  const { manifest, entries } = await readBundle(bundle);
  const state = stateFile(statePath);
  const deadline = now() + deadlineMs;
  const results = [];
  const save = () => saveJson(statePath, state);
  const available = () => {
    if (signal?.aborted || now() >= deadline) throw new PublicationPendingError();
  };
  const requestOptions = () => {
    available();
    return { signal };
  };
  async function delay(ms) {
    available();
    if (now() + ms >= deadline) throw new PublicationPendingError();
    try {
      if (sleep) await sleep(ms);
      else await sleepTimer(ms, undefined, { signal });
    } catch (error) {
      if (signal?.aborted) throw new PublicationPendingError();
      throw error;
    }
    available();
  }
  async function poll(id, revisionId, read, retry) {
    let retried = false;
    while (true) {
      available();
      let operation;
      try {
        operation = await read(id, requestOptions());
      } catch (error) {
        if (error?.retryable && [429, 502, 503, 504].includes(error.status)) {
          await delay(retryDelay(error, now()));
          continue;
        }
        throw error;
      }
      check(
        object(operation) &&
          operation.id === id &&
          operation.revisionId === revisionId &&
          integer(operation.revisionVersion, 1, Number.MAX_SAFE_INTEGER),
        "Invalid Helpdesk operation.",
      );
      if (operation.status === STATUS.succeeded) return operation;
      if (operation.status === STATUS.failed) {
        if (retryFailed && !retried && operation.retryable && retry) {
          await retry(id, requestOptions());
          retried = true;
          continue;
        }
        throw new Error(
          "Helpdesk processing failed. Inspect the operation; retry only recoverable failures.",
        );
      }
      check(
        [STATUS.queued, STATUS.running].includes(operation.status),
        "Invalid Helpdesk operation status.",
      );
      await delay(POLL_INTERVAL_MS);
    }
  }
  try {
    for (const entry of entries) {
      available();
      const previous = state.published[entry.slot];
      if (previous) {
        check(
          object(previous) &&
            validId(previous.revisionId) &&
            validVersion(previous.version) &&
            COMMIT.test(previous.commit),
          "Invalid published predecessor.",
        );
        check(
          compareVersion(manifest.version, previous.version) >= 0,
          "Refusing to replace guidance with an older version.",
        );
        check(
          manifest.version !== previous.version || manifest.commit === previous.commit,
          "A published version cannot move to another commit.",
        );
      }
      let progress = state.publications[entry.identity];
      if (!progress) {
        progress = {
          key: entry.key,
          language: entry.language,
          sha256: entry.sha256,
          expectedPublishedRevisionId: previous?.revisionId ?? null,
        };
        state.publications[entry.identity] = progress;
        save();
      }
      check(
        object(progress) &&
          progress.key === entry.key &&
          progress.language === entry.language &&
          progress.sha256 === entry.sha256 &&
          (progress.expectedPublishedRevisionId === null ||
            validId(progress.expectedPublishedRevisionId)),
        "Invalid publication checkpoint.",
      );
      const key = (phase) => `helpdesk-${entry.identity}-${phase}`;
      if (!progress.draftId) {
        const revision = await client.publishing.createRevision(
          entry.key,
          {
            metadata: entry.metadata,
            expectedPublishedRevisionId: progress.expectedPublishedRevisionId,
          },
          { ...requestOptions(), idempotencyKey: key("draft") },
        );
        check(validId(revision.id), "Invalid Helpdesk revision.");
        progress.draftId = revision.id;
        save();
      }
      check(validId(progress.draftId), "Invalid revision checkpoint.");
      if (progress.publishedRevisionId) {
        check(progress.publishedRevisionId === progress.draftId, "Invalid published checkpoint.");
        results.push({
          key: entry.key,
          language: entry.language,
          revisionId: progress.draftId,
          status: "already-published",
        });
        continue;
      }
      if (!progress.mediaOperationId) {
        if (!progress.prepareVersion) {
          const revision = await client.publishing.getRevision(progress.draftId, requestOptions());
          check(integer(revision.version, 1, Number.MAX_SAFE_INTEGER), "Invalid revision version.");
          progress.prepareVersion = revision.version;
          save();
        }
        const operation = await client.publishing.prepareMedia(
          progress.draftId,
          {
            contentType: "video/mp4",
            expectedSizeBytes: entry.sizeBytes,
            expectedSha256: entry.sha256,
          },
          {
            ...requestOptions(),
            expectedVersion: progress.prepareVersion,
            idempotencyKey: key("media"),
          },
        );
        check(validId(operation.id), "Invalid media operation.");
        progress.mediaOperationId = operation.id;
        save();
      }
      check(validId(progress.mediaOperationId), "Invalid media operation checkpoint.");
      await poll(
        progress.mediaOperationId,
        progress.draftId,
        client.publishing.getOperation,
        client.publishing.retryOperation,
      );
      if (!progress.uploadComplete) {
        const grant = await client.publishing.createUploadAuthorization(
          progress.draftId,
          requestOptions(),
        );
        await upload({ entry, grant, progress, save, deadline, signal });
        check(progress.uploadComplete === true, "Bunny upload did not complete.");
        save();
      }
      if (!progress.finalizationOperationId) {
        if (!progress.finalizeVersion) {
          const revision = await client.publishing.getRevision(progress.draftId, requestOptions());
          check(integer(revision.version, 1, Number.MAX_SAFE_INTEGER), "Invalid revision version.");
          progress.finalizeVersion = revision.version;
          save();
        }
        const operation = await client.publishing.finalizeRevision(progress.draftId, {
          ...requestOptions(),
          expectedVersion: progress.finalizeVersion,
          idempotencyKey: key("finalize"),
        });
        check(validId(operation.id), "Invalid finalization operation.");
        progress.finalizationOperationId = operation.id;
        save();
      }
      check(validId(progress.finalizationOperationId), "Invalid finalization checkpoint.");
      const finalized = await poll(
        progress.finalizationOperationId,
        progress.draftId,
        client.publishing.getFinalizationOperation,
        client.publishing.retryFinalizationOperation,
      );
      check(finalized.revisionId === progress.draftId, "Finalization belongs to another revision.");
      progress.publishVersion = finalized.revisionVersion;
      save();
      const published = await client.publishing.publishRevision(progress.draftId, {
        ...requestOptions(),
        expectedVersion: progress.publishVersion,
      });
      check(
        published.id === progress.draftId && published.state === "published",
        "Helpdesk did not publish the revision.",
      );
      progress.publishedRevisionId = published.id;
      state.published[entry.slot] = {
        revisionId: published.id,
        artifactId: entry.identity,
        commit: manifest.commit,
        version: manifest.version,
      };
      save();
      results.push({
        key: entry.key,
        language: entry.language,
        revisionId: published.id,
        status: "published",
      });
    }
    const summary = { ok: true, version: manifest.version, tutorials: results };
    if (outputPath) saveJson(outputPath, summary);
    return summary;
  } catch (error) {
    const failure = signal?.aborted ? new PublicationPendingError() : error;
    save();
    if (outputPath)
      saveJson(outputPath, {
        ok: false,
        pending: failure instanceof PublicationPendingError,
        version: manifest.version,
        tutorials: results,
      });
    throw failure;
  }
}

function argumentsOf(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--retry-failed") {
      options.retryFailed = true;
      continue;
    }
    check(
      ["--bundle", "--state", "--output", "--deadline-ms"].includes(key) && index + 1 < args.length,
      "Usage: publisher.mjs --bundle DIR --state FILE --output FILE [--deadline-ms MS] [--retry-failed]",
    );
    check(!Object.hasOwn(options, key), "Duplicate publisher option.");
    options[key] = args[++index];
  }
  check(
    options["--bundle"] && options["--state"] && options["--output"],
    "Bundle, state and output paths are required.",
  );
  return options;
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === "--help") {
    console.log(
      "Usage: node scripts/self-onboarding-publish/publisher.mjs --bundle DIR --state FILE --output FILE [--deadline-ms MS] [--retry-failed]",
    );
    return;
  }
  const options = argumentsOf(process.argv.slice(2));
  check(
    process.env.GUIDE_API_URL && process.env.GUIDE_PUBLISH_API_KEY,
    "GUIDE_API_URL and GUIDE_PUBLISH_API_KEY are required.",
  );
  const apiRequire = createRequire(resolve(ROOT, "apps/api/package.json"));
  const webRequire = createRequire(resolve(ROOT, "apps/web/package.json"));
  const { createGuideClient } = apiRequire("@mentingo/guide-sdk");
  const { Upload } = webRequire("tus-js-client");
  const client = createGuideClient({
    baseURL: process.env.GUIDE_API_URL,
    apiKey: process.env.GUIDE_PUBLISH_API_KEY,
    timeoutMs: 15_000,
  });
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  const result = await publishBundle({
    bundle: resolve(options["--bundle"]),
    statePath: resolve(options["--state"]),
    outputPath: resolve(options["--output"]),
    client,
    deadlineMs: options["--deadline-ms"] ? Number(options["--deadline-ms"]) : DEFAULT_DEADLINE_MS,
    retryFailed: options.retryFailed === true,
    signal: controller.signal,
    upload: (args) => uploadToBunny({ ...args, Upload }),
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    // SDK/TUS errors can retain URLs/headers. Only known local status is public.
    const pending = error instanceof PublicationPendingError;
    const message =
      pending || error instanceof PublisherInputError
        ? error.message
        : "Helpdesk publication failed. Inspect the private checkpoint and operation status.";
    const status = Number.isInteger(error?.status) ? error.status : undefined;
    const code =
      typeof error?.code === "string" && /^[a-z_]{1,64}$/.test(error.code) ? error.code : undefined;
    console.error(JSON.stringify({ ok: false, pending, error: message, status, code }));
    process.exitCode = pending ? 75 : 1;
  });
}
