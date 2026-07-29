import { describe, expect, it } from "vitest";

import { validateNodes } from "../useSimulationValidation";

import type { BuilderNode } from "../../automationBuilder.types";
import type { ActionType, TriggerType } from "@repo/shared";

const t = (key: string) => key;

const buildNodes = (overrides?: {
  triggerType?: TriggerType;
  emailTemplate?: string;
  language?: string;
  placeholderValues?: Record<string, string>;
}): BuilderNode[] => [
  {
    id: "trigger-1",
    kind: "trigger",
    type: (overrides?.triggerType ?? "user_invited") as TriggerType,
    label: "Trigger",
    parentId: null,
    children: ["action-1"],
    position: { x: 0, y: 0 },
    config: {},
  },
  {
    id: "action-1",
    kind: "action",
    type: "send_email" as ActionType,
    label: "Send email",
    parentId: "trigger-1",
    children: [],
    position: { x: 0, y: 150 },
    config: {
      emailTemplate: overrides?.emailTemplate ?? "user_invite",
      language: overrides?.language ?? "user_default",
      placeholderValues: overrides?.placeholderValues ?? {},
    },
  },
];

describe("useSimulationValidation — validateNodes", () => {
  describe("system templates", () => {
    it("does NOT require placeholder mapping for system template (user_invite)", () => {
      const nodes = buildNodes({
        emailTemplate: "user_invite",
        placeholderValues: {},
      });

      const { overallStatus, nodeResults } = validateNodes(nodes, t);

      expect(overallStatus).toBe("success");
      const actionResult = nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("valid");
      expect(actionResult?.errors).toHaveLength(0);
    });

    it("does NOT require placeholder mapping for system template (welcome)", () => {
      const nodes = buildNodes({
        triggerType: "user_welcome",
        emailTemplate: "welcome",
        placeholderValues: {},
      });

      const { overallStatus, nodeResults } = validateNodes(nodes, t);

      expect(overallStatus).toBe("success");
      const actionResult = nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("valid");
    });

    it("does NOT require placeholder mapping for certificate_expiration_warning", () => {
      const nodes = buildNodes({
        triggerType: "certificate_expiration_warning",
        emailTemplate: "certificate_expiration_warning",
        placeholderValues: {},
      });

      const { overallStatus } = validateNodes(nodes, t);
      expect(overallStatus).toBe("success");
    });

    it("does NOT require placeholder mapping for announcement template", () => {
      const nodes = buildNodes({
        triggerType: "announcement_published",
        emailTemplate: "announcement",
        placeholderValues: {},
      });

      const { overallStatus } = validateNodes(nodes, t);
      expect(overallStatus).toBe("success");
    });
  });

  describe("custom templates", () => {
    it("passes when custom template has no placeholders defined in EMAIL_TEMPLATES", () => {
      // A custom template UUID won't be found in EMAIL_TEMPLATES,
      // so no placeholder validation occurs
      const nodes = buildNodes({
        emailTemplate: "custom-uuid-template",
        placeholderValues: {},
      });

      const { overallStatus, nodeResults } = validateNodes(nodes, t);

      expect(overallStatus).toBe("success");
      const actionResult = nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("valid");
    });
  });

  describe("required fields", () => {
    it("fails when emailTemplate is missing", () => {
      const nodes: BuilderNode[] = [
        {
          id: "trigger-1",
          kind: "trigger",
          type: "user_invited" as TriggerType,
          label: "Trigger",
          parentId: null,
          children: ["action-1"],
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: "action-1",
          kind: "action",
          type: "send_email" as ActionType,
          label: "Send email",
          parentId: "trigger-1",
          children: [],
          position: { x: 0, y: 150 },
          config: {
            language: "user_default",
          },
        },
      ];

      const { overallStatus, nodeResults } = validateNodes(nodes, t);

      expect(overallStatus).toBe("failed");
      const actionResult = nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.errors.some((e) => e.field === "emailTemplate")).toBe(true);
    });

    it("fails when language is missing", () => {
      const nodes: BuilderNode[] = [
        {
          id: "trigger-1",
          kind: "trigger",
          type: "user_invited" as TriggerType,
          label: "Trigger",
          parentId: null,
          children: ["action-1"],
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: "action-1",
          kind: "action",
          type: "send_email" as ActionType,
          label: "Send email",
          parentId: "trigger-1",
          children: [],
          position: { x: 0, y: 150 },
          config: {
            emailTemplate: "user_invite",
          },
        },
      ];

      const { overallStatus, nodeResults } = validateNodes(nodes, t);

      expect(overallStatus).toBe("failed");
      const actionResult = nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.errors.some((e) => e.field === "language")).toBe(true);
    });

    it("fails when trigger node is missing", () => {
      const nodes: BuilderNode[] = [
        {
          id: "action-1",
          kind: "action",
          type: "send_email" as ActionType,
          label: "Send email",
          parentId: null,
          children: [],
          position: { x: 0, y: 150 },
          config: {
            emailTemplate: "user_invite",
            language: "user_default",
          },
        },
      ];

      const { overallStatus, nodeResults } = validateNodes(nodes, t);

      expect(overallStatus).toBe("failed");
      const triggerResult = nodeResults.find((n) => n.kind === "trigger");
      expect(triggerResult?.status).toBe("invalid");
    });

    it("fails when action node is missing", () => {
      const nodes: BuilderNode[] = [
        {
          id: "trigger-1",
          kind: "trigger",
          type: "user_invited" as TriggerType,
          label: "Trigger",
          parentId: null,
          children: [],
          position: { x: 0, y: 0 },
          config: {},
        },
      ];

      const { overallStatus, nodeResults } = validateNodes(nodes, t);

      expect(overallStatus).toBe("failed");
      const actionResult = nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("invalid");
    });
  });
});
