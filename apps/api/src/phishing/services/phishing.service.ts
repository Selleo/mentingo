import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";
import { match } from "ts-pattern";

import { shouldApplyGroupManagerScope } from "src/common/permissions/group-manager-scope.utils";
import { hasPermission } from "src/common/permissions/permission.utils";

import {
  PHISHING_CAMPAIGN_LIMITS,
  PHISHING_OPTION_KINDS,
  PHISHING_OPTION_PAGE_SIZE,
  PHISHING_RISKY_ACTIONS,
} from "../constants/phishing.constants";
import { PhishingRepository } from "../repositories/phishing.repository";
import { scopeRecipientGroups, withRiskRate } from "../utils/phishing-report.utils";

import { PhishingClientService } from "./phishing-client.service";

import type {
  CreatePhishingCampaign,
  PhishingAudience,
  PhishingCampaign,
  PhishingCampaigns,
  PhishingOptionPage,
  PhishingOptionQuery,
  PhishingOptions,
  PhishingReport,
  PhishingReportRecipientsQuery,
  PhishingScenarios,
} from "../schemas/phishing.schema";
import type { PhishingGroupScope, PhishingReportRecipientsPage } from "../types/phishing.types";
import type { Recipient } from "@mentingo/phishing-simulation-sdk";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class PhishingService {
  constructor(
    private readonly phishingClientService: PhishingClientService,
    private readonly phishingRepository: PhishingRepository,
  ) {}

  listScenarios(): Promise<PhishingScenarios> {
    return this.phishingClientService.callPhishingPlugin((client) => client.scenarios.list());
  }

  getAllOptions(language: SupportedLanguages): Promise<PhishingOptions> {
    return this.phishingClientService.callPhishingPlugin(async () => {
      const [users, groups, courses, memberships] = await Promise.all([
        this.phishingRepository.findActiveUserOptions(),
        this.phishingRepository.findAllGroupOptions(language),
        this.phishingRepository.findAllEnrollableCourseOptions(language),
        this.phishingRepository.findGroupMemberships(),
      ]);

      const activeUserIds = new Set(users.map(({ id }) => id));

      return {
        users,
        groups: groups.map((group) => ({
          ...group,
          userIds: memberships
            .filter(({ groupId, userId }) => groupId === group.id && activeUserIds.has(userId))
            .map(({ userId }) => userId),
        })),
        courses,
      };
    });
  }

  searchOptions(query: PhishingOptionQuery): Promise<PhishingOptionPage> {
    return this.phishingClientService.callPhishingPlugin(async () => {
      const options = await match(query.kind)
        .with(PHISHING_OPTION_KINDS.USERS, () => this.phishingRepository.findUserOptions(query))
        .with(PHISHING_OPTION_KINDS.GROUPS, () => this.phishingRepository.findGroupOptions(query))
        .with(PHISHING_OPTION_KINDS.COURSES, () => this.phishingRepository.findCourseOptions(query))
        .exhaustive();

      return {
        items: options.slice(0, PHISHING_OPTION_PAGE_SIZE),
        hasNextPage: options.length > PHISHING_OPTION_PAGE_SIZE,
      };
    });
  }

  countAudience(audience: PhishingAudience) {
    return this.phishingClientService.callPhishingPlugin(() =>
      this.phishingRepository.countAudience(audience),
    );
  }

  /** Creates a campaign for active recipients; the actor must also be allowed to enroll them. */
  async createCampaign(
    input: CreatePhishingCampaign,
    actor: CurrentUserType,
  ): Promise<PhishingCampaign> {
    if (!hasPermission(actor.permissions, PERMISSIONS.COURSE_ENROLLMENT))
      throw new ForbiddenException("auth.error.missingPermission");

    this.assertValidCampaignDetails(input);

    const course = await this.phishingRepository.findEnrollableCourse(input.courseId);
    if (!course) throw new BadRequestException("phishing.invalidCourse");

    const recipients = await this.findCampaignRecipients(input.userIds, input.groupIds);
    this.assertValidRecipients(input.userIds, recipients);

    return this.phishingClientService.callPhishingPlugin((client) =>
      client.campaigns.create({
        requestId: input.requestId,
        name: input.name.trim(),
        scenarioId: input.scenarioId,
        courseId: input.courseId,
        createdBy: actor.userId,
        sendWindow: input.sendWindow,
        recipients,
      }),
    );
  }

  /** Lists every campaign, or for group managers only campaigns that reach their groups. */
  async listVisibleCampaigns(actor: CurrentUserType): Promise<PhishingCampaigns> {
    const campaigns = await this.phishingClientService.callPhishingPlugin((client) =>
      client.campaigns.list(),
    );
    const groupScope = await this.findGroupScope(actor);

    if (groupScope === null) return campaigns;
    if (!groupScope.length) return [];

    return this.phishingClientService.callPhishingPlugin(async (client) => {
      const visibleCampaigns: PhishingCampaigns = [];

      for (const campaign of campaigns) {
        const summary = await client.reports.summary(campaign.id, { groupIds: groupScope });
        if (summary.totals.recipients) visibleCampaigns.push(campaign);
      }

      return visibleCampaigns;
    });
  }

  cancelCampaign(id: string): Promise<PhishingCampaign> {
    return this.phishingClientService.callPhishingPlugin((client) => client.campaigns.cancel(id));
  }

  /** Builds a campaign report limited to the groups the actor may see. */
  async getReport(
    id: string,
    actor: CurrentUserType,
    language: SupportedLanguages,
  ): Promise<PhishingReport> {
    const groups = await this.phishingRepository.findReportGroups(actor, language);
    const groupScope = this.toGroupScope(actor, groups);
    if (groupScope?.length === 0) throw new NotFoundException("phishing.notFound");

    const [summary, scenarios] = await this.phishingClientService.callPhishingPlugin((client) =>
      Promise.all([
        client.reports.summary(id, { groupIds: groupScope ?? undefined }),
        client.scenarios.list(),
      ]),
    );
    if (groupScope && !summary.totals.recipients) throw new NotFoundException("phishing.notFound");

    const groupTotals = new Map(summary.groups.map((group) => [group.id, group.totals]));
    const scenario = scenarios.find(
      ({ id: scenarioId }) => scenarioId === summary.campaign.scenarioId,
    );

    return {
      campaign: summary.campaign,
      riskyAction: scenario?.action ?? PHISHING_RISKY_ACTIONS.SUBMITTED,
      totals: withRiskRate(summary.totals),
      groups: groups.flatMap((group) => {
        const totals = groupTotals.get(group.id);
        return totals ? [{ ...group, totals: withRiskRate(totals) }] : [];
      }),
      activity: summary.activity,
    };
  }

  /** Returns one page of campaign recipients with their course progress, scoped to the actor's groups. */
  async getReportRecipients(
    id: string,
    actor: CurrentUserType,
    query: PhishingReportRecipientsQuery,
  ): Promise<PhishingReportRecipientsPage> {
    const groupScope = await this.findGroupScope(actor);
    if (groupScope?.length === 0) throw new NotFoundException("phishing.notFound");

    const [{ recipients, pagination }, campaign] =
      await this.phishingClientService.callPhishingPlugin((client) =>
        Promise.all([
          client.reports.recipients(id, { ...query, groupIds: groupScope ?? undefined }),
          client.campaigns.get(id),
        ]),
      );
    if (groupScope && !pagination.totalItems)
      await this.assertCampaignReachesGroupScope(id, groupScope);

    const enrollments = await this.phishingRepository.findEnrollments(
      campaign.courseId,
      recipients.map(({ userId }) => userId),
    );
    const progressByUserId = new Map(
      enrollments
        .filter(({ status }) => status === COURSE_ENROLLMENT.ENROLLED)
        .map(({ userId, progress }) => [userId, progress]),
    );

    return {
      data: recipients.map((recipient) => ({
        ...scopeRecipientGroups(recipient, groupScope),
        courseStatus: progressByUserId.get(recipient.userId) ?? COURSE_ENROLLMENT.NOT_ENROLLED,
      })),
      pagination,
    };
  }

  private assertValidCampaignDetails(input: CreatePhishingCampaign) {
    const start = Date.parse(input.sendWindow.start);
    const end = Date.parse(input.sendWindow.end);
    const isScheduledWindow = start !== end;
    const endsInPast = end < Date.now() - PHISHING_CAMPAIGN_LIMITS.PAST_SEND_WINDOW_TOLERANCE_MS;

    if (
      !input.name.trim() ||
      end < start ||
      end - start > PHISHING_CAMPAIGN_LIMITS.MAX_SEND_WINDOW_MS ||
      (isScheduledWindow && endsInPast)
    )
      throw new BadRequestException("phishing.invalidCampaign");
  }

  private assertValidRecipients(requestedUserIds: string[], recipients: Recipient[]) {
    const recipientIds = new Set(recipients.map(({ userId }) => userId));

    if (
      !recipients.length ||
      recipients.length > PHISHING_CAMPAIGN_LIMITS.MAX_RECIPIENTS ||
      requestedUserIds.some((userId) => !recipientIds.has(userId))
    )
      throw new BadRequestException("phishing.invalidRecipients");
  }

  private async findCampaignRecipients(
    userIds: string[],
    groupIds: string[],
  ): Promise<Recipient[]> {
    const groupMemberIds = await this.phishingRepository.findGroupMemberUserIds(groupIds);
    const audienceIds = [...new Set([...userIds, ...groupMemberIds])];

    const [people, memberships] = await Promise.all([
      this.phishingRepository.findActiveRecipients(audienceIds),
      this.phishingRepository.findGroupMembershipsOfUsers(audienceIds),
    ]);

    return people.map((person) => ({
      ...person,
      groupIds: memberships
        .filter(({ userId }) => userId === person.userId)
        .map(({ groupId }) => groupId),
    }));
  }

  /** An empty page must not reveal whether the campaign exists outside the manager's scope. */
  private async assertCampaignReachesGroupScope(id: string, groupScope: string[]) {
    const summary = await this.phishingClientService.callPhishingPlugin((client) =>
      client.reports.summary(id, { groupIds: groupScope }),
    );

    if (!summary.totals.recipients) throw new NotFoundException("phishing.notFound");
  }

  private async findGroupScope(actor: CurrentUserType): Promise<PhishingGroupScope> {
    if (!shouldApplyGroupManagerScope(actor, [PERMISSIONS.PHISHING_MANAGE])) return null;

    const groups = await this.phishingRepository.findReportGroups(actor, SUPPORTED_LANGUAGES.EN);
    return this.toGroupScope(actor, groups);
  }

  private toGroupScope(actor: CurrentUserType, groups: { id: string }[]): PhishingGroupScope {
    if (!shouldApplyGroupManagerScope(actor, [PERMISSIONS.PHISHING_MANAGE])) return null;

    return groups.map(({ id }) => id);
  }
}
