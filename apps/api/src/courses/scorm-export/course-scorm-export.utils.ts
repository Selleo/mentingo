import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import slugify from "slugify";

import { processInBatches } from "src/common/utils/processInBatches";

import { version } from "../../../version.json";

import {
  SCORM_EXPORT_FALLBACK_FILENAME_SLUG,
  SCORM_EXPORT_FILE_STAGING_BATCH_SIZE,
  SCORM_EXPORT_FILENAME_SUFFIX,
  SCORM_EXPORT_FORMAT,
} from "./course-scorm-export.constants";

import type { CourseScormStagedFile } from "./course-scorm-export.types";
import type {
  ScormExportCourseSnapshot,
  ScormExportPackageFile,
} from "@repo/scorm-export-generator";
import type { Readable } from "node:stream";

/**
 * Identifies the package a snapshot builds. Stored files never change under their reference, so
 * the snapshot, which holds every reference, determines the package's contents.
 */
export function fingerprintScormExportSnapshot(snapshot: ScormExportCourseSnapshot): string {
  return createHash("sha256")
    .update(JSON.stringify({ format: SCORM_EXPORT_FORMAT, applicationVersion: version, snapshot }))
    .digest("hex");
}

export function buildScormExportFilename(courseTitle: string): string {
  const slug =
    slugify(courseTitle, { lower: true, strict: true, trim: true }) ||
    SCORM_EXPORT_FALLBACK_FILENAME_SLUG;

  return `${slug}-${SCORM_EXPORT_FILENAME_SUFFIX}.zip`;
}

/** Downloads package files to the directory a few at a time, so the ZIP writer reads local files. */
export async function stagePackageFiles(
  files: ScormExportPackageFile[],
  directory: string,
  onFileStaged?: (stagedCount: number, totalCount: number) => void,
): Promise<CourseScormStagedFile[]> {
  let stagedCount = 0;

  return processInBatches(
    files,
    async (file) => {
      const stagedFilePath = path.join(directory, randomUUID());

      try {
        await pipeline(await openPackageFile(file), createWriteStream(stagedFilePath));
      } catch (error) {
        await unlink(stagedFilePath).catch(() => undefined);
        throw error;
      }

      const { size } = await stat(stagedFilePath);
      stagedCount += 1;
      onFileStaged?.(stagedCount, files.length);

      return { path: file.path, stagedFilePath, byteLength: size };
    },
    { batchSize: SCORM_EXPORT_FILE_STAGING_BATCH_SIZE },
  );
}

async function openPackageFile(file: ScormExportPackageFile): Promise<Readable | Buffer[]> {
  if ("buffer" in file) return [file.buffer];
  if ("stream" in file) return file.stream;
  return file.streamFactory();
}
