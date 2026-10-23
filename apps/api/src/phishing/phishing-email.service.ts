import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { getBuiltInTemplatePublication, renderEmailTemplate } from "@repo/email-templates";

import { EmailService } from "src/common/emails/emails.service";
import { SettingsService } from "src/settings/settings.service";

import { PhishingClientService } from "./phishing-client.service";
import { PHISHING_EMAIL_TEMPLATES } from "./phishing-email.constants";
import { PhishingRepository } from "./phishing.repository";

import type { PhishingEmailRequest, PhishingEmailResponse } from "./phishing-email.schema";
import type { EmailTemplateBranding } from "@repo/email-templates";

@Injectable()
export class PhishingEmailService {
  constructor(
    private readonly phishingClientService: PhishingClientService,
    private readonly phishingRepository: PhishingRepository,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
  ) {}

  /** Uses core's built-in publications, translations, renderer and tenant branding. */
  async renderCampaignEmail(input: PhishingEmailRequest): Promise<PhishingEmailResponse> {
    if (!URL.canParse(input.trackingUrl)) throw new BadRequestException("phishing.invalidCampaign");

    const trackingUrl = new URL(input.trackingUrl);
    const isLocalDevelopmentUrl =
      process.env.NODE_ENV !== "production" &&
      trackingUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(trackingUrl.hostname);
    if (
      (trackingUrl.protocol !== "https:" && !isLocalDevelopmentUrl) ||
      trackingUrl.username ||
      trackingUrl.password
    )
      throw new BadRequestException("phishing.invalidCampaign");

    const report = await this.phishingClientService.run((client) =>
      client.reports.get(input.campaignId),
    );
    const recipient = report.recipients.find(({ userId }) => userId === input.userId);
    const templateKey =
      PHISHING_EMAIL_TEMPLATES[report.campaign.scenarioId as keyof typeof PHISHING_EMAIL_TEMPLATES];
    const user = await this.phishingRepository.user(input.userId);
    if (!recipient || !user || !templateKey)
      throw new UnauthorizedException("phishing.unavailable");

    const branding = await this.emailService.getDefaultEmailProperties(
      input.tenantId,
      input.userId,
    );
    const [courseTitle, tenantOrigin, logo, borderCircle] = await Promise.all([
      this.phishingRepository.courseEmailTitle(report.campaign.courseId, branding.language),
      this.phishingRepository.tenantOrigin(input.tenantId),
      this.settingsService.getPlatformLogoBuffer(),
      this.settingsService.getEmailBorderCircleBuffer(),
    ]);
    if (!courseTitle) throw new BadRequestException("phishing.invalidCourse");

    const emailBranding: EmailTemplateBranding = { ...branding };
    if (logo) emailBranding.logoUrl = "cid:logo";
    if (borderCircle) emailBranding.borderCircleUrl = "cid:border-circle";

    const publication = getBuiltInTemplatePublication(templateKey);
    const rendered = renderEmailTemplate({
      document: publication.content[branding.language]!,
      subject: publication.subject[branding.language]!,
      language: branding.language,
      variables: {
        name: user.firstName,
        course_name: courseTitle,
        course_link: input.trackingUrl,
        magic_link: input.trackingUrl,
        reset_link: input.trackingUrl,
      },
      branding: emailBranding,
    });
    const attachments: PhishingEmailResponse["attachments"] = [];
    for (const [cid, content] of [
      ["logo", logo],
      ["border-circle", borderCircle],
    ] as const) {
      if (content)
        attachments.push({
          filename: `${cid}.png`,
          content: content.toString("base64"),
          contentType: "image/png",
          cid,
          encoding: "base64",
        });
    }
    return {
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      courseUrl: `${tenantOrigin}/course/${report.campaign.courseId}`,
      attachments,
    };
  }
}
