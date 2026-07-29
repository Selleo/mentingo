import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";

import type { BuilderNode } from "../automationBuilder.types";
import type { SimulationPanelState, SimulationResult } from "../simulation.types";

export function useSimulation() {
  const { i18n } = useTranslation();
  const [simulationState, setSimulationState] = useState<SimulationPanelState>({ type: "idle" });
  const [panelOpen, setPanelOpen] = useState(false);

  const runSimulation = useCallback(
    async (nodes: BuilderNode[]) => {
      setSimulationState({ type: "loading" });
      setPanelOpen(true);

      try {
        const language = i18n.language || "pl";

        const payload = {
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
        };

        const response = await ApiClient.instance.post<{ data: SimulationResult }>(
          "/api/automations/simulate",
          payload,
        );

        const result = response.data.data;
        setSimulationState({ type: "success", result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Simulation failed";
        setSimulationState({ type: "error", message });
      }
    },
    [i18n.language],
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
