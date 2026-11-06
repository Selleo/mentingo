import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { BadRequestException } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import archiver from "archiver";
import unzipper from "unzipper";
import { validate as isUuid } from "uuid";

import { isRecord } from "src/common/utils/object.utils";
import { processInBatches } from "src/common/utils/processInBatches";

import { version } from "../../../version.json";
import {
  NATIVE_ARCHIVE_FORMAT,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_LIMITS,
  NATIVE_ARCHIVE_VERSION,
} from "../native-archive.constants";
import { nativeArchiveManifestSchema } from "../schemas/native-archive-manifest.schema";

import type {
  NativeArchiveBuildInput,
  NativeArchiveBuildOptions,
  NativeArchiveDocument,
  NativeArchiveFileHash,
  NativeArchiveManifest,
  NativeArchivePreparedAsset,
  NativeArchiveReadOptions,
} from "../native-archive.types";
import type { Readable } from "node:stream";

/** Rejects an archive that does not satisfy the native ZIP format. */
function rejectInvalidArchive(): never {
  throw new BadRequestException("nativeArchive.error.invalidArchive");
}

type ByteBudget = { remainingBytes: number };

/** Streams an asset into the destination while hashing its bytes and enforcing entry and archive limits. */
async function pipeAndHashAsset(
  sourceStream: NodeJS.ReadableStream,
  destination: NodeJS.WritableStream,
  entryLimit: number,
  budget: ByteBudget,
): Promise<NativeArchiveFileHash> {
  const digest = createHash("sha256");
  let byteLength = 0;
  const hashingStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (chunk.length > entryLimit - byteLength || chunk.length > budget.remainingBytes) {
        callback(new BadRequestException("nativeArchive.error.assetTooLarge"));
        return;
      }

      byteLength += chunk.length;
      budget.remainingBytes -= chunk.length;
      digest.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(sourceStream, hashingStream, destination);

  return { sha256: digest.digest("hex"), byteLength };
}

/** Copies an asset to a file while hashing it, removing the partial file when copying fails. */
async function copyAndHashAsset(
  sourceStream: NodeJS.ReadableStream,
  destinationPath: string,
  entryLimit: number,
  budget: ByteBudget,
): Promise<NativeArchiveFileHash> {
  try {
    return await pipeAndHashAsset(
      sourceStream,
      createWriteStream(destinationPath),
      entryLimit,
      budget,
    );
  } catch (error) {
    await unlink(destinationPath).catch(() => undefined);
    throw error;
  }
}

/**
 * Copies source assets to temporary files, a few at a time, and assigns each a digest-based
 * archive path. The combined uncompressed size is checked before the ZIP writer sees the files.
 */
export async function stageSourceAssets(
  sourceFiles: NativeArchiveBuildInput["files"],
  temporaryDirectory: string,
  { onAssetStaged }: NativeArchiveBuildOptions = {},
): Promise<NativeArchivePreparedAsset[]> {
  const budget: ByteBudget = { remainingBytes: NATIVE_ARCHIVE_LIMITS.MAX_UNCOMPRESSED_BYTES };
  let stagedCount = 0;

  return processInBatches(
    sourceFiles,
    async (sourceFile): Promise<NativeArchivePreparedAsset> => {
      const stagedFilePath = path.join(temporaryDirectory, randomUUID());

      const { sha256, byteLength } = await copyAndHashAsset(
        await sourceFile.open(),
        stagedFilePath,
        NATIVE_ARCHIVE_LIMITS.MAX_UNCOMPRESSED_BYTES,
        budget,
      );
      stagedCount += 1;
      onAssetStaged?.(stagedCount, sourceFiles.length);

      return {
        path: `assets/${sha256}`,
        sha256,
        byteLength,
        contentType: sourceFile.contentType,
        sourceReference: sourceFile.sourceReference,
        stagedFilePath,
      };
    },
    { batchSize: NATIVE_ARCHIVE_LIMITS.ASSET_STAGING_BATCH_SIZE },
  );
}

/** Builds the portable manifest without including temporary filesystem paths. */
export function buildArchiveManifest(
  archiveInput: NativeArchiveBuildInput,
  stagedAssets: NativeArchivePreparedAsset[],
): NativeArchiveManifest {
  const courseIds = Object.keys(archiveInput.courses);
  if (courseIds.some((courseId) => !isUuid(courseId))) rejectInvalidArchive();

  return {
    format: NATIVE_ARCHIVE_FORMAT,
    version: NATIVE_ARCHIVE_VERSION,
    kind: archiveInput.kind,
    rootId: archiveInput.rootId,
    courseIds,
    exportedAt: new Date().toISOString(),
    applicationVersion: version,
    assets: stagedAssets.map(({ stagedFilePath: _stagedFilePath, ...asset }) => asset),
  };
}

