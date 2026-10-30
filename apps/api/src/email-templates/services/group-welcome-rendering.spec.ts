import { getBuiltInTemplatePublication, type EmailTemplateDocument } from "@repo/email-templates";

import { createUserNotificationEvent } from "src/automation-execution/utils/create-user-notification-event";
import { findAutomationEventDefinition } from "src/automations/catalog/automation-event-catalog";
import { resolveAutomationMappings } from "src/automations/mappers/automation-mapping";

import { EmailTemplateRenderingService } from "./email-template-rendering.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateAssetService } from "./email-template-asset.service";
import type { EmailTemplateRepository } from "../repositories/email-template.repository";
import type { AutomationPlaceholderMappings } from "@repo/shared";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

it("renders a group-specific welcome using the new member's public email variables", async () => {
  const event = findAutomationEventDefinition("user_assigned_to_group")!;
  const notification = createUserNotificationEvent({
    kind: event.kind,
    user: { id: "member", firstName: "Alex", lastName: "Morgan", email: "alex@example.com" },
    language: "en",
    eventFields: { group_id: "group", group_name: "Sales <Europe>" },
  });
  const publication = getBuiltInTemplatePublication("welcome");
  publication.subject = { en: "Welcome {{ user_first_name }} to {{ group_name }}" };
  publication.content = {
    en: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "text",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "{{ user_first_name }} {{ user_last_name }} ({{ user_email }}): {{ group_name }} [{{ group_id }}]",
                },
              ],
            },
          ],
        },
      ],
    },
  };
  publication.placeholders = event.providedVariables.map((variable) => ({
    name: variable.key,
    label: variable.label,
    type: "string" as const,
    required: true,
    sampleValue: "Sample",
  }));
  const mappings: AutomationPlaceholderMappings = Object.fromEntries(
    event.providedVariables.map((variable) => [
      variable.key,
      { type: "event_field", field: variable.key },
    ]),
  );
  const service = new EmailTemplateRenderingService(
    {} as EmailTemplateRepository,
    new EmailTemplateValidationService(),
    {
      resolveEmailTemplateAssets: async (document: EmailTemplateDocument) => ({
        document,
        attachments: [],
      }),
    } as unknown as EmailTemplateAssetService,
    { runWithTenant: async (_tenant, callback) => callback() } as TenantDbRunnerService,
  );
  const rendered = await service.renderEmailTemplatePublication(
    "tenant",
    publication,
    "en",
    resolveAutomationMappings(mappings, notification.recipients[0]!.eventFields, "en", "en"),
    { companyName: "Tenant", primaryColor: "#123456" },
  );
  expect(rendered.subject).toBe("Welcome Alex to Sales <Europe>");
  expect(rendered.text).toContain("Alex Morgan (alex@example.com): Sales <Europe> [group]");
  expect(rendered.html).toContain("Sales &lt;Europe&gt;");
  expect(rendered.html).not.toMatch(/{{/);
});
