import type { FixtureApiClient } from "../../api/client";
import type { CourseEntity } from "../primitives/course.factory";

export type ChapterEntity = {
  id: string;
  title: string;
};

export type CourseWorld = {
  course: CourseEntity;
  chapters: ChapterEntity[];
};

export const createCourseWithCurriculumFactory = (
  api: FixtureApiClient,
  createCourse: (input?: { title?: string }) => Promise<CourseEntity>,
) => {
  return {
    async create(input?: { courseTitle?: string; chapterTitles?: string[] }): Promise<CourseWorld> {
      const chapterTitles = input?.chapterTitles ?? ["Chapter 1", "Chapter 2"];
      const course = await createCourse({ title: input?.courseTitle });

      const chapters: ChapterEntity[] = [];
      for (const chapterTitle of chapterTitles) {
        const chapter = await api.createChapter({ courseId: course.id, title: chapterTitle });
        chapters.push(chapter);
      }

      return { course, chapters };
    },
  };
};
