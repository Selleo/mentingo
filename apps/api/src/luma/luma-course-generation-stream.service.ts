import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { getUiMessageText } from "@repo/shared";

import { loadAiSdk } from "src/ai/utils/ai-esm";
import { LumaCourseGenerationSyncService } from "src/luma/luma-course-generation-sync.service";
import { LumaService } from "src/luma/luma.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  CourseGenerationChatBody,
  CourseGenerationUIMessage,
  CourseGenerationUIMessageChunk,
} from "src/luma/luma.types";

@Injectable()
export class LumaCourseGenerationStreamService {
  private readonly logger = new Logger(LumaCourseGenerationStreamService.name);

  constructor(
    private readonly lumaService: LumaService,
    private readonly lumaCourseGenerationSyncService: LumaCourseGenerationSyncService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async createChatStream(data: CourseGenerationChatBody, currentUser: CurrentUserType) {
    const message = getUiMessageText(data.message).trim();

    if (!message) {
      throw new BadRequestException("common.validation.messageRequired");
    }

    const { createUIMessageStream } = await loadAiSdk();

    return createUIMessageStream<CourseGenerationUIMessage>({
      execute: async ({ writer }) => {
        await this.tenantDbRunnerService.runWithTenant(currentUser.tenantId, async () => {
          this.logger.debug(
            `course generation stream start integrationId=${data.integrationId} messageLength=${message.length}`,
          );
          const lumaResponse = await this.lumaService.chatWithCourseAgent(
            {
              integrationId: data.integrationId,
              message,
            },
            currentUser,
          );
          this.logger.debug(
            `course generation Luma response received integrationId=${data.integrationId}`,
          );

          await this.pipeLegacyFrames({
            stream: lumaResponse.data as AsyncIterable<Buffer>,
            integrationId: data.integrationId,
            currentUser,
            writer,
          });
        });
      },
      onError: (error) => {
        this.logger.error(
          `course generation stream failed integrationId=${data.integrationId}: ${this.errorMessage(error)}`,
        );
        return "courseGeneration.errors.streamFailed";
      },
    });
  }

  private async pipeLegacyFrames({
    stream,
    integrationId,
    currentUser,
    writer,
  }: {
    stream: AsyncIterable<Buffer>;
    integrationId: string;
    currentUser: CurrentUserType;
    writer: { write: (chunk: CourseGenerationUIMessageChunk) => void };
  }) {
    let syncEnqueued = false;
    let pendingCourseGeneratedFrame = "";
    let pendingFrame = "";
    const textPartId = "course-generation-text";
    let hasStartedText = false;
    let chunkCount = 0;
    let byteCount = 0;
    let textFrameCount = 0;
    let dataFrameCount = 0;
    let ignoredFrameCount = 0;

    const enqueueGeneratedCourseBundleSync = async () => {
      if (syncEnqueued) return;

      syncEnqueued = true;
      this.logger.debug(`course generation enqueue sync integrationId=${integrationId}`);
      await this.lumaCourseGenerationSyncService.enqueueGeneratedCourseBundleSync(
        integrationId,
        currentUser,
      );
    };

    const writeLegacyFrame = (frame: string) => {
      const textChunks = this.toTextChunks(frame, textPartId, hasStartedText);
      if (textChunks.length) {
        textFrameCount += 1;
        hasStartedText = true;
        for (const textChunk of textChunks) {
          if (textChunk.type === "text-delta") {
            this.logger.debug(
              `course generation text frame integrationId=${integrationId} deltaLength=${
                textChunk.delta?.length ?? 0
              } delta=${this.preview(textChunk.delta)}`,
            );
          }
          writer.write(textChunk);
        }
        return;
      }

      const dataChunks = this.toDataChunks(frame);
      if (dataChunks.length) {
        dataFrameCount += 1;
        this.logger.debug(
          `course generation data frame integrationId=${integrationId} events=${dataChunks.length}`,
        );
      } else {
        ignoredFrameCount += 1;
        this.logger.debug(
          `course generation ignored frame integrationId=${integrationId} frame=${this.preview(frame)}`,
        );
      }

      for (const dataChunk of dataChunks) {
        writer.write(dataChunk);
      }
    };

    for await (const chunk of stream) {
      chunkCount += 1;
      byteCount += chunk.byteLength;
      if (chunkCount === 1) {
        this.logger.debug(
          `course generation first bytes integrationId=${integrationId} bytes=${chunk.byteLength} preview=${this.preview(
            chunk.toString("utf8"),
          )}`,
        );
      }

      const courseGeneratedDetection = this.lumaService.hasCourseGeneratedEvent(
        chunk,
        pendingCourseGeneratedFrame,
      );
      pendingCourseGeneratedFrame = courseGeneratedDetection.pendingFrame;

      if (courseGeneratedDetection.hasCourseGeneratedEvent) {
        await enqueueGeneratedCourseBundleSync();
      }

      pendingFrame += chunk.toString("utf8");
      const frames = pendingFrame.split(/\r?\n/);
      pendingFrame = frames.pop() ?? "";

      for (const frame of frames) {
        if (frame.trim()) {
          writeLegacyFrame(frame);
        }
      }
    }

    if (pendingFrame.trim()) {
      writeLegacyFrame(pendingFrame);
    }

    const finalCourseGeneratedDetection = this.lumaService.hasCourseGeneratedEvent(
      Buffer.from("\n"),
      pendingCourseGeneratedFrame,
    );

    if (finalCourseGeneratedDetection.hasCourseGeneratedEvent) {
      await enqueueGeneratedCourseBundleSync();
    }

    if (hasStartedText) {
      writer.write({
        type: "text-end",
        id: textPartId,
      });
    }

    this.logger.debug(
      `course generation stream complete integrationId=${integrationId} chunks=${chunkCount} bytes=${byteCount} textFrames=${textFrameCount} dataFrames=${dataFrameCount} ignoredFrames=${ignoredFrameCount} syncEnqueued=${syncEnqueued}`,
    );
  }

  private toTextChunks(
    frame: string,
    textPartId: string,
    hasStartedText: boolean,
  ): CourseGenerationUIMessageChunk[] {
    if (!frame.startsWith("0:")) {
      return [];
    }

    const text = this.parseLegacyTextFrame(frame);
    if (!text) {
      return [];
    }

    const chunks: CourseGenerationUIMessageChunk[] = [];

    if (!hasStartedText) {
      chunks.push({
        type: "text-start",
        id: textPartId,
      });
    }

    chunks.push({
      type: "text-delta",
      id: textPartId,
      delta: text,
    });

    return chunks;
  }

  private toDataChunks(frame: string): CourseGenerationUIMessageChunk[] {
    if (!frame.startsWith("2:")) {
      return [];
    }

    return this.parseLegacyDataFrame(frame).map(
      (event) =>
        ({
          type: "data-courseGenerationEvent",
          data: event,
        }) as CourseGenerationUIMessageChunk,
    );
  }

  private parseLegacyTextFrame(frame: string): string {
    const payload = frame.slice(2).trim();
    if (!payload) return "";

    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === "string" ? parsed : "";
    } catch {
      return "";
    }
  }

  private parseLegacyDataFrame(frame: string): unknown[] {
    const payload = frame.slice(2).trim();
    if (!payload) return [];

    try {
      const parsed = JSON.parse(payload);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  private preview(value: string | undefined): string {
    if (!value) return "";
    return JSON.stringify(value.replace(/\s+/g, " ").slice(0, 160));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
