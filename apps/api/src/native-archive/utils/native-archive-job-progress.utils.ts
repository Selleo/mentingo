import { Transform } from "node:stream";

import {
  NATIVE_ARCHIVE_JOB_STAGE_PERCENT_RANGES,
  NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS,
} from "../native-archive.constants";

import type {
  NativeArchiveJobProgress,
  NativeArchiveJobStage,
  NativeArchiveProgressReporter,
} from "../native-archive.types";

/**
 * Turns stage work into one overall percentage and saves it with the job. The percentage never
 * goes back, a new stage is saved at once, and updates inside a stage are spaced out. A failed
 * save is ignored: progress is informative and must never fail the job.
 */
export function createNativeArchiveProgressReporter(
  saveProgress: (progress: NativeArchiveJobProgress) => Promise<unknown>,
  now: () => number = Date.now,
): NativeArchiveProgressReporter {
  let savedStage: NativeArchiveJobStage | null = null;
  let savedPercent = 0;
  let savedAt = Number.NEGATIVE_INFINITY;

  const saveIfChanged = (stage: NativeArchiveJobStage, percent: number) => {
    const nextPercent = Math.max(savedPercent, Math.floor(percent));
    const entersStage = stage !== savedStage;
    const isDue = now() - savedAt >= NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS;

    if (!entersStage && (nextPercent === savedPercent || !isDue)) return;

    savedStage = stage;
    savedPercent = nextPercent;
    savedAt = now();
    void saveProgress({ stage, percent: nextPercent }).catch(() => undefined);
  };

  return {
    enterStage: (stage) =>
      saveIfChanged(stage, NATIVE_ARCHIVE_JOB_STAGE_PERCENT_RANGES[stage].start),
    reportStageWork: (stage, completed, total) => {
      const { start, end } = NATIVE_ARCHIVE_JOB_STAGE_PERCENT_RANGES[stage];
      const completedShare = total > 0 ? Math.min(completed / total, 1) : 1;

      saveIfChanged(stage, start + (end - start) * completedShare);
    },
  };
}

/** For callers that do not follow progress, such as direct imports in tests. */
export const SILENT_NATIVE_ARCHIVE_PROGRESS: NativeArchiveProgressReporter = {
  enterStage: () => undefined,
  reportStageWork: () => undefined,
};

/** Passes bytes through and reports how many have flowed, as a share of the expected total. */
export function createByteProgressStream(
  totalBytes: number | null | undefined,
  reportBytes: (transferredBytes: number, totalBytes: number) => void,
): Transform {
  let transferredBytes = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      transferredBytes += chunk.length;
      if (totalBytes) reportBytes(transferredBytes, totalBytes);
      callback(null, chunk);
    },
  });
}
