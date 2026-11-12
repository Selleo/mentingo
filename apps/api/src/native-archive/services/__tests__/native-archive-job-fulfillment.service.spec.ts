import { Readable } from "node:stream";

import { Logger } from "@nestjs/common";

import {
  NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS,
  NATIVE_ARCHIVE_IMPORT_OUTCOMES,
  NATIVE_ARCHIVE_JOB_ACTION,
  NATIVE_ARCHIVE_JOB_STAGES,
} from "../../native-archive.constants";
import { NativeArchiveJobFulfillmentService } from "../native-archive-job-fulfillment.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const ACTOR = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
  tenantId: "1c720b6d-390d-4613-aa75-a5cc0b642147",
} as CurrentUserType;
const PATH_ID = "b7e3f32d-c1ab-4cb9-95e1-79212698bf54";
const COURSE_ID = "f594d687-096b-4599-84bf-1f296afdb1e1";

function arrangeExport({
  hasRememberedExport,
  publish = jest.fn().mockResolvedValue(undefined),
}: {
  hasRememberedExport: boolean;
  publish?: jest.Mock;
}) {
  let tenantContextActive = false;
  const openVideo = jest.fn(async () => {
    expect(tenantContextActive).toBe(true);
    return Readable.from(Buffer.from("video bytes"));
  });
  const tenantDbRunnerService = {
    runWithTenant: jest.fn(async (_tenantId: string, callback: () => Promise<unknown>) => {
      tenantContextActive = true;
      try {
        return await callback();
      } finally {
        tenantContextActive = false;
      }
    }),
  };
  const nativeArchiveSnapshotService = {
    buildLearningPathExportSnapshot: jest.fn().mockResolvedValue({
      courses: { [COURSE_ID]: { course: { id: COURSE_ID } } },
      learningPath: { id: PATH_ID, title: { en: "Sales path" }, baseLanguage: "en" },
      files: [
        {
          path: "bunny-video-id",
          sourceReference: "bunny-video-id",
          contentType: "video/mp4",
          open: openVideo,
        },
      ],
    }),
  };
  const s3Service = {
    uploadStreamMultipart: jest.fn(async (stream: Readable, _key: string) => {
      for await (const _chunk of stream) {
        // Consume the archive as S3 does.
      }
    }),
  };
  const nativeArchiveExportReuseService = {
    copyRememberedExport: jest.fn().mockResolvedValue(hasRememberedExport),
    rememberExport: jest.fn().mockResolvedValue(undefined),
  };
  const service = new NativeArchiveJobFulfillmentService(
    s3Service as never,
    tenantDbRunnerService as never,
    nativeArchiveSnapshotService as never,
    {} as never,
    nativeArchiveExportReuseService as never,
    { publish } as never,
  );

  const progress = { enterStage: jest.fn(), reportStageWork: jest.fn() };
  const exportLearningPath = () =>
    service.fulfillArchiveJob(
      "export-job",
      {
        action: NATIVE_ARCHIVE_JOB_ACTION.EXPORT_LEARNING_PATH,
        rootId: PATH_ID,
        actor: ACTOR,
      },
      progress,
    );

  return {
    exportLearningPath,
    progress,
    openVideo,
    s3Service,
    tenantDbRunnerService,
    nativeArchiveExportReuseService,
  };
}

const EXPORT_KEY_PATTERN = new RegExp(`^${ACTOR.tenantId}/native-archive/exports/`);

