import { Injectable, Logger } from "@nestjs/common";
import { load as loadHtml } from "cheerio";

import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { createLessonResourceIdRegex } from "src/lesson/lesson-resource-references";
import { LESSON_TYPES } from "src/lesson/lesson.type";

import type { AdminLessonWithContentSchema } from "src/lesson/lesson.schema";

@Injectable()
export class CourseLessonMediaService {
  private readonly logger = new Logger(CourseLessonMediaService.name);

  constructor(private readonly fileService: FileService) {}

  /**
   * Signs lesson, question and AI mentor media for authoring, and flags video embeds that cannot
   * play because the video provider is not configured.
   */
  async decorateLessonsForAuthoring(lessons: AdminLessonWithContentSchema[]) {
    const bunnyAvailable = await this.fileService.isBunnyConfigured();

    return Promise.all(
      lessons.map(async (lesson) => this.decorateLessonWithUrlsAndErrors(lesson, bunnyAvailable)),
    );
  }

  private async decorateLessonWithUrlsAndErrors(
    lesson: AdminLessonWithContentSchema,
    bunnyAvailable: boolean,
  ) {
    let updatedLesson = this.normalizeLessonVideoEmbeds(lesson, bunnyAvailable);

    updatedLesson = await this.attachLessonFileSignedUrl(updatedLesson, bunnyAvailable);
    updatedLesson = await this.attachAiMentorAvatarUrl(updatedLesson);
    updatedLesson = await this.attachQuestionSignedUrls(updatedLesson);

    return updatedLesson;
  }

  private normalizeLessonVideoEmbeds(
    lesson: AdminLessonWithContentSchema,
    bunnyAvailable: boolean,
  ) {
    const updatedLesson = { ...lesson };

    if (updatedLesson.type !== LESSON_TYPES.CONTENT || !updatedLesson.description) {
      return updatedLesson;
    }

    if (!bunnyAvailable && updatedLesson.lessonResources?.length) {
      const updatedDescription = this.markVideoEmbedsWithErrors(
        updatedLesson.description,
        updatedLesson.lessonResources,
      );

      if (updatedDescription) {
        updatedLesson.description = updatedDescription;
      }
    }

    if (bunnyAvailable) {
      const cleanedDescription = this.clearVideoEmbedErrors(updatedLesson.description);
      if (cleanedDescription) {
        updatedLesson.description = cleanedDescription;
      }
    }

    return updatedLesson;
  }

  private async attachLessonFileSignedUrl(
    lesson: AdminLessonWithContentSchema,
    bunnyAvailable: boolean,
  ) {
    if (!lesson.fileS3Key || lesson.type !== LESSON_TYPES.CONTENT) {
      return lesson;
    }

    if (lesson.fileS3Key.startsWith("bunny-") && !bunnyAvailable) {
      return lesson;
    }

    if (lesson.fileS3Key.startsWith("https://")) {
      return lesson;
    }

    try {
      const signedUrl = await this.fileService.getFileUrl(lesson.fileS3Key);
      return { ...lesson, fileS3SignedUrl: signedUrl };
    } catch {
      return lesson;
    }
  }

  private async attachAiMentorAvatarUrl(lesson: AdminLessonWithContentSchema) {
    if (lesson.type !== LESSON_TYPES.AI_MENTOR || !lesson.aiMentor?.avatarReference) {
      return lesson;
    }

    const signedUrl = await this.fileService.getFileUrl(lesson.aiMentor.avatarReference, {
      quality: IMAGE_QUALITY.XXS,
    });
    return { ...lesson, avatarReferenceUrl: signedUrl };
  }

  private async attachQuestionSignedUrls(lesson: AdminLessonWithContentSchema) {
    if (!lesson.questions || !Array.isArray(lesson.questions)) {
      return lesson;
    }

    const questions = await Promise.all(
      lesson.questions.map(async (question) => {
        if (question.photoS3Key && !question.photoS3Key.startsWith("https://")) {
          try {
            const signedUrl = await this.fileService.getFileUrl(question.photoS3Key, {
              quality: IMAGE_QUALITY.MD,
            });
            return { ...question, photoS3SingedUrl: signedUrl };
          } catch (error) {
            this.logger.error(
              `Failed to get signed URL for question thumbnail ${question.photoS3Key}:`,
              error,
            );
          }
        }
        return question;
      }),
    );

    return { ...lesson, questions };
  }

  private markVideoEmbedsWithErrors(
    content: string,
    resources: Array<{ id: string; fileUrl?: string | null }>,
  ) {
    const $ = loadHtml(content);
    const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));

    $("[data-node-type='video']").each((_, element) => {
      const src = $(element).attr("data-src");
      if (!src) return;

      const resourceIdMatch = src.match(createLessonResourceIdRegex());
      const resourceId = resourceIdMatch?.[1];
      if (!resourceId) return;

      const resource = resourceMap.get(resourceId);
      if (!resource?.fileUrl) return;

      if (resource.fileUrl.startsWith("bunny-")) {
        $(element).attr("data-error", "true");
      }
    });

    return $.html($("body").children());
  }

  private clearVideoEmbedErrors(content: string) {
    const $ = loadHtml(content);

    $("[data-node-type='video']").each((_, element) => {
      $(element).removeAttr("data-error");
    });

    return $.html($("body").children());
  }
}
