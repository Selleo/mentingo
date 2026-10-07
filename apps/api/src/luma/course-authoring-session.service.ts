/** Authorizes and proxies session, command, source, and asset operations to the authoring service. */
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { isAxiosError } from "axios";

import { FileGuard } from "src/file/guards/file.guard";

import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { toWireAuthoringOperation } from "./course-authoring-operation.mapper";
import { LumaService } from "./luma.service";
import { authoringSourceUploadResponseSchema } from "./schema/course-authoring-application.schema";
import {
  authoringSessionSchema,
  authoringSessionPageSchema,
  authoringCommandReceiptSchema,
  authoringEventsSchema,
  authoringTurnHistorySchema,
} from "./schema/course-authoring-session.schema";

import type {
  AuthoringCommandBody,
  AuthoringSessionListQuery,
  CreateAuthoringSessionBody,
  AuthoringSessionSummary,
} from "./schema/course-authoring-session.schema";
import type { AuthoringCourseContext } from "./schema/course-authoring.schema";
import type { Static, TSchema } from "@sinclair/typebox";
import type { Pagination, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
/** Owns authorization, schema validation, and producer calls for one authoring session. */
export class CourseAuthoringSessionService {
  private readonly logger = new Logger(CourseAuthoringSessionService.name);

  /** Injects the producer client and Core context authorizer. */
  constructor(
    private readonly lumaService: LumaService,
    private readonly context: CourseAuthoringContextService,
    private readonly contextBridge: CourseAuthoringContextBridgeService,
  ) {}

  /** Prepares identities and native context before creating a durable authoring session. */
  async open(courseId: UUIDType, input: CreateAuthoringSessionBody, actor: CurrentUserType) {
    await this.context.prepareBlockIdentities(courseId, input.language, actor);
    const context = await this.context.getContext(courseId, { language: input.language }, actor);
    const client = await this.lumaService.getLumaClient();
    const session = this.validate(
      authoringSessionSchema,
      await this.call(() =>
        client.authoring.createSession({
          commandId: input.commandId,
          courseId,
          actorId: actor.userId,
          language: input.language,
          context,
        }),
      ),
    );
    await this.contextBridge.bind({
      tenantId: actor.tenantId,
      courseId,
      sessionId: session.sessionId,
      actorId: actor.userId,
      language: session.language,
      cursorSequence: session.snapshotSequence,
    });
    return session;
  }

  /** Lists one server-filtered, offset-paginated page of authorized course conversations in Luma's stable activity order. */
  async list(
    courseId: UUIDType,
    actor: CurrentUserType,
    query: AuthoringSessionListQuery,
  ): Promise<{ data: AuthoringSessionSummary[]; pagination: Pagination }> {
    await this.context.authorize(courseId, actor);
    const client = await this.lumaService.getLumaClient();
    const result = this.validate(
      authoringSessionPageSchema,
      await this.call(() =>
        client.authoring.listSessions({
          courseId,
          keyword: query.keyword,
          page: query.page,
          perPage: query.perPage,
        }),
      ),
    );

    return {
      data: result.sessions,
      pagination: { totalItems: result.total, page: result.page, perPage: result.perPage },
    };
  }

  /** Loads a session after rechecking tenant and course access. */
  async get(courseId: UUIDType, sessionId: UUIDType, actor: CurrentUserType) {
    await this.context.authorize(courseId, actor);
    const client = await this.lumaService.getLumaClient();
    const snapshot = this.validate(
      authoringSessionSchema,
      await this.call(() => client.authoring.getSession({ sessionId })),
    );
    if (snapshot.courseId !== courseId) throw new ForbiddenException("common.toast.noAccess");
    return snapshot;
  }

  /** Loads an older turn page after the same course-editor authorization as the snapshot. */
  async olderTurns(
    courseId: UUIDType,
    sessionId: UUIDType,
    beforeRequestId: UUIDType,
    actor: CurrentUserType,
  ) {
    await this.context.authorize(courseId, actor);
    const client = await this.lumaService.getLumaClient();
    const page = this.validate(
      authoringTurnHistorySchema,
      await this.call(() => client.authoring.getOlderTurns({ sessionId, beforeRequestId })),
    );
    if (page.courseId !== courseId) throw new ForbiddenException("common.toast.noAccess");
    return page;
  }

  /** Reads the bounded durable event window used by websocket recovery. */
  async events(
    courseId: UUIDType,
    sessionId: UUIDType,
    afterSequence: number,
    actor: CurrentUserType,
  ) {
    await this.get(courseId, sessionId, actor);
    const client = await this.lumaService.getLumaClient();
    return this.validate(
      authoringEventsSchema.properties.data,
      await this.call(() => client.authoring.getEvents({ sessionId, afterSequence, limit: 100 })),
    );
  }

  /** Revalidates targets and baselines before forwarding a workspace command. */
  async command(
    courseId: UUIDType,
    sessionId: UUIDType,
    input: AuthoringCommandBody,
    actor: CurrentUserType,
  ) {
    const snapshot = await this.get(courseId, sessionId, actor);
    let request:
      | (NonNullable<
          Exclude<
            AuthoringCommandBody,
            { action: "proposal.review" | "proposal.regenerate.batch" }
          >["request"]
        > & {
          context?: AuthoringCourseContext;
        })
      | undefined = undefined;
    if ("request" in input && input.request) {
      const context = await this.context.getContext(
        courseId,
        {
          language: snapshot.language,
          lessonIds: input.request.targets
            .filter(
              (target) =>
                target.kind === "lesson" || target.kind === "block" || target.kind === "question",
            )
            .map((target) => target.targetId),
        },
        actor,
        input.request.targets
          .filter((target) => target.kind === "chapter")
          .map((target) => target.targetId),
      );
      const allowed = new Set([
        courseId,
        ...context.chapters.flatMap((chapter) => [
          chapter.id,
          ...chapter.lessons.map((lesson) => lesson.id),
        ]),
      ]);
      if (
        input.request.targets.some(
          (target) => !allowed.has(target.targetId) || target.language !== snapshot.language,
        )
      ) {
        throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
      }
      const targets = input.request.targets.map((target) => {
        const chapter = context.chapters.find((entry) => entry.id === target.targetId);
        const lesson = context.chapters
          .flatMap((entry) => entry.lessons)
          .find((entry) => entry.id === target.targetId);
        if (
          (target.kind === "course" && target.targetId !== courseId) ||
          (target.kind === "chapter" && !chapter) ||
          (["lesson", "block", "question"].includes(target.kind) && !lesson)
        ) {
          throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
        }
        if (
          target.kind === "block" &&
          (!target.blockIds.length ||
            target.blockIds.some((id) => !lesson?.blocks?.some((block) => block.id === id)))
        ) {
          throw new BadRequestException("courseAuthoring.errors.blockNotFound");
        }
        if (
          target.kind === "question" &&
          (!target.questionIds?.length ||
            target.questionIds.some(
              (id) => !lesson?.quiz?.questions.some((question) => question.id === id),
            ))
        )
          throw new BadRequestException("courseAuthoring.errors.questionNotFound");
        return {
          ...target,
          baselineHash: lesson?.baselineHash ?? chapter?.baselineHash ?? context.baselineHash,
        };
      });
      request = { ...input.request, targets, context };
    }
    const client = await this.lumaService.getLumaClient();
    const wireCommand = {
      ...input,
      request,
      operations:
        "operations" in input ? input.operations?.map(toWireAuthoringOperation) : undefined,
      actorId: actor.userId,
    };
    return this.validate(
      authoringCommandReceiptSchema.properties.data,
      await this.call(() =>
        client.authoring.sendCommand({
          sessionId,
          command: wireCommand as Parameters<typeof client.authoring.sendCommand>[0]["command"],
        }),
      ),
    );
  }

  /** Uploads one source file after confirming the session belongs to the course. */
  async uploadSource(
    courseId: UUIDType,
    sessionId: UUIDType,
    commandId: UUIDType,
    file: Express.Multer.File,
    actor: CurrentUserType,
  ) {
    await this.get(courseId, sessionId, actor);
    const client = await this.lumaService.getLumaClient();
    const result = await this.call(() =>
      client.authoring.uploadSource({
        sessionId,
        commandId,
        file: new File([file.buffer], file.originalname, { type: file.mimetype }),
      }),
    );
    return this.validate(authoringSourceUploadResponseSchema.properties.data, result);
  }

  /** Downloads and content-sniffs a bounded image preview for the authorized session. */
  async previewAsset(
    courseId: UUIDType,
    sessionId: UUIDType,
    assetId: UUIDType,
    revision: number,
    actor: CurrentUserType,
  ) {
    await this.get(courseId, sessionId, actor);
    const client = await this.lumaService.getLumaClient();
    const downloaded = await this.call(() =>
      client.authoring.downloadAsset({ sessionId, assetId, revision, maxBytes: 32 * 1024 * 1024 }),
    );
    const bytes = Buffer.from(downloaded.bytes);
    const detected = await FileGuard.getFileType(bytes);
    if (!detected || !ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(detected.mime))
      throw new BadRequestException("courseAuthoring.errors.assetPreviewUnsupported");
    return { bytes, mimeType: detected.mime };
  }

  /** Rejects invalid producer responses and logs field paths without copying their contents. */
  private validate<T extends TSchema>(schema: T, value: unknown): Static<T> {
    if (!Value.Check(schema, value)) {
      const invalidPaths = [...Value.Errors(schema, value)].slice(0, 5).map((error) => error.path);
      this.logger.error({ message: "Authoring producer response failed validation", invalidPaths });
      throw new BadGatewayException("courseAuthoring.errors.invalidServiceResponse");
    }
    return value;
  }

  /** Normalizes producer transport and conflict errors into stable API exceptions. */
  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isAxiosError<unknown>(error) && error.response?.status === 409) {
        const data = error.response.data;
        const detail = data && typeof data === "object" && "detail" in data ? data.detail : null;
        if (detail === "source_refresh_replacement_not_processed")
          throw new ConflictException("courseAuthoring.errors.sourceReplacementNotReady");
        if (
          typeof detail === "string" &&
          [
            "AUTHORING_SOURCE_SELECTION_REQUIRED",
            "source_refresh_old_source_not_selected",
            "source_refresh_replacement_already_selected",
            "source_refresh_override_sources_mismatch",
            "source_refresh_override_policy_mismatch",
            "source_refresh_override_section_not_selected",
          ].includes(detail)
        )
          throw new ConflictException("courseAuthoring.errors.sourceRefreshSelectionChanged");
        throw new ConflictException("courseAuthoring.errors.revisionChanged");
      }
      if (isAxiosError(error) && error.response?.status === 403)
        throw new ForbiddenException("common.toast.noAccess");
      if (isAxiosError(error) && error.response?.status === 404)
        throw new NotFoundException("courseAuthoring.errors.sessionNotFound");
      if (isAxiosError(error) && error.response?.status === 422)
        throw new BadRequestException("courseAuthoring.errors.invalidCommand");
      throw new BadGatewayException("adminCourseView.toast.lumaServiceUnavailable");
    }
  }
}
