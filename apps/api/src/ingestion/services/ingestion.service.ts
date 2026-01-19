import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnsupportedMediaTypeException,
} from "@nestjs/common";

import { DatabasePg } from "src/common";
import { FileGuard } from "src/file/guards/file.guard";
import {
  ALLOWED_FILE_TYPES,
  MAX_MB_PER_FILE,
  MAX_NUM_OF_FILES,
} from "src/ingestion/ingestion.config";
import { DOCUMENT_STATUS } from "src/ingestion/ingestion.constants";
import { IngestionRepository } from "src/ingestion/repositories/ingestion.repository";
import { DocumentService } from "src/ingestion/services/document.service";
import { IngestionQueueService } from "src/ingestion/services/queue.service";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { Job } from "bullmq";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

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
    role: UserRole,
  ) {
    if (files.length > MAX_NUM_OF_FILES) {
      throw new BadRequestException("Exceeded max number of files");
    }

    for (const file of files) {
      const type = await FileGuard.getFileType(file);

      if (type?.mime && !ALLOWED_FILE_TYPES.includes(type.mime)) {
        throw new UnsupportedMediaTypeException("Incorrect file type");
      }

      if (file.size / 1024 / 1024 > MAX_MB_PER_FILE) {
        throw new BadRequestException("File size too large");
      }
    }

    const { author } = await this.ingestionRepository.findCourseAuthorByLesson(lessonId);

    if (role !== USER_ROLES.ADMIN && author !== currentUserId) {
      throw new ForbiddenException("You can only upload files to your own lessons");
    }

    const { id: aiMentorLessonId } =
      await this.ingestionRepository.findAiMentorLessonFromLesson(lessonId);

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
    currentUserRole: UserRole,
  ) {
    const { author } = await this.ingestionRepository.findCourseAuthorByLesson(lessonId);

    if (currentUserId !== author && currentUserRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenException("You are not allowed to view files for this lesson.");
    }

    return this.documentService.findAllDocumentsForLesson(lessonId);
  }

  async deleteDocumentLink(
    documentLinkId: UUIDType,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    const { author } = await this.documentService.findCourseAuthorByDocumentLinkId(documentLinkId);

    if (currentUserId !== author && currentUserRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenException("You are not allowed to view files for this lesson.");
    }

    const { lastLink } = await this.documentService.deleteDocumentIfLastLink(documentLinkId);

    if (!lastLink) await this.documentService.deleteDocumentLink(documentLinkId);

    return {
      message: "Successfully deleted document link",
    };
  }
}
