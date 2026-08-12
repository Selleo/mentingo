import { useParams } from "@remix-run/react";
import { useCallback } from "react";

import { useUpdateAutomation } from "~/api/mutations/admin/useUpdateAutomation";
import { nodesToSteps } from "~/api/queries/admin/automation.utils";

import { useBuilderStore } from "../automationBuilderStore";
import { computeTreePositions } from "../utils/computeTreePositions";

import type { BuilderNode } from "../automationBuilder.types";
import type { AutomationNode, UpdateAutomationBody } from "~/api/queries/admin/automation.types";

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

export function useSaveAutomationSteps() {
  const { id: automationId = "new" } = useParams<{ id: string }>();
  const { mutateAsync: updateAutomation, isPending } = useUpdateAutomation();

  const saveSteps = useCallback(
    async (body: UpdateAutomationBody = {}, options: { showSuccessToast?: boolean } = {}) => {
      if (automationId === "new") return;

      const nodes = useBuilderStore.getState().nodes;
      const steps = buildStepsFromNodes(nodes, automationId);

      await updateAutomation({
        automationId,
        body,
        steps,
        showSuccessToast: options.showSuccessToast,
      });
      useBuilderStore.getState().markSaved();
    },
    [automationId, updateAutomation],
  );

  return { saveSteps, isPending };
}
