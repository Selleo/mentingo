import { ForbiddenException } from "@nestjs/common";

import { PERMISSIONS } from "src/permission/permission.constants";

import { IngestionService } from "../ingestion.service";

import type { UUIDType } from "src/common";

describe("IngestionService authorization", () => {
  const lessonId = "lesson-id" as UUIDType;
  const authorId = "author-id" as UUIDType;
  const otherUserId = "other-user-id" as UUIDType;
  const documentLinkId = "doc-link-id" as UUIDType;

  const setup = () => {
    const ingestionRepository = {
      findCourseAuthorByLesson: jest.fn(async () => ({ author: authorId })),
      findAiMentorLessonFromLesson: jest.fn(async () => ({ id: "ai-lesson-id" as UUIDType })),
    };

    const documentService = {
      verifyIfFileExists: jest.fn(),
      deleteDocument: jest.fn(),
      assignDocumentToAiMentorLesson: jest.fn(),
      createDocument: jest.fn(),
      updateDocumentStatus: jest.fn(),
      findAllDocumentsForLesson: jest.fn(async () => []),
      findCourseAuthorByDocumentLinkId: jest.fn(async () => ({ author: authorId })),
      deleteDocumentIfLastLink: jest.fn(async () => ({ lastLink: false })),
      deleteDocumentLink: jest.fn(),
    };

    const queueService = {
      enqueueDocumentIngestion: jest.fn(),
      waitForJobsCompletion: jest.fn(async () => undefined),
    };

    return {
      service: new IngestionService(
        { transaction: async (cb: any) => cb({}) } as any,
        ingestionRepository as any,
        documentService as any,
        queueService as any,
      ),
      ingestionRepository,
      documentService,
    };
  };

  it("rejects ingest for non-owner without tenant-manage permission", async () => {
    const { service } = setup();

    await expect(service.ingest(lessonId, [], otherUserId, [])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows ingest for non-owner with tenant-manage permission", async () => {
    const { service } = setup();

    await expect(
      service.ingest(lessonId, [], otherUserId, [PERMISSIONS.TENANT_MANAGE]),
    ).resolves.toEqual({ message: "Ingested files successfully" });
  });

  it("rejects list documents for non-owner without tenant-manage permission", async () => {
    const { service } = setup();

    await expect(service.findAllDocumentsForLesson(lessonId, otherUserId, [])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows list documents for non-owner with tenant-manage permission", async () => {
    const { service } = setup();

    await expect(
      service.findAllDocumentsForLesson(lessonId, otherUserId, [PERMISSIONS.TENANT_MANAGE]),
    ).resolves.toEqual([]);
  });

  it("rejects delete document link for non-owner without tenant-manage permission", async () => {
    const { service } = setup();

    await expect(service.deleteDocumentLink(documentLinkId, otherUserId, [])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
