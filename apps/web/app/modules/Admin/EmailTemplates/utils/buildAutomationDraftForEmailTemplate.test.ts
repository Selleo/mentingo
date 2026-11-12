import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_RECIPIENT_AUDIENCES,
  AUTOMATION_RECIPIENT_TYPES,
  AUTOMATION_STEP_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import { buildAutomationDraftForEmailTemplate } from "./buildAutomationDraftForEmailTemplate";

import type { AutomationEventDefinition } from "@repo/shared";

const courseCompletionEvent: AutomationEventDefinition = {
  kind: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE,
  label: "Course completion",
  description: "",
  recipientPolicy: "",
  fields: [],
  providedVariables: [],
};

describe("completion template automation drafts", () => {
  it.each([
    {
      templateEvent: BUILT_IN_EMAIL_TEMPLATE_KEYS.COMPLETION_WITH_CERTIFICATE,
      audience: AUTOMATION_RECIPIENT_AUDIENCES.LEARNER,
    },
    {
      templateEvent: BUILT_IN_EMAIL_TEMPLATE_KEYS.ADMIN_FINISHED_COURSE,
      audience: AUTOMATION_RECIPIENT_AUDIENCES.ADMINISTRATORS,
    },
  ])(
    "keeps the $templateEvent template audience on the email action",
    ({ templateEvent, audience }) => {
      const definition = buildAutomationDraftForEmailTemplate(
        { id: "template", event: templateEvent, placeholders: [] },
        courseCompletionEvent,
        "Completion",
      );

      const stepConfigByType = (type: string) =>
        definition.workflow.steps.find((step) => step.type === type)?.config;

      expect(stepConfigByType(AUTOMATION_STEP_TYPES.TRIGGER)).toEqual({
        eventKind: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE,
      });
      expect(stepConfigByType(AUTOMATION_STEP_TYPES.SEND_EMAIL)).toMatchObject({
        recipients: { type: AUTOMATION_RECIPIENT_TYPES.EVENT, audience },
      });
    },
  );
});
