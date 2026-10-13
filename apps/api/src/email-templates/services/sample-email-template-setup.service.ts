import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES, getBuiltInTemplatePublication } from "@repo/email-templates";
import {
  AUTOMATION_EVENT_KINDS,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { v5 as uuidV5 } from "uuid";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailTemplateRepository } from "../repositories/email-template.repository";

import type { UUIDType } from "src/common";

@Injectable()
export class SampleEmailTemplateSetupService implements OnApplicationBootstrap {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async onApplicationBootstrap() {
    await this.tenantDbRunnerService.runForEachTenant((tenantId) =>
      this.ensureExampleEmailTemplate(tenantId),
    );
  }

  async ensureExampleEmailTemplate(tenantId: UUIDType) {
    const publication = getBuiltInTemplatePublication(
      BUILT_IN_EMAIL_TEMPLATE_KEYS.ASSIGNMENT_WITH_DEADLINE,
    );

    await this.tenantDbRunnerService.runWithTenant(tenantId, () =>
      this.emailTemplateRepository.insertSampleEmailTemplateIfAbsent({
        id: uuidV5("email-template-example", tenantId),
        tenantId,
        event: null,
        triggerEventKind: AUTOMATION_EVENT_KINDS.USER_ASSIGNED_TO_COURSE,
        placeholders: publication.placeholders,
        name: publication.name,
        subject: publication.subject,
        content: publication.content,
        baseLanguage: publication.baseLanguage,
        availableLocales: Object.values(SUPPORTED_LANGUAGES),
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      }),
    );
  }
}
