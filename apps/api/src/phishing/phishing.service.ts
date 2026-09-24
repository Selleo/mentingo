import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS, type SupportedLanguages } from "@repo/shared";

import { shouldApplyGroupManagerScope } from "src/common/permissions/group-manager-scope.utils";
import { hasPermission } from "src/common/permissions/permission.utils";

import { PhishingClientService } from "./phishing-client.service";
import { filterPhishingRecipients, phishingTotals } from "./phishing-report.utils";
import { PhishingRepository } from "./phishing.repository";

import type { CreatePhishingCampaign, PhishingReport } from "./phishing.schema";
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
    if (!shouldApplyGroupManagerScope(actor, [PERMISSIONS.PHISHING_MANAGE])) return campaigns;
    const groups = await this.repository.groups(actor, "en");
    if (!groups.length) return [];
    const visible = [];
    for (const campaign of campaigns) {
      const report = await this.client.run((client) => client.reports.get(campaign.id));
      if (
        filterPhishingRecipients(
          report.recipients,
          groups.map((g) => g.id),
        ).length
      )
        visible.push(campaign);
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
    const report = await this.client.run((client) => client.reports.get(id));
    const groups = await this.repository.groups(actor, language);
    const scoped = shouldApplyGroupManagerScope(actor, [PERMISSIONS.PHISHING_MANAGE]);
    const recipients = filterPhishingRecipients(
      report.recipients,
      scoped ? groups.map((g) => g.id) : null,
    );
    if (scoped && !recipients.length) throw new NotFoundException("phishing.notFound");
    const enrollments = await this.repository.enrollment(
      report.campaign.courseId,
      recipients.map((r) => r.userId),
    );
    return {
      campaign: report.campaign,
      recipients: recipients.map((r) => {
        const enrollment = enrollments.find(
          (e) => e.userId === r.userId && e.status === COURSE_ENROLLMENT.ENROLLED,
        );
        return { ...r, courseStatus: enrollment?.progress ?? "not_enrolled" };
      }),
      totals: phishingTotals(recipients),
      groups: groups
        .map((g) => ({
          ...g,
          totals: phishingTotals(recipients.filter((r) => r.groupIds.includes(g.id))),
        }))
        .filter((g) => g.totals.recipients > 0),
    };
  }
}
