import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  assertManifestMatchesZipEntries,
  buildArchiveManifest,
  createNativeArchiveZipStream,
  extractVerifiedAssets,
  openValidatedZipEntries,
  readArchiveDocuments,
  readValidatedArchiveManifest,
  stageSourceAssets,
} from "./native-archive-zip.utils";

import type {
  NativeArchiveBuildInput,
  NativeArchiveBuiltZip,
  ParsedNativeArchive,
} from "../native-archive.types";

export async function buildNativeArchive(
  archiveInput: NativeArchiveBuildInput,
): Promise<NativeArchiveBuiltZip> {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "mentingo-export-"));
  const cleanup = () => rm(temporaryDirectory, { recursive: true, force: true });

  try {
    const stagedAssets = await stageSourceAssets(archiveInput.files, temporaryDirectory);
    const manifest = buildArchiveManifest(archiveInput, stagedAssets);
    const stream = createNativeArchiveZipStream(archiveInput, stagedAssets, manifest);

    return { stream, cleanup };
  } catch (error) {
    await cleanup();

    throw error;
  }
}

export async function readNativeArchive(zipPath: string): Promise<ParsedNativeArchive> {
  const { fileEntries, entriesByPath } = await openValidatedZipEntries(zipPath);

  const manifest = await readValidatedArchiveManifest(entriesByPath);
  assertManifestMatchesZipEntries(manifest, fileEntries);

  const documents = await readArchiveDocuments(manifest, entriesByPath);

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "mentingo-import-"));
  const cleanup = () => rm(temporaryDirectory, { recursive: true, force: true });

  try {
    const assetFiles = await extractVerifiedAssets(
      manifest.assets,
      entriesByPath,
      temporaryDirectory,
    );

    return {
      manifest,
      ...documents,
      assetFiles,
      cleanup,
    };
  } catch (error) {
    await cleanup();

    throw error;
  }
}
