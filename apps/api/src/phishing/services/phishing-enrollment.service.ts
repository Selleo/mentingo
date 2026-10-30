import { Injectable, UnauthorizedException } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { match } from "ts-pattern";

import { CourseService } from "src/courses/course.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { PHISHING_RISKY_ACTIONS } from "../constants/phishing.constants";
import { PhishingRepository } from "../repositories/phishing.repository";

import { PhishingClientService } from "./phishing-client.service";

import type { RecipientResult, RiskyActionEvent } from "@mentingo/phishing-simulation-sdk";

@Injectable()
export class PhishingEnrollmentService {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly phishingClientService: PhishingClientService,
    private readonly phishingRepository: PhishingRepository,
    private readonly courseService: CourseService,
  ) {}

  /**
   * Enrolls a recipient in the campaign's course once the plugin's own report confirms the risky
   * action. Safe to call again for webhook retries: an enrolled recipient is left as is.
   */
  async enrollRecipientAfterRiskyAction(event: RiskyActionEvent) {
    const report = await this.phishingClientService.callPhishingPlugin((client) =>
      client.reports.get(event.campaignId),
    );
    const recipient = report.recipients.find(({ userId }) => userId === event.userId);

    if (!recipient || !this.hasRecordedRiskyAction(recipient, event.action))
      throw new UnauthorizedException("phishing.unavailable");

    const courseId = report.campaign.courseId;

    await this.tenantDbRunnerService.transaction(async () => {
      await this.phishingRepository.lockRecipientEnrollment(event.tenantId, courseId, event.userId);

      const [user, campaignCreator, course] = await Promise.all([
        this.phishingRepository.findActiveUser(event.userId),
        this.phishingRepository.findActiveUser(report.campaign.createdBy),
        this.phishingRepository.findEnrollableCourse(courseId),
      ]);

      if (!user || !campaignCreator || !course)
        throw new UnauthorizedException("phishing.unavailable");

      const enrollments = await this.phishingRepository.findEnrollments(courseId, [event.userId]);
      if (enrollments.some(({ status }) => status === COURSE_ENROLLMENT.ENROLLED)) return;

      await this.courseService.enrollCourse(courseId, event.userId, undefined, undefined, {
        userId: campaignCreator.id,
        email: campaignCreator.email,
        tenantId: event.tenantId,
        permissions: [],
        roleSlugs: [],
      });
    });
  }

  private hasRecordedRiskyAction(recipient: RecipientResult, action: RiskyActionEvent["action"]) {
    return match(action)
      .with(PHISHING_RISKY_ACTIONS.CLICKED, () => Boolean(recipient.clickedAt))
      .with(PHISHING_RISKY_ACTIONS.SUBMITTED, () => Boolean(recipient.submittedAt))
      .exhaustive();
  }
}
