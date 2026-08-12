import { useCallback, useState } from "react";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { BuilderNode } from "../automationBuilder.types";
import type { SimulationPanelState } from "../simulation.types";

export function useSimulation() {
  const language = useLanguageStore((state) => state.language);
  const [simulationState, setSimulationState] = useState<SimulationPanelState>({ type: "idle" });
  const [panelOpen, setPanelOpen] = useState(false);

  const runSimulation = useCallback(
    async (nodes: BuilderNode[]) => {
      setSimulationState({ type: "loading" });
      setPanelOpen(true);

      try {
        const response = await ApiClient.api.automationsControllerRunSimulation({
          nodes: nodes.map((n) => ({
            id: n.id,
            kind: n.kind,
            type: n.type,
            label: n.label,
            parentId: n.parentId,
            children: n.children,
            config: n.config,
          })),
          language,
        });

        const result = response.data.data;
        setSimulationState({ type: "success", result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Simulation failed";
        setSimulationState({ type: "error", message });
      }
    },
    [language],
  );

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const retry = useCallback(
    (nodes: BuilderNode[]) => {
      runSimulation(nodes);
    },
    [runSimulation],
  );

  return {
    simulationState,
    isSimulating: simulationState.type === "loading",
    panelOpen,
    runSimulation,
    closePanel,
    retry,
  };
}