describe("NativeArchiveJobFulfillmentService", () => {
  it("stages learning path files while the tenant context is active", async () => {
    const { exportLearningPath, openVideo, s3Service, tenantDbRunnerService } = arrangeExport({
      hasRememberedExport: false,
    });

    await expect(exportLearningPath()).resolves.toMatchObject({
      key: expect.stringMatching(EXPORT_KEY_PATTERN),
      filename: "sales-path.zip",
    });

    expect(tenantDbRunnerService.runWithTenant).toHaveBeenCalledWith(
      ACTOR.tenantId,
      expect.any(Function),
    );
    expect(openVideo).toHaveBeenCalledTimes(1);
    expect(s3Service.uploadStreamMultipart).toHaveBeenCalledTimes(1);
    expect(s3Service.uploadStreamMultipart.mock.calls[0]?.[1]).toMatch(EXPORT_KEY_PATTERN);
  });

  it("remembers a freshly built export by the fingerprint of its content", async () => {
    const { exportLearningPath, nativeArchiveExportReuseService } = arrangeExport({
      hasRememberedExport: false,
    });

    const { key } = await exportLearningPath().then((result) => result as { key: string });

    expect(nativeArchiveExportReuseService.rememberExport).toHaveBeenCalledWith(
      ACTOR.tenantId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      key,
    );
  });

  it("finishes an export whose activity could not be published", async () => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { exportLearningPath } = arrangeExport({
      hasRememberedExport: false,
      publish: jest.fn().mockRejectedValue(new Error("connection reset")),
    });

    await expect(exportLearningPath()).resolves.toMatchObject({
      key: expect.stringMatching(EXPORT_KEY_PATTERN),
      filename: "sales-path.zip",
    });
  });

  it("copies a remembered export of the same content instead of building it", async () => {
    const { exportLearningPath, openVideo, s3Service, nativeArchiveExportReuseService } =
      arrangeExport({ hasRememberedExport: true });

    await expect(exportLearningPath()).resolves.toMatchObject({
      key: expect.stringMatching(EXPORT_KEY_PATTERN),
      filename: "sales-path.zip",
    });

    expect(nativeArchiveExportReuseService.copyRememberedExport).toHaveBeenCalledWith(
      ACTOR.tenantId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(EXPORT_KEY_PATTERN),
    );
    expect(openVideo).not.toHaveBeenCalled();
    expect(s3Service.uploadStreamMultipart).not.toHaveBeenCalled();
    expect(nativeArchiveExportReuseService.rememberExport).not.toHaveBeenCalled();
  });

  it.each([
    {
      case: "builds a package",
      hasRememberedExport: false,
      stages: [
        NATIVE_ARCHIVE_JOB_STAGES.COLLECTING_CONTENT,
        NATIVE_ARCHIVE_JOB_STAGES.COPYING_FILES,
        NATIVE_ARCHIVE_JOB_STAGES.PACKAGING,
      ],
      copiedFiles: [[NATIVE_ARCHIVE_JOB_STAGES.COPYING_FILES, 1, 1]],
    },
    {
      case: "reuses a package",
      hasRememberedExport: true,
      stages: [NATIVE_ARCHIVE_JOB_STAGES.COLLECTING_CONTENT, NATIVE_ARCHIVE_JOB_STAGES.PACKAGING],
      copiedFiles: [],
    },
  ])(
    "reports its stages in order when an export $case",
    async ({ hasRememberedExport, stages, copiedFiles }) => {
      const { exportLearningPath, progress } = arrangeExport({ hasRememberedExport });

      await exportLearningPath();

      expect(progress.enterStage.mock.calls.map(([stage]) => stage)).toEqual(stages);
      expect(progress.reportStageWork.mock.calls).toEqual(copiedFiles);
    },
  );

  it.each([
    {
      action: NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE,
      title: "Bezpieczna praca zdalna",
      filename: "bezpieczna-praca-zdalna.zip",
    },
    {
      action: NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE,
      title: "Zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ",
      filename: "zazolc-gesla-jazn-acelnoszz.zip",
    },
    {
      action: NATIVE_ARCHIVE_JOB_ACTION.EXPORT_LEARNING_PATH,
      title: "Polska ścieżka",
      filename: "polska-sciezka.zip",
    },
    {
      action: NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE,
      title: ' ../ Kurs: "BHP" / 2026! ',
      filename: "kurs-bhp-2026.zip",
    },
    {
      action: NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE,
      title: "🎓",
      filename: "mentingo-package.zip",
    },
  ])("names the $action export titled $title as $filename", async ({ action, title, filename }) => {
    const snapshot = {
      courses: {
        [COURSE_ID]: {
          course: { id: COURSE_ID, title: { en: "Other title", pl: title }, baseLanguage: "pl" },
        },
      },
      learningPath: { id: PATH_ID, title: { en: "Other path", pl: title }, baseLanguage: "pl" },
      files: [],
    };
    const service = new NativeArchiveJobFulfillmentService(
      { uploadStreamMultipart: jest.fn() } as never,
      {
        runWithTenant: async (_tenantId: string, callback: () => Promise<unknown>) => callback(),
      } as never,
      {
        buildCourseExportSnapshot: async () => snapshot,
        buildLearningPathExportSnapshot: async () => snapshot,
      } as never,
      {} as never,
      { copyRememberedExport: async () => false, rememberExport: async () => undefined } as never,
      { publish: async () => undefined } as never,
    );

    await expect(
      service.fulfillArchiveJob("export-job", {
        action,
        rootId: action === NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE ? COURSE_ID : PATH_ID,
        actor: ACTOR,
      }),
    ).resolves.toMatchObject({ filename });
  });

  it("stores the failed outcome of a sourced import in the outbox", async () => {
    const outboxPublisher = { publish: jest.fn() };
    const service = new NativeArchiveJobFulfillmentService(
      {} as never,
      {
        runWithTenant: async (_tenantId: string, callback: () => Promise<unknown>) => callback(),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      outboxPublisher as never,
    );

    await service
      .fulfillArchiveJob("import-job", {
        action: NATIVE_ARCHIVE_JOB_ACTION.IMPORT,
        archiveOrigin: NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.IMPORT_SOURCE,
        importSource: { kind: "unregistered-source" },
        actor: ACTOR,
      })
      .catch(() => undefined);

    expect(outboxPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        importFinishedData: expect.objectContaining({
          jobId: "import-job",
          outcome: NATIVE_ARCHIVE_IMPORT_OUTCOMES.FAILED,
        }),
      }),
    );
  });
});
