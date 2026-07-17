import { create } from "zustand";

import type { ActionType, BuilderNode, BuilderState, TriggerType } from "./automationBuilder.types";

interface BuilderActions {
  addNode: (node: BuilderNode) => void;
  addChildNode: (parentId: string, node: BuilderNode) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  updateNodeType: (nodeId: string, type: TriggerType | ActionType, label: string) => void;
  setAutomationName: (name: string) => void;
  setActive: (active: boolean) => void;
  markSaved: () => void;
  reset: () => void;
}

const initialState: BuilderState = {
  nodes: [],
  selectedNodeId: null,
  automationName: "New Automation",
  isActive: false,
  lastSavedAt: null,
};

export const useBuilderStore = create<BuilderState & BuilderActions>((set) => ({
  ...initialState,

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  addChildNode: (parentId, node) =>
    set((state) => ({
      nodes: state.nodes
        .map((n) => (n.id === parentId ? { ...n, children: [...n.children, node.id] } : n))
        .concat({ ...node, parentId }),
    })),

  removeNode: (nodeId) =>
    set((state) => {
      const removeRecursive = (id: string, nodes: BuilderNode[]): BuilderNode[] => {
        const target = nodes.find((n) => n.id === id);
        if (!target) return nodes;

        let remaining = nodes.filter((n) => n.id !== id);
        for (const childId of target.children) {
          remaining = removeRecursive(childId, remaining);
        }

        return remaining.map((n) =>
          n.children.includes(id) ? { ...n, children: n.children.filter((c) => c !== id) } : n,
        );
      };

      return {
        nodes: removeRecursive(nodeId, state.nodes),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      };
    }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateNodeConfig: (nodeId, config) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n,
      ),
    })),

  updateNodeType: (nodeId, type, label) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, type, label, config: {} } : n)),
    })),

  setAutomationName: (name) => set({ automationName: name }),

  setActive: (active) => set({ isActive: active }),

  markSaved: () => set({ lastSavedAt: new Date().toISOString() }),

  reset: () => set(initialState),
}));
