import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { match } from "ts-pattern";

import { PaginatedResponse } from "src/common";
import { shouldApplyGroupManagerScope } from "src/common/permissions/group-manager-scope.utils";
import { hasPermission } from "src/common/permissions/permission.utils";

import { PhishingClientService } from "./phishing-client.service";
import { scopeRecipientGroups, withRiskRate } from "./phishing-report.utils";
import { PhishingRepository } from "./phishing.repository";
import { PHISHING_OPTION_KINDS, PHISHING_RISKY_ACTIONS } from "./phishing.schema";

import type {
  PhishingOptionQuery,
  PhishingAudience,
  CreatePhishingCampaign,
  PhishingReport,
  PhishingReportRecipient,
  PhishingReportRecipientsQuery,
} from "./phishing.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";
@Injectable()
export class PhishingService {
  constructor(
    private readonly client: PhishingClientService,
    private readonly repository: PhishingRepository,
  ) {}
  scenarios() {
    return this.client.run((client) => client.scenarios.list());
  }
  options(language: SupportedLanguages) {
    return this.client.run(() => this.repository.options(language));
  }

  searchOptions(query: PhishingOptionQuery) {
    return this.client.run(async () => {
      const options = await match(query.kind)
        .with(PHISHING_OPTION_KINDS.USERS, () => this.repository.findUserOptions(query))
        .with(PHISHING_OPTION_KINDS.GROUPS, () => this.repository.findGroupOptions(query))
        .with(PHISHING_OPTION_KINDS.COURSES, () => this.repository.findCourseOptions(query))
        .exhaustive();
      return { items: options.slice(0, 20), hasNextPage: options.length > 20 };
    });
  }

  countAudience(audience: PhishingAudience) {
    return this.client.run(async () => {
      const [result] = await this.repository.countAudience(audience);
      return result;
    });
  }
  async create(input: CreatePhishingCampaign, actor: CurrentUserType) {
    if (!hasPermission(actor.permissions, PERMISSIONS.COURSE_ENROLLMENT))
      throw new ForbiddenException("auth.error.missingPermission");
    const start = Date.parse(input.sendWindow.start),
      end = Date.parse(input.sendWindow.end);
    if (
      !input.name.trim() ||
      end < start ||
      end - start > 30 * 86400000 ||
      (start !== end && end < Date.now() - 60000)
    )
      throw new BadRequestException("phishing.invalidCampaign");
    const course = await this.repository.course(input.courseId);
    if (!course) throw new BadRequestException("phishing.invalidCourse");
    const recipients = await this.repository.recipients(input.userIds, input.groupIds);
    if (
      !recipients.length ||
      recipients.length > 10000 ||
      input.userIds.some((id) => !recipients.some((r) => r.userId === id))
    )
      throw new BadRequestException("phishing.invalidRecipients");
    return this.client.run((client) =>
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
  async list(actor: CurrentUserType) {
    const campaigns = await this.client.run((client) => client.campaigns.list());
    const scopeGroupIds = await this.reportScope(actor);
    if (scopeGroupIds === null) return campaigns;
    if (!scopeGroupIds.length) return [];
    const visible = [];
    for (const campaign of campaigns) {
      const summary = await this.client.run((client) =>
        client.reports.summary(campaign.id, { groupIds: scopeGroupIds }),
      );
      if (summary.totals.recipients) visible.push(campaign);
    }
    return visible;
  }
  cancel(id: string) {
    return this.client.run((client) => client.campaigns.cancel(id));
  }
  async report(
    id: string,
    actor: CurrentUserType,
    language: SupportedLanguages,
  ): Promise<PhishingReport> {
    const groups = await this.repository.groups(actor, language);
    const scopeGroupIds = this.scopeGroupIds(actor, groups);
    if (scopeGroupIds?.length === 0) throw new NotFoundException("phishing.notFound");
    const [summary, scenarios] = await this.client.run((client) =>
      Promise.all([
        client.reports.summary(id, { groupIds: scopeGroupIds ?? undefined }),
        client.scenarios.list(),
      ]),
    );
    if (scopeGroupIds && !summary.totals.recipients)
      throw new NotFoundException("phishing.notFound");
    const groupTotals = new Map(summary.groups.map((group) => [group.id, group.totals]));
    return {
      campaign: summary.campaign,
      riskyAction:
        scenarios.find((scenario) => scenario.id === summary.campaign.scenarioId)?.action ??
        PHISHING_RISKY_ACTIONS.SUBMITTED,
      totals: withRiskRate(summary.totals),
      groups: groups.flatMap((group) => {
        const totals = groupTotals.get(group.id);
        return totals ? [{ ...group, totals: withRiskRate(totals) }] : [];
      }),
      activity: summary.activity,
    };
  }
  async reportRecipients(
    id: string,
    actor: CurrentUserType,
    query: PhishingReportRecipientsQuery,
  ): Promise<PaginatedResponse<PhishingReportRecipient[]>> {
    const scopeGroupIds = await this.reportScope(actor);
    if (scopeGroupIds?.length === 0) throw new NotFoundException("phishing.notFound");
    const [{ recipients, pagination }, campaign] = await this.client.run((client) =>
      Promise.all([
        client.reports.recipients(id, { ...query, groupIds: scopeGroupIds ?? undefined }),
        client.campaigns.get(id),
      ]),
    );
    if (scopeGroupIds && !pagination.totalItems) {
      // An empty page must not reveal whether the campaign exists outside the manager's scope.
      const summary = await this.client.run((client) =>
        client.reports.summary(id, { groupIds: scopeGroupIds }),
      );
      if (!summary.totals.recipients) throw new NotFoundException("phishing.notFound");
    }
    const enrollments = await this.repository.enrollment(
      campaign.courseId,
      recipients.map((r) => r.userId),
    );
    const progressByUser = new Map(
      enrollments
        .filter((e) => e.status === COURSE_ENROLLMENT.ENROLLED)
        .map((e) => [e.userId, e.progress]),
    );
    return new PaginatedResponse({
      data: recipients.map((recipient) => ({
        ...scopeRecipientGroups(recipient, scopeGroupIds),
        courseStatus: progressByUser.get(recipient.userId) ?? "not_enrolled",
      })),
      pagination,
    });
  }
  /** Group ids a group manager may see, or `null` when the actor sees every recipient. */
  private async reportScope(actor: CurrentUserType) {
    if (!shouldApplyGroupManagerScope(actor, [PERMISSIONS.PHISHING_MANAGE])) return null;
    return this.scopeGroupIds(actor, await this.repository.groups(actor, "en"));
  }
  private scopeGroupIds(actor: CurrentUserType, groups: { id: string }[]) {
    return shouldApplyGroupManagerScope(actor, [PERMISSIONS.PHISHING_MANAGE])
      ? groups.map((group) => group.id)
      : null;
  }
}
