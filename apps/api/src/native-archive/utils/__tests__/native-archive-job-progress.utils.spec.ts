import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  NATIVE_ARCHIVE_JOB_STAGES,
  NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS,
} from "../../native-archive.constants";
import {
  createByteProgressStream,
  createNativeArchiveProgressReporter,
} from "../native-archive-job-progress.utils";

function arrangeReporter() {
  let currentTime = 0;
  const saveProgress = jest.fn().mockResolvedValue(undefined);
  const reporter = createNativeArchiveProgressReporter(saveProgress, () => currentTime);
  const advanceTime = (milliseconds: number) => {
    currentTime += milliseconds;
  };

  return { reporter, saveProgress, advanceTime };
}

describe("native archive job progress", () => {
  it.each([
    { stage: NATIVE_ARCHIVE_JOB_STAGES.COLLECTING_CONTENT, percent: 0 },
    { stage: NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES, percent: 30 },
    { stage: NATIVE_ARCHIVE_JOB_STAGES.SAVING, percent: 80 },
  ])("saves the start of $stage as soon as the job enters it", ({ stage, percent }) => {
    const { reporter, saveProgress } = arrangeReporter();

    reporter.enterStage(stage);

    expect(saveProgress).toHaveBeenCalledWith({ stage, percent });
  });

  it.each([
    { completed: 0, total: 4, percent: 30 },
    { completed: 1, total: 4, percent: 40 },
    { completed: 4, total: 4, percent: 70 },
    { completed: 9, total: 4, percent: 70 },
    { completed: 0, total: 0, percent: 70 },
  ])(
    "maps $completed of $total uploads to $percent percent overall",
    ({ completed, total, percent }) => {
      const { reporter, saveProgress, advanceTime } = arrangeReporter();
      reporter.enterStage(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES);
      advanceTime(NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS);

      reporter.reportStageWork(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES, completed, total);

      expect(saveProgress).toHaveBeenLastCalledWith({
        stage: NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES,
        percent,
      });
    },
  );

  it("spaces out updates inside a stage", () => {
    const { reporter, saveProgress, advanceTime } = arrangeReporter();
    reporter.enterStage(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES);

    reporter.reportStageWork(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES, 1, 4);
    advanceTime(NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS);
    reporter.reportStageWork(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES, 2, 4);

    expect(saveProgress.mock.calls.map(([progress]) => progress.percent)).toEqual([30, 50]);
  });

  it("never moves the percentage back when more work is planned", () => {
    const { reporter, saveProgress, advanceTime } = arrangeReporter();
    reporter.enterStage(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES);
    advanceTime(NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS);
    reporter.reportStageWork(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES, 2, 2);
    advanceTime(NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS);

    reporter.reportStageWork(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES, 3, 10);

    expect(saveProgress.mock.calls.map(([progress]) => progress.percent)).toEqual([30, 70]);
  });

  it("keeps the job running when saving progress fails", async () => {
    const reporter = createNativeArchiveProgressReporter(
      jest.fn().mockRejectedValue(new Error("redis unavailable")),
    );

    expect(() => reporter.enterStage(NATIVE_ARCHIVE_JOB_STAGES.DOWNLOADING)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it("reports transferred bytes against the expected size", async () => {
    const reportBytes = jest.fn();
    const sink = new Writable({ write: (_chunk, _encoding, callback) => callback() });

    await pipeline(
      Readable.from([Buffer.from("abcd"), Buffer.from("efgh")]),
      createByteProgressStream(8, reportBytes),
      sink,
    );

    expect(reportBytes.mock.calls).toEqual([
      [4, 8],
      [8, 8],
    ]);
  });
});
