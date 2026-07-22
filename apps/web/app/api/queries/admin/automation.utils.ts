import type {
  AutomationNode,
  AutomationNodeKind,
  AutomationRecord,
  AutomationListItem,
  AutomationStepBulkItem,
  AutomationStepRaw,
} from "./automation.types";

/**
 * Converts raw backend steps (flat with parentId) into frontend BuilderNodes
 * with computed `children[]` arrays.
 */
export function stepsToNodes(steps: AutomationStepRaw[]): AutomationNode[] {
  const nodes: AutomationNode[] = steps.map((step) => ({
    id: step.id,
    kind: step.type as AutomationNodeKind,
    type: step.typeContext.name,
    label: step.typeContext.label ?? step.typeContext.name,
    parentId: step.parentId,
    children: [],
    config: step.typeContext.config ?? {},
    position: step.typeContext.position ?? { x: 0, y: 0 },
  }));

  // Compute children from parentId relationships
  for (const node of nodes) {
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (parent) {
        parent.children.push(node.id);
      }
    }
  }

  return nodes;
}

/**
 * Converts frontend BuilderNodes into backend step bulk update payload.
 */
export function nodesToSteps(
  nodes: AutomationNode[],
  automationId: string,
): AutomationStepBulkItem[] {
  return nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    automationId,
    type: node.kind as AutomationNodeKind,
    typeContext: {
      name: node.type,
      label: node.label,
      config: node.config,
      position: node.position,
    },
  }));
}

/**
 * Extracts a localized string from a LocalizedText object.
 * Falls back to first available value if the requested language is not present.
 */
export function getLocalizedValue(
  text: Record<string, string> | null | undefined,
  language = "pl",
): string {
  if (!text) return "";
  return text[language] ?? Object.values(text)[0] ?? "";
}

/**
 * Converts a backend AutomationRecord to a frontend-friendly AutomationListItem.
 */
export function recordToListItem(record: AutomationRecord, language = "pl"): AutomationListItem {
  return {
    id: record.id,
    name: getLocalizedValue(record.name, language),
    description: getLocalizedValue(record.description, language),
    status: record.status,
    lastRun: record.lastRun,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
