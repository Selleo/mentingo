import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import {
  assertManifestMatchesZipEntries,
  buildArchiveManifest,
  createNativeArchiveZipStream,
  estimateArchiveByteLength,
  openValidatedZipEntries,
  openVerifiedAsset,
  readArchiveDocuments,
  readValidatedArchiveManifest,
  stageSourceAssets,
  verifyAssetDigests,
} from "./native-archive-zip.utils";

import type {
  NativeArchiveBuildInput,
  NativeArchiveBuildOptions,
  NativeArchiveBuiltZip,
  NativeArchiveReadOptions,
  ParsedNativeArchive,
} from "../native-archive.types";

export async function buildNativeArchive(
  archiveInput: NativeArchiveBuildInput,
  buildOptions: NativeArchiveBuildOptions = {},
): Promise<NativeArchiveBuiltZip> {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "mentingo-export-"));
  const cleanup = () => rm(temporaryDirectory, { recursive: true, force: true });

  try {
    const stagedAssets = await stageSourceAssets(
      archiveInput.files,
      temporaryDirectory,
      buildOptions,
    );
    const manifest = buildArchiveManifest(archiveInput, stagedAssets);
    const stream = createNativeArchiveZipStream(archiveInput, stagedAssets, manifest);

    return {
      stream,
      estimatedByteLength: estimateArchiveByteLength(archiveInput, stagedAssets),
      cleanup,
    };
  } catch (error) {
    await cleanup();

    throw error;
  }
}

/**
 * Opens an imported archive: validates its structure, parses its documents, and verifies every
 * asset's digest. Assets are streamed from the ZIP when imported instead of being extracted first.
 */
export async function readNativeArchive(
  zipPath: string,
  readOptions: NativeArchiveReadOptions = {},
): Promise<ParsedNativeArchive> {
  const { fileEntries, entriesByPath } = await openValidatedZipEntries(zipPath);

  const manifest = await readValidatedArchiveManifest(entriesByPath);
  assertManifestMatchesZipEntries(manifest, fileEntries);

  const documents = await readArchiveDocuments(manifest, entriesByPath);
  await verifyAssetDigests(manifest.assets, entriesByPath, readOptions);

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "mentingo-import-"));
  const openAsset = (assetPath: string) =>
    openVerifiedAsset(manifest.assets, entriesByPath, assetPath);

  return {
    manifest,
    ...documents,
    openAsset,
    extractAsset: async (assetPath) => {
      const filePath = path.join(temporaryDirectory, randomUUID());
      await pipeline(openAsset(assetPath), createWriteStream(filePath));

      return filePath;
    },
    cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
  };
}
