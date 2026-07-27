import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "~/utils/mocks/i18next.mock";
import { useSimulation } from "../useSimulation";

import type { BuilderNode } from "../../automationBuilder.types";

function makeTriggerNode(overrides: Partial<BuilderNode> = {}): BuilderNode {
  return {
    id: "trigger-1",
    kind: "trigger",
    type: "user_invited",
    label: "User Invited",
    parentId: null,
    children: [],
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
    config: {
      emailTemplate: "welcome",
      language: "pl",
      placeholderValues: { coursesLink: "course_url" },
    },
    ...overrides,
  };
}

describe("useSimulation", () => {
  it("starts in idle state with panel closed", () => {
    const { result } = renderHook(() => useSimulation());

    expect(result.current.simulationState).toEqual({ type: "idle" });
    expect(result.current.panelOpen).toBe(false);
    expect(result.current.isSimulating).toBe(false);
  });

  it("opens the panel and sets success state after running simulation", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode(), makeActionNode()];

    act(() => {
      result.current.runSimulation(nodes);
    });

    expect(result.current.panelOpen).toBe(true);
    expect(result.current.simulationState.type).toBe("success");
  });

  it("reports success when trigger + valid action are present", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode(), makeActionNode()];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success");

    expect(state.result.overallStatus).toBe("success");
    expect(state.result.nodeResults).toHaveLength(2);
    expect(state.result.nodeResults[0].status).toBe("valid");
    expect(state.result.nodeResults[1].status).toBe("valid");
  });

  it("reports failure when no trigger node exists", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeActionNode({ parentId: null })];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    expect(state.result.overallStatus).toBe("failed");
    expect(state.result.nodeResults.some((nr) => nr.nodeId === "missing-trigger")).toBe(true);
  });

  it("reports failure when no action nodes exist", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode()];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    expect(state.result.overallStatus).toBe("failed");
    expect(state.result.nodeResults.some((nr) => nr.nodeId === "missing-action")).toBe(true);
  });

  it("reports invalid action when emailTemplate is missing", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode(), makeActionNode({ config: { language: "pl" } })];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    const actionResult = state.result.nodeResults.find((nr) => nr.kind === "action");
    expect(actionResult?.status).toBe("invalid");
    expect(actionResult?.errors.some((e) => e.field === "emailTemplate")).toBe(true);
  });

  it("reports invalid action when language is missing", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode(), makeActionNode({ config: { emailTemplate: "welcome" } })];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    const actionResult = state.result.nodeResults.find((nr) => nr.kind === "action");
    expect(actionResult?.status).toBe("invalid");
    expect(actionResult?.errors.some((e) => e.field === "language")).toBe(true);
  });

  it("reports unmapped placeholders for templates that require them", () => {
    const { result } = renderHook(() => useSimulation());

    // user_invite template has placeholders: ["invitedByUserName", "createPasswordLink"]
    const nodes = [
      makeTriggerNode(),
      makeActionNode({
        config: {
          emailTemplate: "user_invite",
          language: "pl",
          placeholderValues: {}, // No mappings for required placeholders
        },
      }),
    ];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    const actionResult = state.result.nodeResults.find((nr) => nr.kind === "action");
    expect(actionResult?.status).toBe("invalid");
    expect(
      actionResult?.errors.some((e) => e.field === "placeholderValues.invitedByUserName"),
    ).toBe(true);
    expect(
      actionResult?.errors.some((e) => e.field === "placeholderValues.createPasswordLink"),
    ).toBe(true);
  });

  it("reports invalid trigger when trigger type is empty", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [
      makeTriggerNode({ type: "" as unknown as BuilderNode["type"] }),
      makeActionNode(),
    ];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    const triggerResult = state.result.nodeResults.find((nr) => nr.kind === "trigger");
    expect(triggerResult?.status).toBe("invalid");
  });

  it("generates eventData from trigger providedVariables", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode({ type: "user_invited" }), makeActionNode()];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    expect(state.result.eventData.length).toBeGreaterThan(0);
    expect(state.result.eventData.some((ed) => ed.key === "userFirstName")).toBe(true);
  });

  it("generates email previews when simulation passes", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode(), makeActionNode()];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    expect(state.result.emailPreviews).toHaveLength(1);
    expect(state.result.emailPreviews[0].nodeId).toBe("action-1");
    expect(state.result.emailPreviews[0].senderAddress).toBe("noreply@mentingo.com");
  });

  it("does not generate email previews when simulation fails", () => {
    const { result } = renderHook(() => useSimulation());

    // Missing email template → fails
    const nodes = [makeTriggerNode(), makeActionNode({ config: { language: "pl" } })];

    act(() => {
      result.current.runSimulation(nodes);
    });

    const state = result.current.simulationState;
    if (state.type !== "success") throw new Error("Expected success state");

    expect(state.result.overallStatus).toBe("failed");
    expect(state.result.emailPreviews).toHaveLength(0);
  });

  it("closes the panel", () => {
    const { result } = renderHook(() => useSimulation());

    act(() => {
      result.current.runSimulation([makeTriggerNode(), makeActionNode()]);
    });
    expect(result.current.panelOpen).toBe(true);

    act(() => {
      result.current.closePanel();
    });
    expect(result.current.panelOpen).toBe(false);
  });

  it("retry re-runs simulation with provided nodes", () => {
    const { result } = renderHook(() => useSimulation());

    const nodes = [makeTriggerNode(), makeActionNode()];

    act(() => {
      result.current.retry(nodes);
    });

    expect(result.current.panelOpen).toBe(true);
    expect(result.current.simulationState.type).toBe("success");
  });
});
