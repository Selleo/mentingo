import {
  COMPETENCIES_ALLOWED_ATTACHMENT_CONTENT_TYPES,
  COMPETENCIES_MAX_ATTACHMENT_BYTES,
  CONDITION_KINDS,
  type ActorContext,
  type CompetenciesCommand,
  type CompetencySubjectWorkspace,
} from "@mentingo/competencies-sdk";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";
import { FileGuard } from "src/file/guards/file.guard";
import { UserService } from "src/user/user.service";

import { CompetenciesClientService } from "./competencies-client.service";
import { CompetenciesPeopleSyncService } from "./competencies-people-sync.service";
import { CompetenciesSyncService } from "./competencies-sync.service";
import {
  COMPETENCIES_BOOLEAN_QUERY_VALUES,
  COMPETENCIES_COMMAND_OPERATIONS,
} from "./competencies.constants";
import { CompetenciesContextRepository } from "./repositories/competencies-context.repository";
import { getCommandSubjectIds } from "./utils/competencies-command.utils";
import { normalizePageQuery, normalizeCategoryFilter } from "./utils/competencies-query.utils";
import {
  getWorkspaceContributorIds,
  hasCourseConditions,
} from "./utils/competencies-workspace.utils";

import type {
  CompetenciesCommandBody,
  CompetenciesConfigurationResponse,
  CompetencyCatalogQuery,
  CompetencyCategoriesQuery,
  CompetencyDocumentsQuery,
  CompetencyMatrixQuery,
  CompetencyOptionsResponse,
  CompetencyPeopleQuery,
  CompetencyProfilesQuery,
  CompetencyReviewsQuery,
  CompetencySubjectQuery,
  CompetencySubjectResponse,
} from "./schemas/competencies.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CompetenciesService {
  constructor(
    private readonly competenciesClientService: CompetenciesClientService,
    private readonly competenciesContextRepository: CompetenciesContextRepository,
    private readonly userService: UserService,
    private readonly competenciesSyncService: CompetenciesSyncService,
    private readonly competenciesPeopleSyncService: CompetenciesPeopleSyncService,
  ) {}

  private async resolveAuthorizedActor(actor: CurrentUserType): Promise<CurrentUserType> {
    const identity = await this.competenciesContextRepository.findActorIdentity(actor.userId);
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

  async buildActorContext(
    actor: CurrentUserType,
    locale: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ): Promise<ActorContext> {
    actor = await this.resolveAuthorizedActor(actor);
    return {
      userId: actor.userId,
      canManage: hasPermission(actor.permissions, PERMISSIONS.COMPETENCIES_MANAGE),
      managedSubjectIds: await this.getManagedSubjectIds(actor),
      locale,
    };
  }

  private async getManagedSubjectIds(actor: CurrentUserType): Promise<string[]> {
    const canReadTeam =
      hasPermission(actor.permissions, PERMISSIONS.COMPETENCIES_MANAGE) ||
      hasPermission(actor.permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ);
    if (!canReadTeam) return [];

    const subjects = await this.competenciesContextRepository.findManagedSubjects(actor);
    return subjects.map(({ id }) => id).sort();
  }

  async getConfiguration(actor: CurrentUserType): Promise<CompetenciesConfigurationResponse> {
    const context = await this.buildActorContext(actor);
    let enabled = false;
    try {
      enabled = (
        await this.competenciesClientService.requestWithClient((client) => client.configuration())
      ).capabilities.competencies.enabled;
    } catch {
      /* Configuration must remain readable before connection. */
    }
    return {
      enabled,
      canManage: context.canManage,
      canPlan: context.canManage || context.managedSubjectIds.length > 0,
    };
  }

  async getSummary(actor: CurrentUserType) {
    const context = await this.buildActorContext(actor);
    await this.competenciesPeopleSyncService.syncTenantPeopleIfStale();
    return this.competenciesClientService.requestWithClient((client) => client.summary(context));
  }

  async getCategories(actor: CurrentUserType, query: CompetencyCategoriesQuery) {
    const context = await this.buildActorContext(actor);
    return this.competenciesClientService.requestWithClient((client) =>
      client.categories(context, normalizePageQuery(query)),
    );
  }

  async getCatalog(actor: CurrentUserType, query: CompetencyCatalogQuery) {
    const context = await this.buildActorContext(actor);
    return this.competenciesClientService.requestWithClient((client) =>
      client.catalog(context, {
        ...normalizePageQuery(query),
        categoryId: normalizeCategoryFilter(query.categoryId),
        archived: query.archived === COMPETENCIES_BOOLEAN_QUERY_VALUES.TRUE,
      }),
    );
  }

  async getProfiles(actor: CurrentUserType, query: CompetencyProfilesQuery) {
    const context = await this.buildActorContext(actor);
    return this.competenciesClientService.requestWithClient((client) =>
      client.profiles(context, { ...normalizePageQuery(query), competencyId: query.competencyId }),
    );
  }

  async getPeople(actor: CurrentUserType, query: CompetencyPeopleQuery) {
    const context = await this.buildActorContext(actor);
    await this.competenciesPeopleSyncService.syncTenantPeopleIfStale();
    const page = await this.competenciesClientService.requestWithClient((client) =>
      client.people(context, {
        ...normalizePageQuery(query),
        profileId: query.profileId,
        readiness: query.readiness,
        teamOnly: query.teamOnly === COMPETENCIES_BOOLEAN_QUERY_VALUES.TRUE,
      }),
    );
    const profilePictures = await this.getProfilePictureUrls(page.data.map((person) => person.id));
    return {
      ...page,
      data: page.data.map((person) => ({
        ...person,
        profilePictureUrl: profilePictures.get(person.id) ?? null,
      })),
    };
  }

  async getMatrix(actor: CurrentUserType, query: CompetencyMatrixQuery) {
    const context = await this.buildActorContext(actor);
    await this.competenciesPeopleSyncService.syncTenantPeopleIfStale();
    return this.competenciesClientService.requestWithClient((client) =>
      client.matrix(context, {
        ...normalizePageQuery(query),
        profileId: query.profileId,
        teamOnly: query.teamOnly === COMPETENCIES_BOOLEAN_QUERY_VALUES.TRUE,
      }),
    );
  }

  async getReviews(actor: CurrentUserType, query: CompetencyReviewsQuery) {
    const context = await this.buildActorContext(actor);
    await this.competenciesPeopleSyncService.syncTenantPeopleIfStale();
    const page = await this.competenciesClientService.requestWithClient((client) =>
      client.reviews(context, {
        ...normalizePageQuery(query),
        status: query.status,
        competencyId: query.competencyId,
      }),
    );
    const profilePictures = await this.getProfilePictureUrls(
      page.data.map((item) => item.subjectId),
    );
    return {
      ...page,
      data: page.data.map((item) => ({
        ...item,
        subjectProfilePictureUrl: profilePictures.get(item.subjectId) ?? null,
      })),
    };
  }

  private async getProfilePictureUrls(subjectIds: string[]): Promise<Map<string, string | null>> {
    if (!subjectIds.length) return new Map();
    const people = await this.competenciesContextRepository.findPeople([...new Set(subjectIds)]);
    const profilePictures = await Promise.all(
      people.map(
        async ({ id, avatarReference }) =>
          [
            id,
            avatarReference
              ? await this.userService.getUsersProfilePictureUrl(avatarReference)
              : null,
          ] as const,
      ),
    );
    return new Map(profilePictures);
  }

  async getSubjectDocuments(
    actor: CurrentUserType,
    subjectId: string,
    query: CompetencyDocumentsQuery,
  ) {
    const context = await this.buildActorContext(actor);
    const { page, perPage } = normalizePageQuery(query);
    return this.competenciesClientService.requestWithClient((client) =>
      client.documents(context, { subjectId, page, perPage }),
    );
  }

  /**
   * One person's competencies. Course completions are reconciled first when any shown competency
   * depends on a course, so the standings never lag behind Mentingo.
   */
  async getSubjectCompetencies(
    actor: CurrentUserType,
    subjectId: string,
    query: CompetencySubjectQuery,
  ): Promise<CompetencySubjectResponse> {
    const [subject] = await this.competenciesContextRepository.findPeople([subjectId]);
    if (!subject || subject.archived) throw new BadRequestException("competencies.invalidSubject");
    const context = await this.buildActorContext(actor);
    await this.competenciesPeopleSyncService.syncSubjectPeople([subjectId]);
    const workspace = await this.getReconciledSubjectWorkspace(context, subjectId, query);
    const people = await this.getWorkspaceContributors(workspace);
    const profilePictureUrl = subject.avatarReference
      ? await this.userService.getUsersProfilePictureUrl(subject.avatarReference)
      : null;

    return {
      ...workspace,
      person: workspace.person ? { ...workspace.person, profilePictureUrl } : null,
      canPlan: context.canManage || context.managedSubjectIds.includes(subjectId),
      people,
    };
  }

  private async getReconciledSubjectWorkspace(
    context: ActorContext,
    subjectId: string,
    query: CompetencySubjectQuery,
  ): Promise<CompetencySubjectWorkspace> {
    const workspace = await this.fetchSubjectWorkspace(context, subjectId, query);
    if (!hasCourseConditions(workspace)) return workspace;

    await this.competenciesSyncService.reconcileSubjectLearningFacts([subjectId]);
    return this.fetchSubjectWorkspace(context, subjectId, query);
  }

  private fetchSubjectWorkspace(
    context: ActorContext,
    subjectId: string,
    query: CompetencySubjectQuery,
  ): Promise<CompetencySubjectWorkspace> {
    return this.competenciesClientService.requestWithClient((client) =>
      client.subject(context, { subjectId, profileId: query.profileId }),
    );
  }

  private async getWorkspaceContributors(
    workspace: CompetencySubjectWorkspace,
  ): Promise<CompetencySubjectResponse["people"]> {
    const contributorIds = getWorkspaceContributorIds(workspace);
    if (!contributorIds.length) return [];

    const contributors = await this.competenciesContextRepository.findPeople(contributorIds);
    return contributors.map(({ id, name }) => ({ id, name }));
  }

  /** Courses and people administrators choose from when defining competency conditions. */
  async getDefinitionOptions(
    actor: CurrentUserType,
    language: SupportedLanguages,
  ): Promise<CompetencyOptionsResponse> {
    const context = await this.buildActorContext(actor, language);
    if (!context.canManage) throw new ForbiddenException("auth.error.missingPermission");
    const [courses, people] = await Promise.all([
      this.competenciesContextRepository.findAvailableCourses(
        await this.resolveAuthorizedActor(actor),
        language,
      ),
      this.competenciesContextRepository.findPeople(),
    ]);
    return {
      courses,
      people: people.filter((person) => !person.archived).map(({ id, name }) => ({ id, name })),
    };
  }

  async executeCompetenciesCommand(actor: CurrentUserType, command: CompetenciesCommandBody) {
    await this.validateCommandReferences(command);
    const context = await this.buildActorContext(actor);
    if (
      command.operation === COMPETENCIES_COMMAND_OPERATIONS.SET_CONDITION_OVERRIDE &&
      !context.canManage
    )
      throw new ForbiddenException("auth.error.missingPermission");
    await this.competenciesPeopleSyncService.syncSubjectPeople(getCommandSubjectIds(command));
    return this.competenciesClientService.requestWithClient((client) =>
      client.execute(context, command),
    );
  }

  async uploadAttachment(
    actor: CurrentUserType,
    subjectId: string,
    competencyId: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException("files.toast.invalidData");
    const [subject] = await this.competenciesContextRepository.findPeople([subjectId]);
    if (!subject || subject.archived) throw new BadRequestException("competencies.invalidSubject");
    await FileGuard.validateFile(file, {
      allowedTypes: COMPETENCIES_ALLOWED_ATTACHMENT_CONTENT_TYPES,
      maxSize: COMPETENCIES_MAX_ATTACHMENT_BYTES,
    });
    const context = await this.buildActorContext(actor);
    return this.competenciesClientService.requestWithClient((client) =>
      client.uploadAttachment(
        context,
        { subjectId, competencyId, name: file.originalname, contentType: file.mimetype },
        file.buffer,
      ),
    );
  }

  async downloadAttachment(actor: CurrentUserType, id: string) {
    const context = await this.buildActorContext(actor);
    const file = await this.competenciesClientService.requestWithClient((client) =>
      client.downloadAttachment(context, id),
    );
    try {
      const enabled = await this.competenciesClientService.requestWithClient(
        async (client) => (await client.configuration()).capabilities.competencies.enabled,
      );
      if (
        !enabled ||
        JSON.stringify(await this.buildActorContext(actor)) !== JSON.stringify(context)
      )
        throw new ForbiddenException("competencies.conflict");
      return file;
    } catch (error) {
      await file.body.cancel();
      throw error;
    }
  }

  private async validateCommandReferences(command: CompetenciesCommand) {
    const ids = [...new Set(getCommandSubjectIds(command))];
    if (ids.length) {
      const people = await this.competenciesContextRepository.findPeople(ids);
      if (ids.some((id) => !people.some((person) => person.id === id && !person.archived)))
        throw new BadRequestException("competencies.invalidSubject");
    }
    if (command.operation !== COMPETENCIES_COMMAND_OPERATIONS.SAVE_COMPETENCY) return;
    for (const condition of command.value.levels.flatMap((level) => level.conditions))
      if (
        condition.kind === CONDITION_KINDS.COURSE &&
        (!condition.resourceId ||
          !(await this.competenciesContextRepository.courseExists(condition.resourceId)))
      )
        throw new BadRequestException("competencies.invalidResource");
  }
}
