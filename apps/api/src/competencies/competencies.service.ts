import {
  COMPETENCIES_ALLOWED_ATTACHMENT_CONTENT_TYPES,
  COMPETENCIES_MAX_ATTACHMENT_BYTES,
  type ActorContext,
  type CompetenciesCommand,
  type CompetenciesWorkspaceView,
} from "@mentingo/competencies-sdk";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";
import { FileGuard } from "src/file/guards/file.guard";
import { UserService } from "src/user/user.service";

import { CompetenciesClientService } from "./competencies-client.service";
import { CompetenciesSyncService } from "./competencies-sync.service";
import { CompetenciesContextRepository } from "./repositories/competencies-context.repository";

import type {
  CompetenciesCommandBody,
  CompetenciesConfigurationResponse,
  CompetenciesWorkspaceResponse,
  CompetencyRecordsQueryParams,
} from "./schemas/competencies.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CompetenciesService {
  constructor(
    private readonly competenciesClientService: CompetenciesClientService,
    private readonly competenciesContextRepository: CompetenciesContextRepository,
    private readonly userService: UserService,
    private readonly competenciesSyncService: CompetenciesSyncService,
  ) {}
  private async currentActor(actor: CurrentUserType): Promise<CurrentUserType> {
    const identity = await this.competenciesContextRepository.actorIdentity(actor.userId);
    if (!identity || identity.tenantId !== actor.tenantId)
      throw new ForbiddenException("auth.error.missingPermission");
    actor = {
      ...actor,
      ...identity,
      permissions: (
        await this.userService.getPermissionsForRoleSlugs(identity.roleSlugs, identity.tenantId)
      ).filter((permission) => actor.permissions.includes(permission)),
    };
    if (!hasPermission(actor.permissions, PERMISSIONS.COMPETENCIES_USE))
      throw new ForbiddenException("auth.error.missingPermission");
    return actor;
  }
  async context(
    actor: CurrentUserType,
    locale: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ): Promise<ActorContext> {
    actor = await this.currentActor(actor);
    const canManage = hasPermission(actor.permissions, PERMISSIONS.COMPETENCIES_MANAGE);
    return {
      userId: actor.userId,
      canManage,
      managedSubjectIds: (await this.competenciesContextRepository.managedSubjects(actor))
        .map((subject) => subject.id)
        .sort(),
      locale,
    };
  }
  async configuration(actor: CurrentUserType): Promise<CompetenciesConfigurationResponse> {
    const context = await this.context(actor);
    let enabled = false;
    try {
      enabled = (await this.competenciesClientService.run((client) => client.configuration()))
        .capabilities.competencies.enabled;
    } catch {
      /* Configuration must remain readable before connection. */
    }
    return {
      enabled,
      canManage: context.canManage,
      canPlan: context.canManage || context.managedSubjectIds.length > 0,
    };
  }
  async workspace(
    actor: CurrentUserType,
    language: SupportedLanguages,
    subjectId?: string,
    profileId?: string,
    teamOnly = false,
    view?: CompetenciesWorkspaceView,
  ): Promise<CompetenciesWorkspaceResponse> {
    let context = await this.context(actor, language);
    if (subjectId) {
      const [subject] = await this.competenciesContextRepository.people([subjectId]);
      if (!subject || subject.archived)
        throw new BadRequestException("competencies.invalidSubject");
    }
    let workspace = await this.competenciesClientService.run((client) =>
      client.workspace(context, subjectId, profileId, teamOnly, view),
    );
    if (
      workspace.catalog.some((definition) =>
        definition.levels.some((level) =>
          level.conditions.some((condition) =>
            ["course", "quiz", "ai-mentor"].includes(condition.kind),
          ),
        ),
      ) ||
      workspace.actions.some((action) => action.kind === "course")
    ) {
      await this.competenciesSyncService.refreshSubjects([
        ...new Set(workspace.standings.map((item) => item.subjectId)),
      ]);
      context = await this.context(actor, language);
      workspace = await this.competenciesClientService.run((client) =>
        client.workspace(context, subjectId, profileId, teamOnly, view),
      );
    }
    const visiblePeople = await this.competenciesContextRepository.people(
      context.canManage ||
        Object.values(workspace.verifiers).some((ids) => ids.includes(actor.userId))
        ? undefined
        : [
            ...new Set([
              actor.userId,
              ...context.managedSubjectIds,
              ...workspace.subjects.map((subject) => subject.id),
              ...workspace.actions.map((action) => action.ownerId),
              ...workspace.evidence.flatMap((evidence) =>
                evidence.reviewedBy
                  ? [evidence.createdBy, evidence.reviewedBy]
                  : [evidence.createdBy],
              ),
              ...workspace.revocations.map((revocation) => revocation.revokedBy),
            ]),
          ],
    );
    const people = visiblePeople.map((person) => ({
      ...person,
      canPlan:
        !person.archived && (context.canManage || context.managedSubjectIds.includes(person.id)),
    }));
    const canPlan = context.canManage || context.managedSubjectIds.length > 0;
    const currentActor = canPlan ? await this.currentActor(actor) : actor;
    const courses = canPlan
      ? await this.competenciesContextRepository.availableCourses(currentActor, language)
      : [];
    const learningResources = context.canManage
      ? await this.competenciesContextRepository.learningResources(currentActor, language)
      : [];
    return { ...workspace, people, courses, learningResources };
  }
  async records(actor: CurrentUserType, query: CompetencyRecordsQueryParams) {
    if (query.kind.startsWith("action-") && !query.actionId)
      throw new BadRequestException("competencies.invalidAction");
    const context = await this.context(actor, SUPPORTED_LANGUAGES.EN);
    const result = await this.competenciesClientService.run((client) =>
      client.records(context, {
        ...query,
        page: Number(query.page),
        pageSize: Number(query.pageSize),
      }),
    );
    const ids = [
      ...new Set([
        ...result.actions.flatMap((item) => [item.subjectId, item.ownerId]),
        ...result.evidence.flatMap((item) => [
          item.subjectId,
          item.createdBy,
          ...(item.reviewedBy ? [item.reviewedBy] : []),
        ]),
      ]),
    ];
    const people = ids.length ? await this.competenciesContextRepository.people(ids) : [];
    return {
      ...result,
      people: people.map((person) => ({
        ...person,
        canPlan:
          !person.archived && (context.canManage || context.managedSubjectIds.includes(person.id)),
      })),
    };
  }
  private async validateReferences(command: CompetenciesCommand) {
    let ids: string[] = [];
    if (command.operation === "save_competency")
      ids = command.value.levels.flatMap((level) =>
        level.conditions.flatMap((condition) =>
          ["observation", "document"].includes(condition.kind) ? (condition.verifierIds ?? []) : [],
        ),
      );
    if (command.operation === "assign_profile") ids = [command.subjectId];
    if (command.operation === "revoke_confirmation") ids = [command.subjectId];
    if (command.operation === "submit_evidence") ids = [command.value.subjectId];
    if (command.operation === "create_action")
      ids = [command.value.subjectId, command.value.ownerId];
    if (command.operation === "review_evidence") ids = [command.subjectId];
    if (command.operation === "update_action") ids = [command.subjectId, command.ownerId];
    if (command.operation === "set_condition_override") ids = [command.subjectId];
    if (ids.length) {
      const people = await this.competenciesContextRepository.people([...new Set(ids)]);
      if (ids.some((id) => !people.some((person) => person.id === id && !person.archived)))
        throw new BadRequestException("competencies.invalidSubject");
    }
    if (command.operation === "save_competency") {
      for (const condition of command.value.levels.flatMap((level) => level.conditions))
        if (
          condition.resourceId &&
          !(await this.competenciesContextRepository.learningResourceExists(
            condition.kind,
            condition.resourceId,
          ))
        )
          throw new BadRequestException("competencies.invalidResource");
    }
  }
  async execute(actor: CurrentUserType, command: CompetenciesCommandBody) {
    await this.validateReferences(command);
    const context = await this.context(actor);
    if (command.operation === "set_condition_override" && !context.canManage)
      throw new ForbiddenException("auth.error.missingPermission");
    return this.competenciesClientService.run(async (client) => client.execute(context, command));
  }
  async uploadAttachment(
    actor: CurrentUserType,
    subjectId: string,
    competencyId: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException("files.toast.invalidData");
    const subject = (await this.competenciesContextRepository.people([subjectId]))[0];
    if (!subject || subject.archived) throw new BadRequestException("competencies.invalidSubject");
    await FileGuard.validateFile(file, {
      allowedTypes: COMPETENCIES_ALLOWED_ATTACHMENT_CONTENT_TYPES,
      maxSize: COMPETENCIES_MAX_ATTACHMENT_BYTES,
    });
    return this.competenciesClientService.run(async (client) =>
      client.uploadAttachment(
        await this.context(actor),
        { subjectId, competencyId, name: file.originalname, contentType: file.mimetype },
        file.buffer,
      ),
    );
  }
  async downloadAttachment(actor: CurrentUserType, id: string) {
    const context = await this.context(actor);
    const file = await this.competenciesClientService.run((client) =>
      client.downloadAttachment(context, id),
    );
    try {
      const enabled = await this.competenciesClientService.run(
        async (client) => (await client.configuration()).capabilities.competencies.enabled,
      );
      if (!enabled || JSON.stringify(await this.context(actor)) !== JSON.stringify(context))
        throw new ForbiddenException("competencies.conflict");
      return file;
    } catch (error) {
      await file.body.cancel();
      throw error;
    }
  }
}
