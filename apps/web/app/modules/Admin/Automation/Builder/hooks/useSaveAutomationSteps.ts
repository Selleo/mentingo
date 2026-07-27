import { useParams } from "@remix-run/react";
import { useCallback } from "react";

import { useUpdateAutomation } from "~/api/mutations/admin/useUpdateAutomation";
import { nodesToSteps } from "~/api/queries/admin/automation.utils";

import { useBuilderStore } from "../automationBuilderStore";
import { computeTreePositions } from "../utils/computeTreePositions";

import type { BuilderNode } from "../automationBuilder.types";
import type { AutomationNode } from "~/api/queries/admin/automation.types";

/**
 * Converts the current builder node tree into positioned AutomationNode[]
 * and then into the step format expected by the backend.
 */
export function buildStepsFromNodes(nodes: BuilderNode[], automationId: string) {
  const positionedNodes = computeTreePositions(nodes);

  const automationNodes: AutomationNode[] = positionedNodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    type: n.type,
    label: n.label,
    parentId: n.parentId,
    children: n.children,
    config: n.config,
    position: n.position,
  }));

  return nodesToSteps(automationNodes, automationId);
}

/**
 * Hook that saves the current step tree to the backend.
 * Used after any node config change (e.g. editing an action's email template).
 *
 * Optionally accepts a `body` to merge additional fields (name, status) into the
 * update call alongside the steps.
 */
export function useSaveAutomationSteps() {
  const { id: automationId = "new" } = useParams<{ id: string }>();
  const updateAutomation = useUpdateAutomation();

  const saveSteps = useCallback(
    (body: Record<string, unknown> = {}) => {
      if (automationId === "new") return;

      const nodes = useBuilderStore.getState().nodes;
      const steps = buildStepsFromNodes(nodes, automationId);

      if (steps.length > 0) {
        updateAutomation.mutate(
          { automationId, body, steps },
          {
            onSuccess: () => {
              useBuilderStore.getState().markSaved();
            },
          },
        );
      }
    },
    [automationId, updateAutomation],
  );

  return { saveSteps, isPending: updateAutomation.isPending };
}
