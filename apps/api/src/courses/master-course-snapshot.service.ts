import { Injectable } from "@nestjs/common";
import { LESSON_TYPES } from "@repo/shared";

import { MasterCourseRepository } from "src/courses/master-course.repository";
import {
  extractResourceIdsFromRichText,
  getLocalizedRichTextEntries,
} from "src/resource-library/resource-library.utils";

import type { UUIDType } from "src/common";
import type { CourseSelect, SourceSnapshot } from "src/courses/types/master-course.types";

@Injectable()
export class MasterCourseSnapshotService {
  constructor(private readonly masterCourseRepository: MasterCourseRepository) {}

  async buildSourceSnapshot(sourceCourse: CourseSelect): Promise<SourceSnapshot | null> {
    const sourceCategoryRow =
      await this.masterCourseRepository.getSourceCategoryWithBaseTitle(sourceCourse);

    if (!sourceCategoryRow) return null;

    const { baseTitle, ...sourceCategory } = sourceCategoryRow;
    const chapterRows = await this.masterCourseRepository.getSourceChapters(sourceCourse.id);
    const lessonRows = await this.masterCourseRepository.getSourceLessons(sourceCourse.id);
    const lessonIds = lessonRows.map((row) => row.id);
    const questionRows = await this.masterCourseRepository.getSourceQuestions(lessonIds);
    const questionIds = questionRows.map((row) => row.id);
    const optionRows = await this.masterCourseRepository.getSourceOptions(questionIds);
    const aiMentorRows = await this.masterCourseRepository.getSourceAiMentors(lessonIds);
    const aiMentorIds = aiMentorRows.map((row) => row.id);
    const aiMentorDocumentLinkRows =
      await this.masterCourseRepository.getSourceAiMentorDocumentLinks(aiMentorIds);
    const aiMentorDocumentIds = aiMentorDocumentLinkRows.map((row) => row.documentId);
    const aiMentorDocumentRows =
      await this.masterCourseRepository.getSourceDocuments(aiMentorDocumentIds);
    const aiMentorDocChunkRows =
      await this.masterCourseRepository.getSourceDocChunks(aiMentorDocumentIds);
    const scormLessonIds = lessonRows
      .filter((lesson) => lesson.type === LESSON_TYPES.SCORM)
      .map((lesson) => lesson.id);
    const scormPackageRows = await this.masterCourseRepository.getSourceScormPackages(
      sourceCourse.id,
      scormLessonIds,
    );
    const scormPackageIds = scormPackageRows.map((row) => row.id);
    const scormScoRows = await this.masterCourseRepository.getSourceScormScos(
      scormPackageIds,
      scormLessonIds,
    );
    const lessonResourceRows =
      await this.masterCourseRepository.getSourceLessonResources(lessonIds);
    const lessonContentResourceRows = await this.masterCourseRepository.getResourcesByIds(
      this.getLessonContentResourceIds(lessonRows),
    );
    const courseResourceRows = await this.masterCourseRepository.getSourceCourseResources(
      sourceCourse.id,
    );

    return {
      course: sourceCourse,
      category: sourceCategory,
      categoryBaseTitle: baseTitle,
      chapters: chapterRows,
      lessons: lessonRows,
      questions: questionRows,
      options: optionRows,
      aiMentors: aiMentorRows,
      aiMentorDocumentLinks: aiMentorDocumentLinkRows,
      aiMentorDocuments: aiMentorDocumentRows,
      aiMentorDocChunks: aiMentorDocChunkRows,
      scormPackages: scormPackageRows,
      scormScos: scormScoRows,
      lessonContentResources: lessonContentResourceRows,
      lessonResources: lessonResourceRows,
      courseResources: courseResourceRows,
    };
  }

  private getLessonContentResourceIds(lessons: SourceSnapshot["lessons"]): UUIDType[] {
    return [
      ...new Set(
        lessons.flatMap((lesson) =>
          getLocalizedRichTextEntries(lesson.description).flatMap(([, content]) =>
            extractResourceIdsFromRichText(content),
          ),
        ),
      ),
    ] as UUIDType[];
  }
}