/**
 * Identifies the archive an export input would build. Stored files never change under their key,
 * so the documents plus each file's reference determine the archive's contents.
 */
export function fingerprintArchiveInput(archiveInput: NativeArchiveBuildInput): string {
  const { kind, rootId, courses, learningPath, files } = archiveInput;

  return createHash("sha256")
    .update(
      JSON.stringify({
        format: NATIVE_ARCHIVE_FORMAT,
        version: NATIVE_ARCHIVE_VERSION,
        applicationVersion: version,
        kind,
        rootId,
        courses,
        learningPath,
        files: files.map(({ path: filePath, contentType, sourceReference }) => ({
          path: filePath,
          contentType,
          sourceReference,
        })),
      }),
    )
    .digest("hex");
}

/** Sums the bytes the package will hold: each distinct asset once, plus its JSON documents. */
export function estimateArchiveByteLength(
  archiveInput: NativeArchiveBuildInput,
  stagedAssets: NativeArchivePreparedAsset[],
): number {
  const assetBytes = [...new Map(stagedAssets.map((asset) => [asset.path, asset])).values()].reduce(
    (total, asset) => total + asset.byteLength,
    0,
  );
  const documentBytes = [...Object.values(archiveInput.courses), archiveInput.learningPath].reduce(
    (total: number, document) =>
      document ? total + Buffer.byteLength(JSON.stringify(document)) : total,
    0,
  );

  return assetBytes + documentBytes;
}

/** Passes archive bytes through and fails the stream once they exceed the archive size limit. */
export function createSizeLimitedArchiveStream(): Transform {
  let archiveBytes = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      archiveBytes += chunk.length;

      if (archiveBytes > NATIVE_ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES) {
        callback(new BadRequestException("nativeArchive.error.archiveTooLarge"));
        return;
      }

      callback(null, chunk);
    },
  });
}

/**
 * Streams the manifest, JSON documents, and one file per distinct asset digest. Assets are
 * stored uncompressed: media is already compressed, so deflating it costs CPU for no size gain.
 * The caller owns the returned stream and the temporary files used to build it.
 */
export function createNativeArchiveZipStream(
  archiveInput: NativeArchiveBuildInput,
  stagedAssets: NativeArchivePreparedAsset[],
  manifest: NativeArchiveManifest,
): Transform {
  const archiveOutput = createSizeLimitedArchiveStream();
  const zipWriter = archiver("zip", { zlib: { level: 6 } });

  zipWriter.on("error", (error) => archiveOutput.destroy(error));
  zipWriter.pipe(archiveOutput);

  zipWriter.append(JSON.stringify(manifest), { name: "manifest.json" });

  for (const [courseId, courseDocument] of Object.entries(archiveInput.courses)) {
    zipWriter.append(JSON.stringify(courseDocument), { name: `courses/${courseId}.json` });
  }

  if (archiveInput.learningPath) {
    zipWriter.append(JSON.stringify(archiveInput.learningPath), { name: "learning-path.json" });
  }

  const assetsByDigestPath = new Map(stagedAssets.map((asset) => [asset.path, asset]));
  for (const asset of assetsByDigestPath.values()) {
    const assetEntry: archiver.ZipEntryData = { name: asset.path, store: true };
    zipWriter.file(asset.stagedFilePath, assetEntry);
  }

  queueMicrotask(() => zipWriter.finalize().catch((error) => archiveOutput.destroy(error)));

  return archiveOutput;
}

/**
 * Opens a staged ZIP and validates its member paths, declared sizes, and entry count.
 * Returns file members in archive order plus a lookup by their paths.
 */
export async function openValidatedZipEntries(archivePath: string) {
  const archiveStats = await stat(archivePath);

  if (archiveStats.size > NATIVE_ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES) {
    throw new BadRequestException("nativeArchive.error.archiveTooLarge");
  }

  const zipDirectory = await unzipper.Open.file(archivePath);

  return validateAndIndexZipEntries(zipDirectory.files);
}

/** Rejects ambiguous or traversing paths before any entry is extracted. */
function assertSafeZipEntryPath(entryPath: string): void {
  if (
    !entryPath ||
    entryPath.startsWith("/") ||
    entryPath.includes("\\") ||
    entryPath.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
    entryPath.includes("\0")
  ) {
    rejectInvalidArchive();
  }
}

