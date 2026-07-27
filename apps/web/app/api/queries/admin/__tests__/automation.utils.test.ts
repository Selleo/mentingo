import { describe, it, expect } from "vitest";

import {
  stepsToNodes,
  nodesToSteps,
  getLocalizedValue,
  recordToListItem,
} from "../automation.utils";

import type { AutomationNode, AutomationRecord, AutomationStepRaw } from "../automation.types";

describe("automation.utils", () => {
  describe("stepsToNodes", () => {
    it("returns empty array for empty input", () => {
      expect(stepsToNodes([])).toEqual([]);
    });

    it("converts a single step to a node", () => {
      const steps: AutomationStepRaw[] = [
        {
          id: "step-1",
          automationId: "auto-1",
          parentId: null,
          type: "trigger",
          typeContext: {
            name: "user_invited",
            label: "User Invited",
            config: { foo: "bar" },
            position: { x: 10, y: 20 },
          },
        },
      ];

      const result = stepsToNodes(steps);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "step-1",
        kind: "trigger",
        type: "user_invited",
        label: "User Invited",
        parentId: null,
        children: [],
        config: { foo: "bar" },
        position: { x: 10, y: 20 },
      });
    });

    it("falls back to name for label when label is missing", () => {
      const steps: AutomationStepRaw[] = [
        {
          id: "step-1",
          automationId: "auto-1",
          parentId: null,
          type: "action",
          typeContext: { name: "send_email" },
        },
      ];

      const result = stepsToNodes(steps);
      expect(result[0].label).toBe("send_email");
    });

    it("defaults config to empty object when missing", () => {
      const steps: AutomationStepRaw[] = [
        {
          id: "step-1",
          automationId: "auto-1",
          parentId: null,
          type: "trigger",
          typeContext: { name: "user_welcome" },
        },
      ];

      const result = stepsToNodes(steps);
      expect(result[0].config).toEqual({});
    });

    it("defaults position to {x:0, y:0} when missing", () => {
      const steps: AutomationStepRaw[] = [
        {
          id: "step-1",
          automationId: "auto-1",
          parentId: null,
          type: "trigger",
          typeContext: { name: "user_welcome" },
        },
      ];

      const result = stepsToNodes(steps);
      expect(result[0].position).toEqual({ x: 0, y: 0 });
    });

    it("computes children from parentId relationships", () => {
      const steps: AutomationStepRaw[] = [
        {
          id: "parent",
          automationId: "auto-1",
          parentId: null,
          type: "trigger",
          typeContext: { name: "user_invited", label: "Trigger" },
        },
        {
          id: "child-1",
          automationId: "auto-1",
          parentId: "parent",
          type: "action",
          typeContext: { name: "send_email", label: "Email 1" },
        },
        {
          id: "child-2",
          automationId: "auto-1",
          parentId: "parent",
          type: "action",
          typeContext: { name: "send_email", label: "Email 2" },
        },
      ];

      const result = stepsToNodes(steps);
      const parent = result.find((n) => n.id === "parent")!;

      expect(parent.children).toContain("child-1");
      expect(parent.children).toContain("child-2");
      expect(parent.children).toHaveLength(2);
    });
  });

  describe("nodesToSteps", () => {
    it("returns empty array for empty input", () => {
      expect(nodesToSteps([], "auto-1")).toEqual([]);
    });

    it("converts nodes to bulk step format", () => {
      const nodes: AutomationNode[] = [
        {
          id: "node-1",
          kind: "trigger",
          type: "user_invited",
          label: "User Invited",
          parentId: null,
          children: ["node-2"],
          config: { key: "value" },
          position: { x: 50, y: 0 },
        },
        {
          id: "node-2",
          kind: "action",
          type: "send_email",
          label: "Send Email",
          parentId: "node-1",
          children: [],
          config: { emailTemplate: "welcome" },
          position: { x: 50, y: 150 },
        },
      ];

      const result = nodesToSteps(nodes, "automation-123");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "node-1",
        parentId: null,
        automationId: "automation-123",
        type: "trigger",
        typeContext: {
          name: "user_invited",
          label: "User Invited",
          config: { key: "value" },
          position: { x: 50, y: 0 },
        },
      });
      expect(result[1].automationId).toBe("automation-123");
      expect(result[1].parentId).toBe("node-1");
    });
  });

  describe("getLocalizedValue", () => {
    it("returns value for requested language", () => {
      expect(getLocalizedValue({ pl: "Cześć", en: "Hello" }, "pl")).toBe("Cześć");
    });

    it("falls back to first available value when language not present", () => {
      expect(getLocalizedValue({ en: "Hello" }, "de")).toBe("Hello");
    });

    it("returns empty string for null", () => {
      expect(getLocalizedValue(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(getLocalizedValue(undefined)).toBe("");
    });

    it("returns empty string for empty object", () => {
      expect(getLocalizedValue({})).toBe("");
    });

    it("defaults to 'pl' language when not specified", () => {
      expect(getLocalizedValue({ pl: "Polski", en: "English" })).toBe("Polski");
    });
  });

  describe("recordToListItem", () => {
    const record: AutomationRecord = {
      id: "auto-1",
      name: { pl: "Automatyzacja", en: "Automation" },
      description: { pl: "Opis", en: "Description" },
      status: "enabled",
      lastRun: "2025-07-01T12:00:00Z",
      createdAt: "2025-06-01T10:00:00Z",
      updatedAt: "2025-07-01T12:00:00Z",
    };

    it("extracts localized name and description for given language", () => {
      const item = recordToListItem(record, "en");

      expect(item.name).toBe("Automation");
      expect(item.description).toBe("Description");
    });

    it("defaults to Polish language", () => {
      const item = recordToListItem(record);

      expect(item.name).toBe("Automatyzacja");
      expect(item.description).toBe("Opis");
    });

    it("preserves id, status, dates", () => {
      const item = recordToListItem(record, "pl");

      expect(item.id).toBe("auto-1");
      expect(item.status).toBe("enabled");
      expect(item.lastRun).toBe("2025-07-01T12:00:00Z");
      expect(item.createdAt).toBe("2025-06-01T10:00:00Z");
      expect(item.updatedAt).toBe("2025-07-01T12:00:00Z");
    });
  });
});
