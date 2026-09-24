import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { TOAST_HANDLES } from "../../data/common/handles";
import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { EMAIL_TEMPLATE_DATA } from "../../data/test-data/email-template.data";
import { editEmailTemplateFlow } from "../../flows/email-templates/edit-email-template.flow";
import { openEmailTemplateFlow } from "../../flows/email-templates/editor.flow";
import { sendTestEmailFlow } from "../../flows/email-templates/template-actions.flow";
import { getMessageBodies } from "../../utils/mailhog/message";
import { waitForMailhogMessage } from "../../utils/mailhog/wait-for-message";

import { expect, test } from "./email-template.fixture";

test("send test delivers unsaved content with sample variables only to the current administrator", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
  apiClient,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    const user = (await apiClient.api.authControllerCurrentUser()).data.data;
    const defaults = await factory.getDefault();
    const sample = defaults.variables.find(
      (variable) => variable.key === EMAIL_TEMPLATE_DATA.variable,
    )!.sampleValue;
    const subject = `E2E delivery ${randomUUID()}`;
    await openEmailTemplateFlow(page, template.id!);
    await editEmailTemplateFlow(page, {
      subject: subject,
      text: { index: 0, value: `Unsaved invitation: {{ ${EMAIL_TEMPLATE_DATA.variable} }}` },
    });
    const queued = await sendTestEmailFlow(page);
    expect(queued.status()).toBe(201);
    await expect(page.getByTestId(TOAST_HANDLES.DESCRIPTION)).toBeVisible();
    const message = await waitForMailhogMessage({
      recipient: user.email,
      subjectIncludes: subject,
    });
    const recipients = message.Content?.Headers?.To ?? message.headers?.To;
    expect(recipients).toHaveLength(1);
    expect(recipients![0]).toContain(user.email);
    const bodies = getMessageBodies(message).join("\n");
    expect(bodies).toContain(`Unsaved invitation: ${sample}`);
    expect(bodies).not.toContain(`{{ ${EMAIL_TEMPLATE_DATA.variable} }}`);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(subject);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toBeEnabled();
    const saved = await factory.getById(template.id!);
    expect(saved.subject).toEqual(template.subject);
    expect(saved.content).toEqual(template.content);
  });
});
