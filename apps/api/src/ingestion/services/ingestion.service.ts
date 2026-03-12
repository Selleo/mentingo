import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DatabasePg } from "src/common";
import { MAX_NUM_OF_FILES } from "src/ingestion/ingestion.config";
import { DOCUMENT_STATUS } from "src/ingestion/ingestion.constants";
import { IngestionRepository } from "src/ingestion/repositories/ingestion.repository";
import { DocumentService } from "src/ingestion/services/document.service";
import { IngestionQueueService } from "src/ingestion/services/queue.service";
import { PERMISSIONS, type PermissionKey } from "src/permission/permission.constants";

import type { Job } from "bullmq";
import type { UUIDType } from "src/common";

@Injectable()
export class IngestionService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly ingestionRepository: IngestionRepository,
    private readonly documentService: DocumentService,
    private readonly queueService: IngestionQueueService,
  ) {}

  async ingest(
    lessonId: UUIDType,
    files: Express.Multer.File[],
    currentUserId: UUIDType,
    permissions?: PermissionKey[],
  ) {
    if (files.length > MAX_NUM_OF_FILES) {
      throw new BadRequestException("Exceeded max number of files");
    }

    const author = await this.getLessonAuthor(lessonId);

    if (!permissions?.includes(PERMISSIONS.TENANT_MANAGE) && author !== currentUserId) {
      throw new ForbiddenException("You can only upload files to your own lessons");
    }

    const aiMentorLessonId = await this.getAiMentorLessonId(lessonId);

    const jobs: Job[] = [];

    for (const file of files) {
      const { document, sha256 } = await this.documentService.verifyIfFileExists(file);

      if (document && document.status === DOCUMENT_STATUS.FAILED) {
        await this.documentService.deleteDocument(document.id);
      } else if (document) {
        await this.documentService.assignDocumentToAiMentorLesson(document.id, aiMentorLessonId);
        continue;
      }

      const newDocument = await this.documentService.createDocument(file, sha256);

      await this.db
        .transaction(async (trx) => {
          await this.documentService.assignDocumentToAiMentorLesson(
            newDocument.id,
            aiMentorLessonId,
            trx,
          );
        })
        .catch(async (e) => {
          await this.documentService.updateDocumentStatus(
            newDocument.id,
            DOCUMENT_STATUS.FAILED,
            e,
          );
        });

      jobs.push(await this.queueService.enqueueDocumentIngestion(file, newDocument.id, sha256));
    }

    await this.queueService.waitForJobsCompletion(jobs);

    return { message: "Ingested files successfully" };
  }

  async findAllDocumentsForLesson(
    lessonId: UUIDType,
    currentUserId: UUIDType,
    permissions?: PermissionKey[],
  ) {
    const author = await this.getLessonAuthor(lessonId);

    if (currentUserId !== author && !permissions?.includes(PERMISSIONS.TENANT_MANAGE)) {
      throw new ForbiddenException("You are not allowed to view files for this lesson.");
    }

    return this.documentService.findAllDocumentsForLesson(lessonId);
  }

  async deleteDocumentLink(
    documentLinkId: UUIDType,
    currentUserId: UUIDType,
    permissions?: PermissionKey[],
  ) {
    const author = await this.getDocumentLinkAuthor(documentLinkId);

    if (currentUserId !== author && !permissions?.includes(PERMISSIONS.TENANT_MANAGE)) {
      throw new ForbiddenException("You are not allowed to view files for this lesson.");
    }

    const { lastLink } = await this.documentService.deleteDocumentIfLastLink(documentLinkId);

    if (!lastLink) await this.documentService.deleteDocumentLink(documentLinkId);

    return {
      message: "Successfully deleted document link",
    };
  }

  private async getLessonAuthor(lessonId: UUIDType): Promise<UUIDType> {
    const lesson = await this.ingestionRepository.findCourseAuthorByLesson(lessonId);
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    return lesson.author;
  }

  private async getDocumentLinkAuthor(documentLinkId: UUIDType): Promise<UUIDType> {
    const documentLink =
      await this.documentService.findCourseAuthorByDocumentLinkId(documentLinkId);
    if (!documentLink) {
      throw new NotFoundException("Document link not found");
    }

    return documentLink.author;
  }

  private async getAiMentorLessonId(lessonId: UUIDType): Promise<UUIDType> {
    const aiMentorLesson = await this.ingestionRepository.findAiMentorLessonFromLesson(lessonId);
    if (!aiMentorLesson) {
      throw new NotFoundException("AI mentor lesson not found");
    }

    return aiMentorLesson.id;
  }
}