/** Rejects symlinks, invalid declared sizes, and extreme compression ratios. */
function assertValidZipFileMetadata(fileEntry: unzipper.File): void {
  const unixMode = fileEntry.externalFileAttributes >>> 16;
  if ((unixMode & 0o170000) === 0o120000) {
    rejectInvalidArchive();
  }

  const hasInvalidDeclaredSize =
    !Number.isSafeInteger(fileEntry.uncompressedSize) ||
    !Number.isSafeInteger(fileEntry.compressedSize) ||
    fileEntry.uncompressedSize < 0 ||
    fileEntry.compressedSize < 0 ||
    (fileEntry.uncompressedSize > 0 && fileEntry.compressedSize === 0);

  if (hasInvalidDeclaredSize || fileEntry.uncompressedSize > fileEntry.compressedSize * 1000) {
    rejectInvalidArchive();
  }
}

/** Validates every ZIP member and indexes extractable files by their archive path. */
function validateAndIndexZipEntries(zipEntries: unzipper.File[]) {
  if (zipEntries.length > NATIVE_ARCHIVE_LIMITS.MAX_ENTRIES) rejectInvalidArchive();

  const fileEntries: unzipper.File[] = [];
  const entriesByPath = new Map<string, unzipper.File>();
  let declaredUncompressedBytes = 0;

  for (const zipEntry of zipEntries) {
    const entryPath =
      zipEntry.type === "Directory" ? zipEntry.path.replace(/\/$/, "") : zipEntry.path;
    assertSafeZipEntryPath(entryPath);

    if (zipEntry.type !== "File" && zipEntry.type !== "Directory") {
      rejectInvalidArchive();
    }
    if (zipEntry.type === "Directory") continue;

    assertValidZipFileMetadata(zipEntry);
    if (entriesByPath.has(zipEntry.path)) {
      rejectInvalidArchive();
    }

    entriesByPath.set(zipEntry.path, zipEntry);
    fileEntries.push(zipEntry);

    declaredUncompressedBytes += zipEntry.uncompressedSize;
    if (declaredUncompressedBytes > NATIVE_ARCHIVE_LIMITS.MAX_UNCOMPRESSED_BYTES) {
      rejectInvalidArchive();
    }
  }

  return { fileEntries, entriesByPath };
}

/** Parses a JSON member without allowing its streamed bytes to exceed the JSON limit. */
async function parseJsonEntry(jsonEntry: unzipper.File): Promise<unknown> {
  if (jsonEntry.uncompressedSize > NATIVE_ARCHIVE_LIMITS.MAX_JSON_BYTES) {
    rejectInvalidArchive();
  }

  const jsonChunks: Buffer[] = [];
  let streamedBytes = 0;

  for await (const chunk of jsonEntry.stream()) {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    streamedBytes += chunkBuffer.length;

    if (streamedBytes > NATIVE_ARCHIVE_LIMITS.MAX_JSON_BYTES) rejectInvalidArchive();
    jsonChunks.push(chunkBuffer);
  }

  try {
    return JSON.parse(Buffer.concat(jsonChunks).toString("utf8"));
  } catch {
    return rejectInvalidArchive();
  }
}

/** Reports an unsupported version of this archive format distinctly from malformed input. */
function assertSupportedManifestVersion(manifestValue: unknown): void {
  if (
    isRecord(manifestValue) &&
    manifestValue.format === NATIVE_ARCHIVE_FORMAT &&
    manifestValue.version !== NATIVE_ARCHIVE_VERSION
  ) {
    throw new BadRequestException("nativeArchive.error.unsupportedVersion");
  }
}

/** Requires digest-based asset paths and one manifest entry per source reference. */
function assertValidManifestAssets(manifest: NativeArchiveManifest): void {
  const sourceReferences = new Set<string>();

  for (const asset of manifest.assets) {
    if (asset.path !== `assets/${asset.sha256}` || asset.sourceReference.includes("\0")) {
      rejectInvalidArchive();
    }

    if (sourceReferences.has(asset.sourceReference)) rejectInvalidArchive();
    sourceReferences.add(asset.sourceReference);
  }
}

/** Reads the manifest and validates its schema and archive-specific invariants. */
export async function readValidatedArchiveManifest(
  entriesByPath: Map<string, unzipper.File>,
): Promise<NativeArchiveManifest> {
  const manifestEntry = entriesByPath.get("manifest.json");
  if (!manifestEntry) rejectInvalidArchive();

  const manifestValue = await parseJsonEntry(manifestEntry);
  assertSupportedManifestVersion(manifestValue);
  if (!Value.Check(nativeArchiveManifestSchema, manifestValue)) rejectInvalidArchive();

  const manifest: NativeArchiveManifest = manifestValue;
  assertValidManifestAssets(manifest);

  if (
    manifest.kind === NATIVE_ARCHIVE_KIND.COURSE &&
    (manifest.courseIds.length !== 1 || manifest.courseIds[0] !== manifest.rootId)
  ) {
    rejectInvalidArchive();
  }

  return manifest;
}

