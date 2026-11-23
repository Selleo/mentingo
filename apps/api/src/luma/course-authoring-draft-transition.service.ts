/** Continues the original authoring request once the native course and receipt are durable. */
import { ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { isAxiosError } from "axios";
import { and, eq, isNull } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { users } from "src/storage/schema";

import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { CourseAuthoringDraftRepository } from "./course-authoring-draft.repository";
import { LumaService } from "./luma.service";

import type { CourseAuthoringReceiptJob } from "./course-authoring.types";

@Injectable()
export class CourseAuthoringDraftTransitionService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly luma: LumaService,
    private readonly drafts: CourseAuthoringDraftRepository,
    private readonly context: CourseAuthoringContextService,
    private readonly bridge: CourseAuthoringContextBridgeService,
  ) {}

  /** Installs native context before resuming the saved brief through an idempotent producer command. */
  async resume(data: CourseAuthoringReceiptJob, nativeCourseId: string) {
    const draft = await this.drafts.find(data.tenantId, data.courseId);
    if (draft?.courseId !== nativeCourseId || draft.lumaSessionId !== data.sessionId)
      throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
    const [owner] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.id, draft.ownerId),
          eq(users.tenantId, data.tenantId),
          isNull(users.deletedAt),
          eq(users.archived, false),
        ),
      );
    if (!owner) return;
    const actor = {
      userId: owner.id,
      email: owner.email,
      tenantId: data.tenantId,
      roleSlugs: [],
      permissions: [],
    };
    const client = await this.luma.getLumaClient();
    const session = await client.authoring.getSession({ sessionId: data.sessionId });
    if (session.courseId !== nativeCourseId || session.sessionId !== data.sessionId)
      throw new ConflictException("courseAuthoring.errors.exportIdentityConflict");
    const context = await this.context
      .getContext(nativeCourseId, { language: session.language }, actor)
      .catch((error: unknown) => {
        if (error instanceof ForbiddenException) return null;
        throw error;
      });
    if (!context) return;
    await this.bridge.bind({
      tenantId: data.tenantId,
      courseId: nativeCourseId,
      sessionId: data.sessionId,
      actorId: owner.id,
      language: session.language,
      cursorSequence: session.snapshotSequence,
    });
    await client.authoring
      .sendCommand({
        sessionId: data.sessionId,
        command: {
          schemaVersion: 1,
          commandId: uuidv5("resume-course-creation", data.exportId),
          actorId: owner.id,
          action: "request.create",
          request: {
            instruction: context.title,
            targets: [],
            context: { ...context, resumeDraftCreation: true },
          },
        },
      })
      .catch((error: unknown) => {
        // A fresh request from an authorized editor can win the handoff race.
        if (
          isAxiosError<{ detail?: string }>(error) &&
          error.response?.status === 409 &&
          error.response.data?.detail === "AUTHORING_DRAFT_ALREADY_ATTACHED"
        )
          return;
        throw error;
      });
  }
}
