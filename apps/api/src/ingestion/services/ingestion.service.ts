import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { DatabasePg } from "src/common";
import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { MAX_NUM_OF_FILES } from "src/ingestion/ingestion.config";
import { IngestionRepository } from "src/ingestion/repositories/ingestion.repository";
import { DocumentService } from "src/ingestion/services/document.service";
import { IngestionProcessingService } from "src/ingestion/services/ingestion-processing.service";
import { IngestionQueueService } from "src/ingestion/services/queue.service";

import type { Job } from "bullmq";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class IngestionService {
  private static readonly INGESTION_FAILED_KEY = "ingestion.error.jobFailed";
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly ingestionRepository: IngestionRepository,
    private readonly documentService: DocumentService,
    private readonly ingestionProcessingService: IngestionProcessingService,
    private readonly queueService: IngestionQueueService,
  ) {}

  async ingest(lessonId: UUIDType, files: Express.Multer.File[], currentUser: CurrentUserType) {
    if (files.length > MAX_NUM_OF_FILES) {
      throw new BadRequestException("Exceeded max number of files");
    }

    const author = await this.getLessonAuthor(lessonId);
    if (!canUpdateCourseByAuthor(currentUser, author)) {
      throw new ForbiddenException("You can only upload files to your own lessons");
    }

    const jobs: Job[] = [];

    for (const file of files) {
      jobs.push(
        await this.queueService.enqueueDocumentIngestion(currentUser.tenantId, lessonId, file),
      );
    }

    const results = await this.queueService.waitForJobsCompletion(jobs);
    const hasFailures = results.some((result) => result.status === "rejected");
    if (hasFailures) {
      throw new InternalServerErrorException({
        message: IngestionService.INGESTION_FAILED_KEY,
      });
    }

    return { message: "Ingested files successfully" };
  }

  async ingestInline(
    lessonId: UUIDType,
    files: Express.Multer.File[],
    currentUser: CurrentUserType,
  ) {
    this.logger.log(
      `Inline ingestion started: lessonId=${lessonId}, files=${files.length}, tenantId=${currentUser.tenantId}`,
    );

    if (files.length > MAX_NUM_OF_FILES) {
      throw new BadRequestException("Exceeded max number of files");
    }

    const author = await this.getLessonAuthor(lessonId);

    if (currentUser.role !== USER_ROLES.ADMIN && author !== currentUser.userId) {
      throw new ForbiddenException("You can only upload files to your own lessons");
    }

    let failedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.logger.log(
        `Inline ingestion file start: lessonId=${lessonId}, index=${i + 1}/${files.length}, fileName=${file.originalname}`,
      );

      try {
        await this.ingestionProcessingService.processDocumentIngestion({
          tenantId: currentUser.tenantId,
          lessonId,
          file,
        });
        this.logger.log(
          `Inline ingestion file completed: lessonId=${lessonId}, index=${i + 1}/${files.length}, fileName=${file.originalname}`,
        );
      } catch (error) {
        failedCount += 1;
        this.logger.error(
          `Inline ingestion file failed: lessonId=${lessonId}, index=${i + 1}/${files.length}, fileName=${file.originalname}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    if (failedCount > 0) {
      this.logger.error(
        `Inline ingestion completed with failures: lessonId=${lessonId}, failed=${failedCount}, total=${files.length}`,
      );
      throw new InternalServerErrorException({
        message: IngestionService.INGESTION_FAILED_KEY,
      });
    }

    this.logger.log(`Inline ingestion completed: lessonId=${lessonId}, files=${files.length}`);

    return { message: "Ingested files successfully" };
  }

  async findAllDocumentsForLesson(lessonId: UUIDType, currentUser: CurrentUser) {
    const author = await this.getLessonAuthor(lessonId);
    if (!canUpdateCourseByAuthor(currentUser, author)) {
      throw new ForbiddenException("You are not allowed to view files for this lesson.");
    }

    return this.documentService.findAllDocumentsForLesson(lessonId);
  }

  async deleteDocumentLink(documentLinkId: UUIDType, currentUser: CurrentUser) {
    const author = await this.getDocumentLinkAuthor(documentLinkId);
    if (!canUpdateCourseByAuthor(currentUser, author)) {
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
}
