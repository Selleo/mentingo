import { BadRequestException, Injectable } from "@nestjs/common";
import { getUiMessageText } from "@repo/shared";
import { createUIMessageStream } from "ai";

import { LumaCourseGenerationSyncService } from "src/luma/luma-course-generation-sync.service";
import { LumaService } from "src/luma/luma.service";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  CourseGenerationChatBody,
  CourseGenerationUIMessage,
  CourseGenerationUIMessageChunk,
} from "src/luma/luma.types";

@Injectable()
export class LumaCourseGenerationStreamService {
  constructor(
    private readonly lumaService: LumaService,
    private readonly lumaCourseGenerationSyncService: LumaCourseGenerationSyncService,
  ) {}

  createChatStream(data: CourseGenerationChatBody, currentUser: CurrentUserType) {
    const message = getUiMessageText(data.message).trim();

    if (!message) {
      throw new BadRequestException("common.validation.messageRequired");
    }

    return createUIMessageStream<CourseGenerationUIMessage>({
      execute: async ({ writer }) => {
        const lumaResponse = await this.lumaService.chatWithCourseAgent(
          {
            integrationId: data.integrationId,
            message,
          },
          currentUser,
        );

        await this.pipeLegacyFrames({
          stream: lumaResponse.data as AsyncIterable<Buffer>,
          integrationId: data.integrationId,
          currentUser,
          writer,
        });
      },
      onError: () => "courseGeneration.errors.streamFailed",
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

    const enqueueGeneratedCourseBundleSync = async () => {
      if (syncEnqueued) return;

      syncEnqueued = true;
      await this.lumaCourseGenerationSyncService.enqueueGeneratedCourseBundleSync(
        integrationId,
        currentUser,
      );
    };

    const writeLegacyFrame = (frame: string) => {
      const textChunks = this.toTextChunks(frame, textPartId, hasStartedText);
      if (textChunks.length) {
        hasStartedText = true;
        for (const textChunk of textChunks) {
          writer.write(textChunk);
        }
        return;
      }

      for (const dataChunk of this.toDataChunks(frame)) {
        writer.write(dataChunk);
      }
    };

    for await (const chunk of stream) {
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
}
