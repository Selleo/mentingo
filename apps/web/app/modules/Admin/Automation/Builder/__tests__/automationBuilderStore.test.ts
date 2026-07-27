import { beforeEach, describe, expect, it } from "vitest";

import { useBuilderStore } from "../automationBuilderStore";

import type { BuilderNode } from "../automationBuilder.types";

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
    parentId: null,
    children: [],
    position: { x: 0, y: 100 },
    config: {},
    ...overrides,
  };
}

describe("automationBuilderStore", () => {
  beforeEach(() => {
    useBuilderStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with empty nodes and default values", () => {
      const state = useBuilderStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.automationName).toBe("New Automation");
      expect(state.isActive).toBe(false);
      expect(state.simulationPassed).toBe(false);
      expect(state.lastSavedAt).toBeNull();
      expect(state.isDirty).toBe(false);
    });
  });

  describe("addNode", () => {
    it("adds a node to the nodes array", () => {
      const node = makeTriggerNode();
      useBuilderStore.getState().addNode(node);

      expect(useBuilderStore.getState().nodes).toHaveLength(1);
      expect(useBuilderStore.getState().nodes[0]).toEqual(node);
    });

    it("marks the store as dirty", () => {
      useBuilderStore.getState().addNode(makeTriggerNode());
      expect(useBuilderStore.getState().isDirty).toBe(true);
    });

    it("resets isActive and simulationPassed", () => {
      useBuilderStore.getState().setActive(true);
      useBuilderStore.getState().setSimulationPassed(true);
      useBuilderStore.getState().addNode(makeTriggerNode());

      expect(useBuilderStore.getState().isActive).toBe(false);
      expect(useBuilderStore.getState().simulationPassed).toBe(false);
    });
  });

  describe("addChildNode", () => {
    it("adds child and updates parent children array", () => {
      const parent = makeTriggerNode({ id: "parent" });
      useBuilderStore.getState().addNode(parent);

      const child = makeActionNode({ id: "child" });
      useBuilderStore.getState().addChildNode("parent", child);

      const state = useBuilderStore.getState();
      const updatedParent = state.nodes.find((n) => n.id === "parent");
      const addedChild = state.nodes.find((n) => n.id === "child");

      expect(updatedParent?.children).toContain("child");
      expect(addedChild?.parentId).toBe("parent");
    });

    it("marks store as dirty and resets active/simulation", () => {
      useBuilderStore.getState().addNode(makeTriggerNode({ id: "parent" }));
      useBuilderStore.getState().setActive(true);
      useBuilderStore.getState().setSimulationPassed(true);

      useBuilderStore.getState().addChildNode("parent", makeActionNode({ id: "child" }));

      const state = useBuilderStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.isActive).toBe(false);
      expect(state.simulationPassed).toBe(false);
    });
  });

  describe("removeNode", () => {
    it("removes the node from the array", () => {
      useBuilderStore.getState().addNode(makeTriggerNode({ id: "to-remove" }));
      useBuilderStore.getState().removeNode("to-remove");

      expect(useBuilderStore.getState().nodes).toHaveLength(0);
    });

    it("removes children recursively", () => {
      const parent = makeTriggerNode({ id: "parent", children: ["child"] });
      const child = makeActionNode({ id: "child", parentId: "parent", children: ["grandchild"] });
      const grandchild = makeActionNode({ id: "grandchild", parentId: "child" });

      useBuilderStore.setState({ nodes: [parent, child, grandchild] });
      useBuilderStore.getState().removeNode("parent");

      expect(useBuilderStore.getState().nodes).toHaveLength(0);
    });

    it("removes nodeId from parent's children array", () => {
      const parent = makeTriggerNode({ id: "parent", children: ["child"] });
      const child = makeActionNode({ id: "child", parentId: "parent" });

      useBuilderStore.setState({ nodes: [parent, child] });
      useBuilderStore.getState().removeNode("child");

      const updatedParent = useBuilderStore.getState().nodes.find((n) => n.id === "parent");
      expect(updatedParent?.children).not.toContain("child");
    });

    it("clears selectedNodeId if removed node was selected", () => {
      useBuilderStore.getState().addNode(makeTriggerNode({ id: "selected" }));
      useBuilderStore.getState().selectNode("selected");
      useBuilderStore.getState().removeNode("selected");

      expect(useBuilderStore.getState().selectedNodeId).toBeNull();
    });

    it("keeps selectedNodeId if a different node was removed", () => {
      useBuilderStore.getState().addNode(makeTriggerNode({ id: "keep" }));
      useBuilderStore.getState().addNode(makeActionNode({ id: "remove" }));
      useBuilderStore.getState().selectNode("keep");
      useBuilderStore.getState().removeNode("remove");

      expect(useBuilderStore.getState().selectedNodeId).toBe("keep");
    });
  });

  describe("selectNode", () => {
    it("sets the selected node id", () => {
      useBuilderStore.getState().selectNode("some-id");
      expect(useBuilderStore.getState().selectedNodeId).toBe("some-id");
    });

    it("can clear selection with null", () => {
      useBuilderStore.getState().selectNode("some-id");
      useBuilderStore.getState().selectNode(null);
      expect(useBuilderStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe("updateNodeConfig", () => {
    it("merges config into the target node", () => {
      useBuilderStore
        .getState()
        .addNode(makeActionNode({ id: "action", config: { existing: true } }));
      useBuilderStore.getState().updateNodeConfig("action", { emailTemplate: "welcome" });

      const node = useBuilderStore.getState().nodes.find((n) => n.id === "action");
      expect(node?.config).toEqual({ existing: true, emailTemplate: "welcome" });
    });

    it("marks dirty and resets active/simulation", () => {
      useBuilderStore.getState().addNode(makeActionNode({ id: "action" }));
      useBuilderStore.setState({ isDirty: false, isActive: true, simulationPassed: true });

      useBuilderStore.getState().updateNodeConfig("action", { language: "pl" });

      const state = useBuilderStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.isActive).toBe(false);
      expect(state.simulationPassed).toBe(false);
    });
  });

  describe("updateNodeConfigSilent", () => {
    it("merges config without marking dirty", () => {
      useBuilderStore.getState().addNode(makeActionNode({ id: "action" }));
      useBuilderStore.setState({ isDirty: false, isActive: true, simulationPassed: true });

      useBuilderStore.getState().updateNodeConfigSilent("action", { simulationStatus: "valid" });

      const state = useBuilderStore.getState();
      const node = state.nodes.find((n) => n.id === "action");
      expect(node?.config.simulationStatus).toBe("valid");
      expect(state.isDirty).toBe(false);
      expect(state.isActive).toBe(true);
      expect(state.simulationPassed).toBe(true);
    });
  });

  describe("updateNodeType", () => {
    it("updates type, label, and resets config", () => {
      useBuilderStore
        .getState()
        .addNode(makeTriggerNode({ id: "trigger", config: { oldConfig: true } }));
      useBuilderStore.getState().updateNodeType("trigger", "user_welcome", "Welcome");

      const node = useBuilderStore.getState().nodes.find((n) => n.id === "trigger");
      expect(node?.type).toBe("user_welcome");
      expect(node?.label).toBe("Welcome");
      expect(node?.config).toEqual({});
    });
  });

  describe("updateNodePosition", () => {
    it("updates position without marking dirty", () => {
      useBuilderStore.getState().addNode(makeTriggerNode({ id: "node" }));
      useBuilderStore.setState({ isDirty: false });

      useBuilderStore.getState().updateNodePosition("node", { x: 100, y: 200 });

      const node = useBuilderStore.getState().nodes.find((n) => n.id === "node");
      expect(node?.position).toEqual({ x: 100, y: 200 });
    });
  });

  describe("setAutomationName", () => {
    it("updates the automation name", () => {
      useBuilderStore.getState().setAutomationName("My Automation");
      expect(useBuilderStore.getState().automationName).toBe("My Automation");
    });
  });

  describe("setActive / setSimulationPassed", () => {
    it("toggles isActive", () => {
      useBuilderStore.getState().setActive(true);
      expect(useBuilderStore.getState().isActive).toBe(true);

      useBuilderStore.getState().setActive(false);
      expect(useBuilderStore.getState().isActive).toBe(false);
    });

    it("toggles simulationPassed", () => {
      useBuilderStore.getState().setSimulationPassed(true);
      expect(useBuilderStore.getState().simulationPassed).toBe(true);
    });
  });

  describe("loadNodes", () => {
    it("replaces all nodes and clears isDirty", () => {
      useBuilderStore.getState().addNode(makeTriggerNode({ id: "old" }));

      const newNodes = [makeActionNode({ id: "new-1" }), makeActionNode({ id: "new-2" })];
      useBuilderStore.getState().loadNodes(newNodes);

      const state = useBuilderStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes[0].id).toBe("new-1");
      expect(state.isDirty).toBe(false);
    });
  });

  describe("markSaved", () => {
    it("sets lastSavedAt and clears isDirty", () => {
      useBuilderStore.getState().markDirty();
      useBuilderStore.getState().markSaved();

      const state = useBuilderStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.lastSavedAt).not.toBeNull();
      expect(new Date(state.lastSavedAt!).getTime()).toBeCloseTo(Date.now(), -2);
    });
  });

  describe("markDirty", () => {
    it("sets isDirty to true", () => {
      useBuilderStore.getState().markDirty();
      expect(useBuilderStore.getState().isDirty).toBe(true);
    });
  });

  describe("reset", () => {
    it("restores all values to initial state", () => {
      useBuilderStore.getState().addNode(makeTriggerNode());
      useBuilderStore.getState().setAutomationName("Custom");
      useBuilderStore.getState().setActive(true);
      useBuilderStore.getState().setSimulationPassed(true);
      useBuilderStore.getState().markSaved();

      useBuilderStore.getState().reset();

      const state = useBuilderStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.automationName).toBe("New Automation");
      expect(state.isActive).toBe(false);
      expect(state.simulationPassed).toBe(false);
      expect(state.lastSavedAt).toBeNull();
      expect(state.isDirty).toBe(false);
    });
  });
});
