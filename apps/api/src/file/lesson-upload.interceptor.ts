import { rm } from "node:fs/promises";

import { Injectable } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { catchError, concatMap, finalize } from "rxjs";

import { MAX_VIDEO_SIZE } from "src/file/file.constants";

import { lessonUploadStorage } from "./utils/lesson-upload";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class LessonUploadInterceptor extends FileInterceptor("file", {
  storage: lessonUploadStorage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
}) {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    const cleanup = async () => {
      if (req.file?.path) await rm(req.file.destination, { recursive: true, force: true });
    };
    try {
      const result = await super.intercept(context, next);
      return result.pipe(
        concatMap(async (value) => {
          await cleanup();
          return value;
        }),
        catchError(async (error: unknown) => {
          await cleanup();
          throw error;
        }),
        finalize(() => {
          void cleanup().catch(() => undefined);
        }),
      );
    } catch (error) {
      await cleanup();
      throw error;
    }
  }
}
