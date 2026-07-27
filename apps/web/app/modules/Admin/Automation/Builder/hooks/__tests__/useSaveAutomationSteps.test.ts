import { describe, expect, it } from "vitest";

import { buildStepsFromNodes } from "../useSaveAutomationSteps";

import type { BuilderNode } from "../../automationBuilder.types";

function makeTriggerNode(overrides: Partial<BuilderNode> = {}): BuilderNode {
  return {
    id: "trigger-1",
    kind: "trigger",
    type: "user_invited",
    label: "User Invited",
    parentId: null,
    children: ["action-1"],
    position: { x: 0, y: 0 },
    config: {},
    ...overrides,
  };
}

function makeActionNode(overrides: Partial<BuilderNode> = {}): BuilderNode {
  return {
    id: "action-1",
    kind: "action",
    type: "send_email",
    label: "Send Email",
    parentId: "trigger-1",
    children: [],
    position: { x: 0, y: 150 },
    config: { emailTemplate: "welcome", language: "pl" },
    ...overrides,
  };
}

describe("buildStepsFromNodes", () => {
  it("returns empty array for empty nodes", () => {
    const result = buildStepsFromNodes([], "auto-1");
    expect(result).toEqual([]);
  });

  it("converts nodes to step format with correct automationId", () => {
    const nodes = [makeTriggerNode(), makeActionNode()];
    const result = buildStepsFromNodes(nodes, "auto-123");

    expect(result).toHaveLength(2);
    expect(result[0].automationId).toBe("auto-123");
    expect(result[1].automationId).toBe("auto-123");
  });

  it("maps node kind to step type field", () => {
    const nodes = [makeTriggerNode(), makeActionNode()];
    const result = buildStepsFromNodes(nodes, "auto-1");

    expect(result[0].type).toBe("trigger");
    expect(result[1].type).toBe("action");
  });

  it("preserves parentId relationships", () => {
    const nodes = [makeTriggerNode(), makeActionNode()];
    const result = buildStepsFromNodes(nodes, "auto-1");

    const triggerStep = result.find((s) => s.id === "trigger-1");
    const actionStep = result.find((s) => s.id === "action-1");

    expect(triggerStep?.parentId).toBeNull();
    expect(actionStep?.parentId).toBe("trigger-1");
  });

  it("puts node type into typeContext.name", () => {
    const nodes = [makeTriggerNode(), makeActionNode()];
    const result = buildStepsFromNodes(nodes, "auto-1");

    expect(result[0].typeContext.name).toBe("user_invited");
    expect(result[1].typeContext.name).toBe("send_email");
  });

  it("puts node config into typeContext.config", () => {
    const nodes = [
      makeTriggerNode(),
      makeActionNode({ config: { emailTemplate: "user_invite", language: "en" } }),
    ];
    const result = buildStepsFromNodes(nodes, "auto-1");

    const actionStep = result.find((s) => s.id === "action-1");
    expect(actionStep?.typeContext.config).toEqual({
      emailTemplate: "user_invite",
      language: "en",
    });
  });

  it("applies computed tree positions", () => {
    const nodes = [makeTriggerNode({ children: ["action-1"] }), makeActionNode()];
    const result = buildStepsFromNodes(nodes, "auto-1");

    const triggerStep = result.find((s) => s.id === "trigger-1");
    const actionStep = result.find((s) => s.id === "action-1");

    // computeTreePositions places the root at y=0 and child at y=150
    expect(triggerStep?.typeContext.position?.y).toBe(0);
    expect(actionStep?.typeContext.position?.y).toBe(150);
  });
});
