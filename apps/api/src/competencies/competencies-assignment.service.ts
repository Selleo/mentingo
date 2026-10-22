import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";
import { CourseService } from "src/courses/course.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { UserService } from "src/user/user.service";

import { CompetenciesClientService } from "./competencies-client.service";
import { CompetenciesService } from "./competencies.service";
import { CompetenciesContextRepository } from "./repositories/competencies-context.repository";

import type { CompetenciesJobData } from "./competencies.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CompetenciesAssignmentService {
  constructor(
    private readonly competenciesClientService: CompetenciesClientService,
    private readonly competenciesService: CompetenciesService,
    private readonly competenciesContextRepository: CompetenciesContextRepository,
    private readonly queueService: QueueService,
    private readonly courseService: CourseService,
    private readonly userService: UserService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}
  private async isActiveSubject(subjectId: string) {
    if (!subjectId) return false;
    const people = await this.competenciesContextRepository.people([subjectId]);
    return people.some((person) => person.id === subjectId && !person.archived);
  }
  async request(actor: CurrentUserType, id: string, requestId: string, subjectId: string) {
    if (
      !hasPermission(actor.permissions, PERMISSIONS.COURSE_ENROLLMENT) ||
      !hasPermission(actor.permissions, PERMISSIONS.COMPETENCIES_USE)
    )
      throw new ForbiddenException("auth.error.missingPermission");
    const context = await this.competenciesService.context(actor);
    if (!(await this.isActiveSubject(subjectId)))
      throw new ForbiddenException("competencies.invalidSubject");
    await this.competenciesClientService.run((client) =>
      client.execute(context, {
        operation: "assignment_result",
        id,
        subjectId,
        requestId,
        status: "pending",
      }),
    );
    const existing = await this.queueService
      .getQueue(QUEUE_NAMES.COMPETENCIES)
      .getJob(`assignment-${actor.tenantId}-${requestId}-${actor.userId}`);
    if (existing && (await existing.getState()) === "failed") {
      try {
        await existing.remove();
      } catch {
        if ((await existing.getState()) === "active") return { id };
        throw new Error("Failed competency assignment could not be replaced safely");
      }
      await this.queueService.enqueue<CompetenciesJobData>(
        QUEUE_NAMES.COMPETENCIES,
        existing.name,
        { ...existing.data, subjectId },
        { ...existing.opts, jobId: existing.id, attempts: 8 },
      );
      return { id };
    }
    await this.queueService.enqueue<CompetenciesJobData>(
      QUEUE_NAMES.COMPETENCIES,
      "assignment",
      {
        operation: "assignment",
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actionId: id,
        subjectId,
        requestId,
      },
      {
        jobId: `assignment-${actor.tenantId}-${requestId}-${actor.userId}`,
        priority: 1,
        attempts: 8,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    return { id };
  }
  async perform(actorId: string, actionId: string, requestId: string) {
    const identity = await this.competenciesContextRepository.actorIdentity(actorId);
    if (!identity) throw new ForbiddenException("competencies.invalidSubject");
    const actor: CurrentUserType = {
      ...identity,
      permissions: await this.userService.getPermissionsForRoleSlugs(
        identity.roleSlugs,
        identity.tenantId,
      ),
    };
    if (
      !hasPermission(actor.permissions, PERMISSIONS.COURSE_ENROLLMENT) ||
      !hasPermission(actor.permissions, PERMISSIONS.COMPETENCIES_USE)
    )
      throw new ForbiddenException("auth.error.missingPermission");
    const context = await this.competenciesService.context(actor);
    const action = (
      await this.competenciesClientService.run((client) => client.workspace(context))
    ).actions.find((item) => item.id === actionId);
    if (!action?.courseId || action.kind !== "course" || action.status === "cancelled")
      throw new NotFoundException("competencies.notFound");
    if (!context.canManage && !context.managedSubjectIds.includes(action.subjectId))
      throw new ForbiddenException("auth.error.missingPermission");
    if (!(await this.isActiveSubject(action.subjectId)))
      throw new ForbiddenException("competencies.invalidSubject");
    const courses = await this.competenciesContextRepository.availableCourses(
      actor,
      SUPPORTED_LANGUAGES.EN,
    );
    if (!courses.some((course) => course.id === action.courseId))
      throw new ForbiddenException("auth.error.missingPermission");
    await this.competenciesClientService.run(async (client) => {
      if (!(await client.configuration()).capabilities.competencies.enabled)
        throw new ForbiddenException("competencies.unavailable");
      await this.tenantDbRunnerService.transaction(async () => {
        await this.competenciesContextRepository.lockAssignment(action.courseId!, action.subjectId);
        if (
          !(await this.competenciesContextRepository.enrolled(action.courseId!, action.subjectId))
        )
          await this.courseService.enrollCourses(
            action.courseId!,
            { studentIds: [action.subjectId] },
            actor,
          );
      });
      if (!(await this.isActiveSubject(action.subjectId)))
        throw new ForbiddenException("competencies.invalidSubject");
      await client.execute(await this.competenciesService.context(actor), {
        operation: "assignment_result",
        id: actionId,
        subjectId: action.subjectId,
        requestId,
        status: "confirmed",
      });
    });
  }
  async failed(id: string, requestId: string, subjectId: string) {
    if (!(await this.isActiveSubject(subjectId))) return;
    await this.competenciesClientService.run((client) =>
      client.failAssignment(id, requestId, subjectId),
    );
  }
}
