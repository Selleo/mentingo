import { useEffect, useRef } from "react";

import { useBuilderStore } from "../automationBuilderStore";

import { useSaveAutomationSteps } from "./useSaveAutomationSteps";

import type { SimulationPanelState } from "../simulation.types";

export function useSimulationPersistence(
  simulationState: SimulationPanelState,
  automationId: string,
) {
  const { saveSteps } = useSaveAutomationSteps();
  const updateNodeConfigSilent = useBuilderStore((s) => s.updateNodeConfigSilent);
  const setSimulationPassed = useBuilderStore((s) => s.setSimulationPassed);

  const saveStepsRef = useRef(saveSteps);
  saveStepsRef.current = saveSteps;

  useEffect(() => {
    if (simulationState.type !== "success") return;
    if (automationId === "new") return;

    const { result } = simulationState;
    const currentNodes = useBuilderStore.getState().nodes;

    for (const nodeResult of result.nodeResults) {
      const existingNode = currentNodes.find((n) => n.id === nodeResult.nodeId);
      if (!existingNode) continue;

      updateNodeConfigSilent(nodeResult.nodeId, {
        simulationStatus: nodeResult.status,
      });
    }

    const passed = result.overallStatus === "success";
    setSimulationPassed(passed);

    const triggerNode = currentNodes.find((n) => n.kind === "trigger");
    if (triggerNode) {
      updateNodeConfigSilent(triggerNode.id, { simulationPassed: passed });
    }

    setTimeout(() => {
      void saveStepsRef.current({}, { showSuccessToast: false });
    }, 0);
  }, [simulationState, automationId, updateNodeConfigSilent, setSimulationPassed]);
}
