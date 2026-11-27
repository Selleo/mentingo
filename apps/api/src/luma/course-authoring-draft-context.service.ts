/** Resolves owner-only draft access and the tenant information the creation planner may use. */
import {
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HEX_COLOR_REGEX, PERMISSIONS, SUPPORTED_LANGUAGES, hasPermission } from "@repo/shared";
import { and, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { PermissionsService } from "src/permissions/permissions.service";
import { DB } from "src/storage/db/db.providers";
import { categories, settings } from "src/storage/schema";

import { CourseAuthoringDraftRepository } from "./course-authoring-draft.repository";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseAuthoringDraftContextService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly permissionsService: PermissionsService,
    private readonly courseAuthoringDraftRepository: CourseAuthoringDraftRepository,
  ) {}

  /** Requires current permissions both when opening a draft and on each use of its placeholder. */
  async authorize(actor: CurrentUserType) {
    const access = await this.permissionsService.getUserAccess(actor.userId);
    const currentActor = { ...actor, ...access };
    if (
      !hasPermission(currentActor.permissions, PERMISSIONS.COURSE_AI_GENERATION) ||
      !hasPermission(currentActor.permissions, PERMISSIONS.COURSE_CREATE)
    )
      throw new ForbiddenException("common.toast.noAccess");
    return currentActor;
  }

  /** Distinguishes a real course ID from an owner-only placeholder before producer access. */
  async access(
    courseId: string,
    sessionId: string,
    actor: CurrentUserType,
    refreshActivity = true,
  ) {
    const draft = await this.courseAuthoringDraftRepository.find(actor.tenantId, courseId);
    if (!draft) return null;
    if (draft.ownerId !== actor.userId || draft.lumaSessionId !== sessionId)
      throw new NotFoundException("courseAuthoring.errors.sessionNotFound");
    const currentActor = await this.authorize(actor);
    if (draft.expiredAt) throw new GoneException("courseAuthoring.draft.expired");
    if (draft.courseId || !refreshActivity) return { draft, actor: currentActor };
    const activeDraft = await this.courseAuthoringDraftRepository.touch(
      actor.tenantId,
      courseId,
      sessionId,
    );
    if (!activeDraft) throw new GoneException("courseAuthoring.draft.expired");
    return { draft: activeDraft, actor: currentActor };
  }

  /** Offers each category only for locales with an actual title. */
  async categories(tenantId: string) {
    const rows = await this.db
      .select({ id: categories.id, title: categories.title })
      .from(categories)
      .where(eq(categories.tenantId, tenantId))
      .orderBy(categories.id);
    return rows.flatMap((row) =>
      Object.values(SUPPORTED_LANGUAGES).flatMap((language) => {
        const title = row.title[language]?.trim();
        return title ? [{ id: row.id, title, language }] : [];
      }),
    );
  }

  /** Reads only the two tenant branding colors used as image accents. */
  async tenantPalette(tenantId: string): Promise<string[]> {
    const [row] = await this.db
      .select({
        primary: sql<string | null>`${settings.settings}->>'primaryColor'`,
        contrast: sql<string | null>`${settings.settings}->>'contrastColor'`,
      })
      .from(settings)
      .where(and(eq(settings.tenantId, tenantId), isNull(settings.userId)))
      .limit(1);
    return [...new Set([row?.primary, row?.contrast])].filter(
      (color): color is string => typeof color === "string" && HEX_COLOR_REGEX.test(color),
    );
  }
}
