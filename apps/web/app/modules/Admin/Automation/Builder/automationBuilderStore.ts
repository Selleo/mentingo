import { create } from "zustand";

import type { ActionType, BuilderNode, BuilderState, TriggerType } from "./automationBuilder.types";

interface BuilderActions {
  addNode: (node: BuilderNode) => void;
  addChildNode: (parentId: string, node: BuilderNode) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  updateNodeConfigSilent: (nodeId: string, config: Record<string, unknown>) => void;
  updateNodeType: (nodeId: string, type: TriggerType | ActionType, label: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  setAutomationName: (name: string) => void;
  setActive: (active: boolean) => void;
  setSimulationPassed: (passed: boolean) => void;
  loadNodes: (nodes: BuilderNode[]) => void;
  markSaved: () => void;
  markDirty: () => void;
  reset: () => void;
}

const initialState: BuilderState = {
  nodes: [],
  selectedNodeId: null,
  automationName: "New Automation",
  isActive: false,
  simulationPassed: false,
  lastSavedAt: null,
  isDirty: false,
};

export const useBuilderStore = create<BuilderState & BuilderActions>((set) => ({
  ...initialState,

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
      isActive: false,
      simulationPassed: false,
    })),

  addChildNode: (parentId, node) =>
    set((state) => ({
      nodes: state.nodes
        .map((n) => (n.id === parentId ? { ...n, children: [...n.children, node.id] } : n))
        .concat({ ...node, parentId }),
      isDirty: true,
      isActive: false,
      simulationPassed: false,
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
        isDirty: true,
        isActive: false,
        simulationPassed: false,
      };
    }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateNodeConfig: (nodeId, config) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n,
      ),
      isDirty: true,
      isActive: false,
      simulationPassed: false,
    })),

  updateNodeConfigSilent: (nodeId, config) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n,
      ),
    })),

  updateNodeType: (nodeId, type, label) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, type, label, config: {} } : n)),
      isDirty: true,
      isActive: false,
      simulationPassed: false,
    })),

  updateNodePosition: (nodeId, position) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)),
    })),

  setAutomationName: (name) => set({ automationName: name }),

  setActive: (active) => set({ isActive: active }),

  setSimulationPassed: (passed) => set({ simulationPassed: passed }),

  loadNodes: (nodes) => set({ nodes, isDirty: false }),

  markSaved: () => set({ lastSavedAt: new Date().toISOString(), isDirty: false }),

  markDirty: () => set({ isDirty: true }),

  reset: () => set(initialState),
}));
