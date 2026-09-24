import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_EVENTS,
  EMAIL_TEMPLATE_STATUSES,
  getEmailTemplateDefinition,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { v5 as uuidV5 } from "uuid";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailTemplateRepository } from "../repositories/email-template.repository";

import type { UUIDType } from "src/common";

@Injectable()
export class EmailTemplateExampleService implements OnApplicationBootstrap {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async onApplicationBootstrap() {
    await this.tenantRunner.runForEachTenant((tenantId) =>
      this.ensureExampleEmailTemplate(tenantId),
    );
  }

  async ensureExampleEmailTemplate(tenantId: UUIDType) {
    const definition = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.USER_ASSIGNED_TO_COURSE);
    await this.tenantRunner.runWithTenant(tenantId, () =>
      this.emailTemplateRepository.createExampleEmailTemplateIfMissing({
        id: uuidV5("email-template-example", tenantId),
        tenantId,
        event: definition.event,
        name: definition.name,
        subject: definition.subjects,
        content: definition.defaultDocuments,
        baseLanguage: definition.defaultLanguage,
        availableLocales: Object.values(SUPPORTED_LANGUAGES),
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      }),
    );
  }
}
