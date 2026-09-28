import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { BadRequestException } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import archiver from "archiver";
import unzipper from "unzipper";
import { validate as isUuid } from "uuid";

import { isRecord } from "src/common/utils/object.utils";

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
  NativeArchiveDocument,
  NativeArchiveFileHash,
  NativeArchiveManifest,
  NativeArchivePreparedAsset,
} from "../native-archive.types";

/** Rejects an archive that does not satisfy the native ZIP format. */
function rejectInvalidArchive(): never {
  throw new BadRequestException("nativeArchive.error.invalidArchive");
}

/** Copies an asset while hashing its bytes and enforcing the per-entry size limit. */
async function copyAndHashAsset(
  sourceStream: NodeJS.ReadableStream,
  destinationPath: string,
): Promise<NativeArchiveFileHash> {
  const digest = createHash("sha256");
  let byteLength = 0;
  const hashingStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteLength += chunk.length;

      if (byteLength > NATIVE_ARCHIVE_LIMITS.MAX_UNCOMPRESSED_BYTES) {
        callback(new BadRequestException("nativeArchive.error.assetTooLarge"));
        return;
      }

      digest.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(sourceStream, hashingStream, createWriteStream(destinationPath));

  return { sha256: digest.digest("hex"), byteLength };
}

/**
 * Copies source assets to temporary files and assigns each a digest-based archive path.
 * The combined uncompressed size is checked before the ZIP writer sees the files.
 */
export async function stageSourceAssets(
  sourceFiles: NativeArchiveBuildInput["files"],
  temporaryDirectory: string,
): Promise<NativeArchivePreparedAsset[]> {
  const stagedAssets: NativeArchivePreparedAsset[] = [];
  let totalAssetBytes = 0;

  for (const sourceFile of sourceFiles) {
    const stagedFilePath = path.join(temporaryDirectory, randomUUID());
    const { sha256, byteLength } = await copyAndHashAsset(await sourceFile.open(), stagedFilePath);

    totalAssetBytes += byteLength;
    if (totalAssetBytes > NATIVE_ARCHIVE_LIMITS.MAX_UNCOMPRESSED_BYTES) {
      throw new BadRequestException("nativeArchive.error.assetTooLarge");
    }

    stagedAssets.push({
      path: `assets/${sha256}`,
      sha256,
      byteLength,
      contentType: sourceFile.contentType,
      sourceReference: sourceFile.sourceReference,
      stagedFilePath,
    });
  }

  return stagedAssets;
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

/** Bounds the compressed archive bytes emitted by the ZIP writer. */
function createSizeLimitedArchiveOutput(): Transform {
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
 * Streams the manifest, JSON documents, and one file per distinct asset digest.
 * The caller owns the returned stream and the temporary files used to build it.
 */
export function createNativeArchiveZipStream(
  archiveInput: NativeArchiveBuildInput,
  stagedAssets: NativeArchivePreparedAsset[],
  manifest: NativeArchiveManifest,
): Transform {
  const archiveOutput = createSizeLimitedArchiveOutput();
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
    zipWriter.file(asset.stagedFilePath, { name: asset.path });
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
 * Extracts assets into the temporary directory and verifies their bytes against the manifest.
 * Returns a mapping from each manifest asset path to its extracted file path.
 */
export async function extractVerifiedAssets(
  assets: NativeArchiveManifest["assets"],
  entriesByPath: Map<string, unzipper.File>,
  temporaryDirectory: string,
): Promise<Map<string, string>> {
  await mkdir(temporaryDirectory, { recursive: true });

  const extractedFilesByAssetPath = new Map<string, string>();

  for (const asset of assets) {
    const assetEntry = entriesByPath.get(asset.path);
    if (!assetEntry) rejectInvalidArchive();

    const extractedFilePath = path.join(temporaryDirectory, asset.sha256);
    const extractedHash = await copyAndHashAsset(assetEntry.stream(), extractedFilePath);
    if (extractedHash.sha256 !== asset.sha256 || extractedHash.byteLength !== asset.byteLength) {
      rejectInvalidArchive();
    }

    extractedFilesByAssetPath.set(asset.path, extractedFilePath);
  }

  return extractedFilesByAssetPath;
}
