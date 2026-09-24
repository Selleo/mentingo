import { isPhishingRiskyActionEvent } from "@mentingo/phishing";
import { Controller, Post, Req, UnauthorizedException, RawBodyRequest } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";

import { BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { CourseService } from "src/courses/course.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { PhishingClientService } from "./phishing-client.service";
import { verifyPhishingSignature } from "./phishing-webhook.utils";
import { PhishingRepository } from "./phishing.repository";

import type { Request } from "express";
@Controller("phishing")
export class PhishingWebhookController {
  constructor(
    private readonly runner: TenantDbRunnerService,
    private readonly client: PhishingClientService,
    private readonly repository: PhishingRepository,
    private readonly courses: CourseService,
  ) {}
  @Public()
  @Post("webhook")
  async webhook(@Req() request: RawBodyRequest<Request>) {
    const event = request.body;
    if (!request.rawBody || request.rawBody.length > 2048 || !isPhishingRiskyActionEvent(event))
      throw new UnauthorizedException();
    return this.runner.runWithTenant(event.tenantId, async () => {
      const secret = await this.client.secret("PHISHING_WEBHOOK_SECRET");
      if (
        !secret ||
        !verifyPhishingSignature(
          request.rawBody!,
          secret,
          String(request.headers["x-phishing-timestamp"] ?? ""),
          String(request.headers["x-phishing-signature"] ?? ""),
        )
      )
        throw new UnauthorizedException();
      const report = await this.client.run((client) => client.reports.get(event.campaignId));
      const recipient = report.recipients.find((r) => r.userId === event.userId);
      if (!recipient || !(event.action === "clicked" ? recipient.clickedAt : recipient.submittedAt))
        throw new UnauthorizedException();
      await this.runner.transaction(async () => {
        const courseId = report.campaign.courseId;
        await this.repository.lockEnrollment(event.tenantId, courseId, event.userId);
        const [user, actor, course] = await Promise.all([
          this.repository.user(event.userId),
          this.repository.user(report.campaign.createdBy),
          this.repository.course(courseId),
        ]);
        if (!user || !actor || !course) throw new UnauthorizedException();
        const enrolled = await this.repository.enrollment(courseId, [event.userId]);
        if (enrolled.some((e) => e.status === COURSE_ENROLLMENT.ENROLLED)) return;
        await this.courses.enrollCourse(courseId, event.userId, undefined, undefined, {
          userId: actor.id,
          email: actor.email,
          tenantId: event.tenantId,
          permissions: [],
          roleSlugs: [],
        });
      });
      return new BaseResponse({ accepted: true });
    });
  }
}