/** Requires the ZIP's file members to match the manifest without extras or omissions. */
export function assertManifestMatchesZipEntries(
  manifest: NativeArchiveManifest,
  fileEntries: unzipper.File[],
): void {
  const expectedPaths = new Set([
    "manifest.json",
    ...manifest.courseIds.map((id) => `courses/${id}.json`),
    ...manifest.assets.map((asset) => asset.path),
    ...(manifest.kind === NATIVE_ARCHIVE_KIND.LEARNING_PATH ? ["learning-path.json"] : []),
  ]);

  if (
    expectedPaths.size !== fileEntries.length ||
    fileEntries.some((fileEntry) => !expectedPaths.has(fileEntry.path))
  ) {
    rejectInvalidArchive();
  }
}

/** Parses every listed course document and requires a JSON object for each one. */
async function readCourseDocuments(
  courseIds: NativeArchiveManifest["courseIds"],
  entriesByPath: Map<string, unzipper.File>,
): Promise<NativeArchiveDocument["courses"]> {
  const courseDocuments: NativeArchiveDocument["courses"] = {};

  for (const courseId of courseIds) {
    const courseEntry = entriesByPath.get(`courses/${courseId}.json`);
    if (!courseEntry) rejectInvalidArchive();

    const courseDocument = await parseJsonEntry(courseEntry);
    if (!isRecord(courseDocument)) rejectInvalidArchive();

    courseDocuments[courseId] = courseDocument;
  }

  return courseDocuments;
}

/** Parses the learning path document when present and requires it for path archives. */
async function readLearningPathDocument(
  manifest: NativeArchiveManifest,
  entriesByPath: Map<string, unzipper.File>,
): Promise<NativeArchiveDocument["learningPath"]> {
  const learningPathEntry = entriesByPath.get("learning-path.json");
  const learningPathDocument = learningPathEntry
    ? await parseJsonEntry(learningPathEntry)
    : undefined;

  if (learningPathDocument !== undefined && !isRecord(learningPathDocument)) {
    rejectInvalidArchive();
  }
  if (manifest.kind === NATIVE_ARCHIVE_KIND.LEARNING_PATH && !learningPathDocument) {
    rejectInvalidArchive();
  }

  return learningPathDocument;
}

/** Reads course and learning path JSON objects from the indexed ZIP members. */
export async function readArchiveDocuments(
  manifest: NativeArchiveManifest,
  entriesByPath: Map<string, unzipper.File>,
): Promise<Pick<NativeArchiveDocument, "courses" | "learningPath">> {
  const courses = await readCourseDocuments(manifest.courseIds, entriesByPath);
  const learningPath = await readLearningPathDocument(manifest, entriesByPath);

  return { courses, learningPath };
}

/**
 * Verifies every asset's bytes against the manifest by streaming them through a hash, without
 * writing them anywhere. Assets are read from the ZIP again only when they are imported.
 */
export async function verifyAssetDigests(
  assets: NativeArchiveManifest["assets"],
  entriesByPath: Map<string, unzipper.File>,
  { onAssetVerified }: NativeArchiveReadOptions = {},
): Promise<void> {
  const budget: ByteBudget = { remainingBytes: NATIVE_ARCHIVE_LIMITS.MAX_UNCOMPRESSED_BYTES };

  for (const [assetIndex, asset] of assets.entries()) {
    const assetEntry = entriesByPath.get(asset.path);
    if (!assetEntry) rejectInvalidArchive();

    const { sha256, byteLength } = await pipeAndHashAsset(
      assetEntry.stream(),
      createDiscardingStream(),
      assetEntry.uncompressedSize,
      budget,
    );
    if (sha256 !== asset.sha256 || byteLength !== asset.byteLength) rejectInvalidArchive();
    onAssetVerified?.(assetIndex + 1, assets.length);
  }
}

function createDiscardingStream(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

/** Opens a verified asset of the archive by its manifest path. */
export function openVerifiedAsset(
  assets: NativeArchiveManifest["assets"],
  entriesByPath: Map<string, unzipper.File>,
  assetPath: string,
): Readable {
  const assetEntry = assets.some((asset) => asset.path === assetPath)
    ? entriesByPath.get(assetPath)
    : undefined;

  if (!assetEntry) throw new BadRequestException("nativeArchive.error.missingAsset");

  return assetEntry.stream();
}
