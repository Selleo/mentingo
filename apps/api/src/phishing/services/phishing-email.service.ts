import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { getBuiltInTemplatePublication, renderEmailTemplate } from "@repo/email-templates";

import { EmailService } from "src/common/emails/emails.service";
import { SettingsService } from "src/settings/settings.service";
import { Environment } from "src/utils/environment-validation";

import {
  PHISHING_EMAIL_INLINE_IMAGES,
  PHISHING_EMAIL_LOCAL_DEVELOPMENT_HOSTS,
  PHISHING_EMAIL_TEMPLATES,
} from "../constants/phishing-email.constants";
import { PhishingRepository } from "../repositories/phishing.repository";

import { PhishingClientService } from "./phishing-client.service";

import type { PhishingEmailScenarioId } from "../constants/phishing-email.constants";
import type { PhishingEmailRequest, PhishingEmailResponse } from "../schemas/phishing-email.schema";
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
    this.assertTrustedTrackingUrl(input.trackingUrl);

    const report = await this.phishingClientService.callPhishingPlugin((client) =>
      client.reports.get(input.campaignId),
    );
    const recipient = report.recipients.find(({ userId }) => userId === input.userId);
    const user = await this.phishingRepository.findActiveUser(input.userId);
    const scenarioId = report.campaign.scenarioId;

    if (!recipient || !user || !this.hasEmailTemplate(scenarioId))
      throw new UnauthorizedException("phishing.unavailable");

    const branding = await this.emailService.getDefaultEmailProperties(
      input.tenantId,
      input.userId,
    );

    const [courseTitle, tenantOrigin, logo, borderCircle] = await Promise.all([
      this.phishingRepository.findEnrollableCourseTitle(
        report.campaign.courseId,
        branding.language,
      ),
      this.phishingRepository.findTenantOrigin(input.tenantId),
      this.settingsService.getPlatformLogoBuffer(),
      this.settingsService.getEmailBorderCircleBuffer(),
    ]);

    if (!courseTitle) throw new BadRequestException("phishing.invalidCourse");

    const emailBranding: EmailTemplateBranding = { ...branding };
    if (logo) emailBranding.logoUrl = `cid:${PHISHING_EMAIL_INLINE_IMAGES.LOGO}`;
    if (borderCircle)
      emailBranding.borderCircleUrl = `cid:${PHISHING_EMAIL_INLINE_IMAGES.BORDER_CIRCLE}`;

    const publication = getBuiltInTemplatePublication(PHISHING_EMAIL_TEMPLATES[scenarioId]);
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

    return {
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      courseUrl: `${tenantOrigin}/course/${report.campaign.courseId}`,
      attachments: this.buildInlineImageAttachments([
        [PHISHING_EMAIL_INLINE_IMAGES.LOGO, logo],
        [PHISHING_EMAIL_INLINE_IMAGES.BORDER_CIRCLE, borderCircle],
      ]),
    };
  }

  /** Accepts only https tracking links without credentials; plain http is allowed for local development. */
  private assertTrustedTrackingUrl(trackingUrlInput: string) {
    if (!URL.canParse(trackingUrlInput)) throw new BadRequestException("phishing.invalidCampaign");

    const trackingUrl = new URL(trackingUrlInput);
    const isLocalDevelopmentUrl =
      process.env.NODE_ENV !== Environment.PRODUCTION &&
      trackingUrl.protocol === "http:" &&
      (PHISHING_EMAIL_LOCAL_DEVELOPMENT_HOSTS as readonly string[]).includes(trackingUrl.hostname);

    if (
      (trackingUrl.protocol !== "https:" && !isLocalDevelopmentUrl) ||
      trackingUrl.username ||
      trackingUrl.password
    )
      throw new BadRequestException("phishing.invalidCampaign");
  }

  private hasEmailTemplate(scenarioId: string): scenarioId is PhishingEmailScenarioId {
    return Object.prototype.hasOwnProperty.call(PHISHING_EMAIL_TEMPLATES, scenarioId);
  }

  private buildInlineImageAttachments(
    images: [cid: string, content: Buffer | null | undefined][],
  ): PhishingEmailResponse["attachments"] {
    return images.flatMap(([cid, content]) =>
      content
        ? [
            {
              filename: `${cid}.png`,
              content: content.toString("base64"),
              contentType: "image/png",
              cid,
              encoding: "base64" as const,
            },
          ]
        : [],
    );
  }
}
