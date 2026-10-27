import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { COURSE_ORIGIN_TYPES } from "@repo/shared";

import { processInBatches } from "src/common/utils/processInBatches";

import { COURSE_BULK_STATUS_UPDATE_BATCH_SIZE } from "../course.constants";
import { MasterCourseService } from "../master-course/master-course.service";

import { CourseAuthorRepository } from "./course-author.repository";

import type { TransferCourseOwnershipRequestBody } from "../schemas/course.schema";
import type { UUIDType, DatabasePg } from "src/common";

@Injectable()
export class CourseAuthorService {
  constructor(
    private readonly courseAuthorRepository: CourseAuthorRepository,
    private readonly masterCourseService: MasterCourseService,
  ) {}

  /** Returns the course's current author and the users who could take the course over. */
  async getCourseOwnership(courseId: UUIDType) {
    const course = await this.courseAuthorRepository.findCourseAuthorAndOrigin(courseId);

    if (!course) {
      throw new NotFoundException("adminCourseView.toast.courseNotFound");
    }

    if (course.originType === COURSE_ORIGIN_TYPES.EXPORTED) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
    }

    const currentAuthor = await this.courseAuthorRepository.findAuthorContact(course.authorId);

    if (!currentAuthor) {
      throw new NotFoundException("Course author not found");
    }

    const possibleCandidates = await this.courseAuthorRepository.findOwnershipCandidates(
      course.authorId,
    );

    return { currentAuthor, possibleCandidates };
  }

  /** Hands the course and its statistics over to one of the ownership candidates. */
  async transferCourseOwnership({ userId, courseId }: TransferCourseOwnershipRequestBody) {
    const { possibleCandidates } = await this.getCourseOwnership(courseId);

    const isCandidate = possibleCandidates.some((candidate) => candidate.id === userId);

    if (!isCandidate) {
      throw new BadRequestException("adminCourseView.toast.candidateNotAvailable");
    }

    await this.courseAuthorRepository.runInTransaction(async (trx) => {
      const authorMetadata = await this.getAuthorMetadata(userId, trx);

      await this.courseAuthorRepository.updateCourseAuthor(courseId, authorMetadata, trx);
      await this.courseAuthorRepository.updateCourseSummaryStatsAuthor(courseId, userId, trx);
      await this.courseAuthorRepository.updateCourseStudentsStatsAuthor(courseId, userId, trx);
    });

    await this.masterCourseService.queueSyncForSourceCourse(courseId, "course.author.updated");
  }

  async getAuthorMetadata(authorId: UUIDType, db?: DatabasePg) {
    const authorMetadata = await this.courseAuthorRepository.findAuthorMetadata(authorId, db);

    if (!authorMetadata) throw new NotFoundException("masterCourse.error.sourceAuthorNotFound");

    return authorMetadata;
  }

  /** Copies the author's current profile onto every course they own and syncs exported copies. */
  async refreshAuthorMetadata(authorId: UUIDType): Promise<void> {
    const authorMetadata = await this.getAuthorMetadata(authorId);
    const ownedCourseIds =
      await this.courseAuthorRepository.findOwnedNonExportedCourseIds(authorId);

    if (!ownedCourseIds.length) return;

    await this.courseAuthorRepository.updateCoursesAuthorMetadata(ownedCourseIds, authorMetadata);

    await processInBatches(
      ownedCourseIds,
      (courseId) =>
        this.masterCourseService.queueSyncForSourceCourse(courseId, "course.author.updated"),
      { batchSize: COURSE_BULK_STATUS_UPDATE_BATCH_SIZE },
    );
  }
}
