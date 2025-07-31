import { Type } from "@sinclair/typebox";

import { chapterSchema } from "src/chapter/schemas/chapter.schema";
import { baseCourseSchema } from "src/courses/schemas/createCourse.schema";
import { adminOptionSchema, adminQuestionSchema, lessonSchema } from "src/lesson/lesson.schema";

import type { Static } from "@sinclair/typebox";

const niceCourseData = Type.Intersect([
  Type.Omit(baseCourseSchema, ["categoryId"]),
  Type.Object({
    category: Type.String(),
    chapters: Type.Array(
      Type.Intersect([
        Type.Omit(chapterSchema, [
          "id",
          "lessonCount",
          "lessons",
          "completedLessonCount",
          "chapterProgress",
          "enrolled",
          "isSubmitted",
          "createdAt",
          "quizCount",
          "displayOrder",
        ]),
        Type.Object({
          lessons: Type.Array(
            Type.Intersect([
              Type.Omit(lessonSchema, [
                "id",
                "displayOrder",
                "fileS3Key",
                "fileType",
                "questions",
                "updatedAt",
              ]),
              Type.Partial(
                Type.Object({
                  questions: Type.Array(
                    Type.Intersect([
                      Type.Omit(adminQuestionSchema, ["id", "displayOrder", "options"]),
                      Type.Partial(
                        Type.Object({
                          options: Type.Array(
                            Type.Omit(adminOptionSchema, [
                              "id",
                              "displayOrder",
                              "isStudentAnswer",
                              "questionId",
                            ]),
                          ),
                        }),
                      ),
                    ]),
                  ),
                }),
              ),
              Type.Partial(
                Type.Object({
                  aiMentorInstructions: Type.String(),
                  completionConditions: Type.String(),
                }),
              ),
            ]),
          ),
        }),
      ]),
    ),
  }),
]);

export type NiceCourseData = Static<typeof niceCourseData>;
