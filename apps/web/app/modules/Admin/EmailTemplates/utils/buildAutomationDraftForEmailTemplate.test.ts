import { describe, expect, it } from "vitest";

import { buildAutomationDraftForEmailTemplate } from "./buildAutomationDraftForEmailTemplate";

describe("completion template automation drafts", () => {
  it.each(["user_finished_course", "admin_finished_course"] as const)(
    "keeps the %s template audience on the email action",
    (legacyEvent) => {
      const definition = buildAutomationDraftForEmailTemplate(
        { id: "template", event: legacyEvent, placeholders: [] } as never,
        { kind: "user_finished_course", fields: [], providedVariables: [] } as never,
        "Completion",
      );
      expect(definition.workflow.steps.find(({ type }) => type === "trigger")?.config).toEqual({
        eventKind: "user_finished_course",
      });
      expect(
        definition.workflow.steps.find(({ type }) => type === "send_email")?.config,
      ).toMatchObject({
        recipients: {
          type: "event",
          audience: legacyEvent === "admin_finished_course" ? "administrators" : "learner",
        },
      });
    },
  );
});
