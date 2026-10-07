import { createHash } from "node:crypto";

import { FormatRegistry } from "@sinclair/typebox";
import { v5 as uuidv5, validate } from "uuid";

import { CourseAuthoringApplicationService } from "./course-authoring-application.service";
import { courseAuthoringExportHash } from "./course-authoring-export-hash";

import type { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import type { CourseAuthoringApplyService } from "./course-authoring-apply.service";
import type { CourseAuthoringContextService } from "./course-authoring-context.service";
import type { CourseAuthoringSessionService } from "./course-authoring-session.service";
import type { LumaService } from "./luma.service";
import type { FrozenAuthoringExport } from "./schema/course-authoring-application.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { IngestionProcessingService } from "src/ingestion/services/ingestion-processing.service";
import type { QueueService } from "src/queue";
import type { S3Service } from "src/s3/s3.service";

const courseId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const exportId = "00000000-0000-4000-8000-000000000003";
const assetId = "00000000-0000-4000-8000-000000000004";
const actor: CurrentUserType = {
  userId: courseId,
  tenantId: sessionId,
  email: "author@example.test",
  permissions: [],
  roleSlugs: [],
};

function setup() {
  const exported: FrozenAuthoringExport = {
    schemaVersion: 1,
    courseId,
    sessionId,
    exportId,
    language: "en",
    exportHash: "0".repeat(64),
    proposalIds: [assetId],
    operations: [],
    assets: [],
    createdAt: "2026-09-16T00:00:00Z",
  };
  const receipt = {
    applicationId: assetId,
    courseId,
    sessionId,
    exportId,
    exportHash: "",
    status: "applied" as const,
    appliedOperationIds: [],
    entityMappings: {},
    assetMappings: {},
  };
  const client = {
    authoring: {
      getExport: jest.fn().mockResolvedValue(exported),
      prepareExport: jest.fn().mockResolvedValue(exported),
      downloadAsset: jest.fn(),
      recordReceipt: jest.fn().mockResolvedValue(undefined),
    },
  };
  const findReceipt = jest.fn().mockResolvedValue(null);
  const pendingSessionReceipts = jest.fn().mockResolvedValue([]);
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const getJob = jest.fn().mockResolvedValue({
    data: { courseId, sessionId },
    getState: jest.fn().mockResolvedValue("waiting"),
  });
  const getQueue = jest.fn().mockReturnValue({ getJob });
  const applyPreparedExport = jest
    .fn()
    .mockImplementation(async () => ({ ...receipt, exportHash: exported.exportHash }));
  const prepareUnassignedDocument = jest.fn();
  const prepareUnassignedMentorContextDocument = jest.fn();
  const getContext = jest.fn();
  const getMentorContextLessons = jest.fn().mockResolvedValue([]);
  const command = jest.fn().mockResolvedValue({
    commandId: assetId,
    hash: "command-hash",
    acceptedSequence: 4,
    workspaceRevision: 2,
    requestId: sessionId,
    taskIds: null,
    refreshId: null,
  });
  const service = new CourseAuthoringApplicationService(
    {
      get: jest.fn().mockResolvedValue({ courseId, sessionId }),
      command,
    } as unknown as CourseAuthoringSessionService,
    {
      authorize: jest.fn().mockResolvedValue(actor),
      getContext,
      getMentorContextLessons,
    } as unknown as CourseAuthoringContextService,
    { getLumaClient: jest.fn().mockResolvedValue(client) } as unknown as LumaService,
    { enqueue, getQueue } as unknown as QueueService,
    {
      findReceipt,
      pendingSessionReceipts,
      markDelivered: jest.fn(),
    } as unknown as CourseAuthoringApplicationRepository,
    { applyPreparedExport } as unknown as CourseAuthoringApplyService,
    { uploadFile: jest.fn() } as unknown as S3Service,
    {
      prepareUnassignedDocument,
      prepareUnassignedMentorContextDocument,
    } as unknown as IngestionProcessingService,
  );
  return {
    exported,
    receipt,
    client,
    findReceipt,
    pendingSessionReceipts,
    enqueue,
    getJob,
    applyPreparedExport,
    prepareUnassignedDocument,
    prepareUnassignedMentorContextDocument,
    getContext,
    getMentorContextLessons,
    command,
    service,
  };
}

describe("CourseAuthoringApplicationService immutable preparation", () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));
  it.each([
    ["AUTHORING_CHAPTER_DEPENDENCY_UNREADY", "missingDependency"],
    ["AUTHORING_DEPENDENCY_UNREADY", "missingDependency"],
    ["AUTHORING_ASSET_NOT_READY", "assetNotReady"],
    ["AUTHORING_PROPOSAL_NOT_ACCEPTED", "proposalNotReady"],
    ["AUTHORING_OPERATION_CONFLICT", "invalidOperations"],
    ["UNKNOWN_CONFLICT", "invalidCommand"],
  ])("preserves the actionable export conflict %s", async (reason, message) => {
    const test = setup();
    test.client.authoring.prepareExport.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { detail: reason } },
    });
    await expect(
      test.service.enqueue(
        courseId,
        sessionId,
        { commandId: assetId, proposalIds: [assetId] },
        actor,
      ),
    ).rejects.toThrow(`courseAuthoring.errors.${message}`);
    expect(test.enqueue).not.toHaveBeenCalled();
  });
  it("retains the specific unsupported-language failure in application status", async () => {
    const test = setup();
    test.getJob.mockResolvedValue({
      data: { courseId, sessionId },
      getState: jest.fn().mockResolvedValue("failed"),
      failedReason: "adminCourseView.toast.languageNotSupported",
    });
    await expect(test.service.status(courseId, sessionId, exportId, actor)).resolves.toEqual({
      exportId,
      status: "failed",
      reason: "adminCourseView.toast.languageNotSupported",
    });
  });
  it("retains actionable Mentor rubric failures in application status", async () => {
    const test = setup();
    const reason = "adminCourseView.curriculum.lesson.aiJudge.validation.completeGuidanceRequired";
    test.getJob.mockResolvedValue({
      data: { courseId, sessionId },
      getState: jest.fn().mockResolvedValue("failed"),
      failedReason: reason,
    });
    await expect(test.service.status(courseId, sessionId, exportId, actor)).resolves.toEqual({
      exportId,
      status: "failed",
      reason,
    });
  });
  it("records ready-content acceptance without starting a second application path", async () => {
    const test = setup();
    const proposalId = "00000000-0000-4000-8000-000000000005";
    const input = {
      schemaVersion: 1 as const,
      commandId: assetId,
      action: "proposal.accept" as const,
      targetId: proposalId,
      expectedRevision: 2,
    };
    await test.service.command(courseId, sessionId, input, actor);

    expect(test.command).toHaveBeenCalledWith(courseId, sessionId, input, actor);
    expect(test.client.authoring.prepareExport).not.toHaveBeenCalled();
  });
  it("synchronizes committed mappings before preparing another export", async () => {
    const test = setup();
    test.pendingSessionReceipts.mockResolvedValue([
      { courseId, sessionId, exportId, exportHash: "a".repeat(64) },
    ]);
    await expect(
      test.service.enqueue(
        courseId,
        sessionId,
        { commandId: assetId, proposalIds: [assetId] },
        actor,
      ),
    ).rejects.toThrow("courseAuthoring.errors.receiptSynchronizationPending");
    expect(test.client.authoring.prepareExport).not.toHaveBeenCalled();
    expect(test.enqueue).toHaveBeenCalledWith(
      expect.any(String),
      "receipt",
      expect.objectContaining({ tenantId: actor.tenantId, exportId }),
      expect.objectContaining({ jobId: `receipt-${actor.tenantId}-${exportId}` }),
    );
    expect(test.applyPreparedExport).not.toHaveBeenCalled();
  });
  it("uses the proposal selection as the durable export key for repeated apply commands", async () => {
    const test = setup();
    const proposalId = "00000000-0000-4000-8000-000000000005";

    test.getJob.mockResolvedValueOnce(null);
    await test.service.enqueue(
      courseId,
      sessionId,
      { commandId: assetId, proposalIds: [proposalId] },
      actor,
    );
    await test.service.enqueue(
      courseId,
      sessionId,
      { commandId: "00000000-0000-4000-8000-000000000006", proposalIds: [proposalId] },
      actor,
    );

    const selectionId = uuidv5(
      JSON.stringify({ sessionId, proposalIds: [proposalId], omittedAssetIds: [] }),
      "d7c56648-dc67-4a51-9a91-c318311b10e7",
    );
    expect(test.client.authoring.prepareExport).toHaveBeenNthCalledWith(1, {
      sessionId,
      request: { commandId: selectionId, proposalIds: [proposalId], actorId: actor.userId },
    });
    expect(test.client.authoring.prepareExport).toHaveBeenNthCalledWith(2, {
      sessionId,
      request: { commandId: selectionId, proposalIds: [proposalId], actorId: actor.userId },
    });
    expect(test.enqueue).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      "apply",
      expect.objectContaining({ exportId }),
      expect.objectContaining({ jobId: `${actor.tenantId}-${exportId}` }),
    );
    expect(test.enqueue).toHaveBeenCalledTimes(1);
  });
  it("changes export identity when an optional asset is omitted", async () => {
    const test = setup();
    test.getJob.mockResolvedValueOnce(null);
    await test.service.enqueue(
      courseId,
      sessionId,
      { commandId: assetId, proposalIds: [assetId] },
      actor,
    );
    test.getJob.mockResolvedValueOnce(null);
    await test.service.enqueue(
      courseId,
      sessionId,
      { commandId: exportId, proposalIds: [assetId], omitOptionalAssetIds: [exportId] },
      actor,
    );
    const first = test.client.authoring.prepareExport.mock.calls[0][0].request.commandId;
    const second = test.client.authoring.prepareExport.mock.calls[1][0].request.commandId;
    expect(second).not.toBe(first);
    expect(test.client.authoring.prepareExport.mock.calls[1][0].request).toEqual(
      expect.objectContaining({ omitOptionalAssetIds: [exportId] }),
    );
  });
  it("resumes a failed export with new assessment acknowledgement", async () => {
    const test = setup();
    const updateData = jest.fn();
    const retry = jest.fn();
    const getState = jest.fn().mockResolvedValueOnce("failed").mockResolvedValue("waiting");
    test.getJob.mockResolvedValue({
      data: { courseId, sessionId, acknowledgeAssessmentChanges: false },
      failedReason: "courseAuthoring.errors.assessmentAttemptsAcknowledgementRequired",
      getState,
      updateData,
      retry,
    });
    await test.service.enqueue(
      courseId,
      sessionId,
      { commandId: assetId, proposalIds: [assetId], acknowledgeAssessmentChanges: true },
      actor,
    );
    expect(updateData).toHaveBeenCalledWith(
      expect.objectContaining({ acknowledgeAssessmentChanges: true, actor }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
    expect(test.enqueue).not.toHaveBeenCalled();
  });
  it("rejects a modified export before asset work or content application", async () => {
    const test = setup();
    await expect(test.service.process({ courseId, sessionId, exportId, actor })).rejects.toThrow(
      "courseAuthoring.errors.exportHashMismatch",
    );
    expect(test.client.authoring.downloadAsset).not.toHaveBeenCalled();
    expect(test.applyPreparedExport).not.toHaveBeenCalled();
  });
  it("reconciles a committed receipt without repeating content or paid preparation", async () => {
    const test = setup();
    test.exported.exportHash = courseAuthoringExportHash(test.exported);
    test.findReceipt.mockResolvedValue({ ...test.receipt, exportHash: test.exported.exportHash });
    await test.service.process({ courseId, sessionId, exportId, actor });
    expect(test.applyPreparedExport).not.toHaveBeenCalled();
    expect(test.client.authoring.downloadAsset).not.toHaveBeenCalled();
    expect(test.prepareUnassignedDocument).not.toHaveBeenCalled();
    expect(test.client.authoring.recordReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        receipt: expect.objectContaining({ exportId, status: "applied" }),
      }),
    );
  });
  it("does not ingest mentor material bound to another operation", async () => {
    const test = setup();
    const bytes = Buffer.from("Permitted material");
    test.exported.assets = [
      {
        assetId,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        mimeType: "text/plain",
        byteSize: bytes.length,
        revision: 1,
        required: true,
        role: "mentor_context",
        sourceVersionId: assetId,
        operationId: assetId,
        sectionIds: [],
      },
    ];
    test.exported.exportHash = courseAuthoringExportHash(test.exported);
    test.client.authoring.downloadAsset.mockResolvedValue({ assetId, revision: 1, bytes });
    await expect(test.service.process({ courseId, sessionId, exportId, actor })).rejects.toThrow(
      "courseAuthoring.errors.invalidMentorMaterial",
    );
    expect(test.prepareUnassignedDocument).not.toHaveBeenCalled();
    expect(test.applyPreparedExport).not.toHaveBeenCalled();
    expect(test.client.authoring.downloadAsset).toHaveBeenCalledWith(
      expect.objectContaining({ maxBytes: bytes.length, revision: 1 }),
    );
  });

  it.each([false, true])("prepares Mentor context (targeted brief: %s)", async (targeted) => {
    const test = setup();
    const contentOperationId = "00000000-0000-4000-8000-000000000010";
    const mentorOperationId = "00000000-0000-4000-8000-000000000011";
    const preparedDocumentId = "00000000-0000-4000-8000-000000000012";
    test.exported.operations = [
      {
        type: "lesson.create",
        operationId: contentOperationId,
        targetId: "00000000-0000-4000-8000-000000000013",
        chapterId: "00000000-0000-4000-8000-000000000014",
        language: "en",
        baselineHash: null,
        dependencies: [],
        displayOrder: 0,
        payload: {
          lessonType: "content",
          title: "Generated lesson",
          description: "<p>Generated course context.</p>",
        },
      },
      {
        type: "lesson.create",
        operationId: mentorOperationId,
        targetId: "00000000-0000-4000-8000-000000000015",
        chapterId: "00000000-0000-4000-8000-000000000014",
        language: "en",
        baselineHash: null,
        dependencies: [],
        displayOrder: 1,
        payload: {
          lessonType: "ai_mentor",
          title: "Course coach",
          description: "Practice the course skills.",
          name: "Course coach",
          configurationType: "teacher",
          configuration: {
            taskGoal: "Apply course skills.",
            openingInstruction: null,
            additionalInstructions: null,
            expertise: "Course content",
            contentScope: "The current course",
            teachingStyle: "guided_discovery",
            feedbackGuidance: null,
          },
          judgeConfiguration: {
            taskGoal: "Assess application of course skills.",
            passingThresholdPercent: 70,
            criteria: [
              {
                ref: "C1",
                title: "Applies the material",
                expectedBehavior: "Uses the course lesson content.",
                maxScore: 5,
                scoreGuidance: [
                  { score: 5, description: "Applies the lesson accurately.", example: null },
                ],
              },
            ],
            blockingErrors: [],
          },
          sourceVersionIds: [],
          avatarAssetId: null,
          preparedResourceIds: [],
        },
      },
    ];
    test.getMentorContextLessons.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000016",
        chapterId: "00000000-0000-4000-8000-000000000014",
        chapterTitle: "Existing chapter",
        title: "Existing lesson",
        description: "<p>Existing course context.</p>",
      },
    ]);
    test.prepareUnassignedMentorContextDocument.mockResolvedValue(preparedDocumentId);
    if (targeted) {
      const bytes = Buffer.from("# Relevant knowledge\nOnly the selected scenario facts.");
      test.exported.assets = [
        {
          assetId,
          revision: 1,
          required: true,
          role: "mentor_context",
          operationId: mentorOperationId,
          mimeType: "text/plain",
          byteSize: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ];
      test.client.authoring.downloadAsset.mockResolvedValue({ assetId, revision: 1, bytes });
    }
    test.exported.exportHash = courseAuthoringExportHash(test.exported);

    await test.service.process({ courseId, sessionId, exportId, actor });

    if (targeted) expect(test.getMentorContextLessons).not.toHaveBeenCalled();
    else expect(test.getMentorContextLessons).toHaveBeenCalledWith(courseId, "en", actor);
    expect(test.prepareUnassignedMentorContextDocument).toHaveBeenCalledTimes(1);
    const file = test.prepareUnassignedMentorContextDocument.mock
      .calls[0][0] as Express.Multer.File;
    const contextText = file.buffer.toString("utf8");
    expect(file.mimetype).toBe("text/plain");
    if (targeted) {
      expect(contextText).toContain("Only the selected scenario facts.");
      expect(contextText).not.toContain("Existing course context.");
      expect(test.prepareUnassignedDocument).not.toHaveBeenCalled();
    } else {
      expect(contextText).toContain("Existing course context.");
      expect(contextText).toContain("Generated course context.");
    }
    expect(test.applyPreparedExport).toHaveBeenCalledWith(
      expect.objectContaining({
        preparedDocumentIds: {
          [`${mentorOperationId}:${targeted ? "targeted-context" : "course-context"}`]: [
            preparedDocumentId,
          ],
        },
      }),
      actor,
    );
  });

  it("does not apply or record a receipt when course-context preparation fails", async () => {
    const test = setup();
    test.exported.operations = [
      {
        type: "lesson.create",
        operationId: "00000000-0000-4000-8000-000000000030",
        targetId: "00000000-0000-4000-8000-000000000031",
        chapterId: "00000000-0000-4000-8000-000000000032",
        language: "en",
        baselineHash: null,
        dependencies: [],
        displayOrder: 0,
        payload: {
          lessonType: "ai_mentor",
          title: "Course coach",
          description: "Practice the course skills.",
          name: "Course coach",
          configurationType: "teacher",
          configuration: {
            taskGoal: "Apply course skills.",
            openingInstruction: null,
            additionalInstructions: null,
            expertise: "Course content",
            contentScope: "The current course",
            teachingStyle: "guided_discovery",
            feedbackGuidance: null,
          },
          judgeConfiguration: {
            taskGoal: "Assess application of course skills.",
            passingThresholdPercent: 70,
            criteria: [
              {
                ref: "C1",
                title: "Applies the material",
                expectedBehavior: "Uses the course lesson content.",
                maxScore: 5,
                scoreGuidance: [
                  { score: 5, description: "Applies the lesson accurately.", example: null },
                ],
              },
            ],
            blockingErrors: [],
          },
          sourceVersionIds: [],
          avatarAssetId: null,
          preparedResourceIds: [],
        },
      },
    ];
    test.getMentorContextLessons.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000033",
        chapterId: "00000000-0000-4000-8000-000000000032",
        chapterTitle: "Existing chapter",
        title: "Existing lesson",
        description: "<p>Existing course context.</p>",
      },
    ]);
    const preparationError = new Error("embedding preparation failed");
    test.prepareUnassignedMentorContextDocument.mockRejectedValue(preparationError);
    test.exported.exportHash = courseAuthoringExportHash(test.exported);

    await expect(test.service.process({ courseId, sessionId, exportId, actor })).rejects.toThrow(
      preparationError,
    );

    expect(test.applyPreparedExport).not.toHaveBeenCalled();
    expect(test.client.authoring.recordReceipt).not.toHaveBeenCalled();
  });
});
