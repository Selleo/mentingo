import { test as base } from "../../fixtures/test.fixture";

import type { EmailTemplateFactory } from "../../factories/email-template.factory";
import type { CreateEmailTemplateBody } from "~/api/generated-api";

type EmailTemplateFixtures = {
  emailTemplateFactory: EmailTemplateFactory;
  createEmailTemplate: (
    input?: Partial<CreateEmailTemplateBody>,
  ) => ReturnType<EmailTemplateFactory["create"]>;
};

export const test = base.extend<EmailTemplateFixtures>({
  emailTemplateFactory: async ({ factories }, use) => {
    await use(factories.createEmailTemplateFactory());
  },
  createEmailTemplate: async ({ emailTemplateFactory, cleanup }, use) => {
    // Called inside withWorkerPage, after browser cookies are synced to the API client.
    await use(async (input) => {
      const template = await emailTemplateFactory.create(input);
      cleanup.add(() => emailTemplateFactory.delete(template.id!));
      return template;
    });
  },
});

export { expect } from "../../fixtures/test.fixture";
