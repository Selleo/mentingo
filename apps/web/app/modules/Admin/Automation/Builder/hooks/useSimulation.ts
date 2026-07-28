import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchCustomTemplatePreview, fetchSystemTemplatePreview } from "./useSimulationPreview";
import { validateNodes } from "./useSimulationValidation";

import type { BuilderNode } from "../automationBuilder.types";
import type { SimulationPanelState, SimulationResult } from "../simulation.types";

/** Prefix used in action config to identify custom (DB) templates */
const CUSTOM_TEMPLATE_PREFIX = "custom:";

/**
 * Simulation hook — performs client-side validation of the builder node tree
 * and produces a SimulationResult with sample data. For custom templates,
 * fetches the real rendered HTML from the API preview endpoint.
 */
export function useSimulation() {
  const { t } = useTranslation();
  const [simulationState, setSimulationState] = useState<SimulationPanelState>({ type: "idle" });
  const [panelOpen, setPanelOpen] = useState(false);

  const runSimulation = useCallback(
    async (nodes: BuilderNode[]) => {
      setSimulationState({ type: "loading" });
      setPanelOpen(true);

      try {
        const result = await buildSimulationResult(nodes, t);
        setSimulationState({ type: "success", result });
      } catch (error) {
        setSimulationState({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : t("automationBuilder.simulation.unknownError", "Wystąpił nieznany błąd"),
        });
      }
    },
    [t],
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

// ─── Simulation result builder ───────────────────────────────────────────────

async function buildSimulationResult(
  nodes: BuilderNode[],
  t: (key: string, options?: Record<string, string>) => string,
): Promise<SimulationResult> {
  const { nodeResults, overallStatus, eventData, placeholderMappings, sampleValues } =
    validateNodes(nodes, t);

  // Build email previews only when validation passes
  const emailPreviews: SimulationResult["emailPreviews"] = [];

  if (overallStatus === "success") {
    const actionNodes = nodes.filter((n) => n.kind === "action");

    for (const action of actionNodes) {
      const selectedTemplate = action.config.emailTemplate as string | undefined;
      const selectedLanguage = (action.config.language as string) ?? "en";
      const previewLanguage = selectedLanguage === "user_default" ? "en" : selectedLanguage;
      const values = (action.config.placeholderValues as Record<string, string>) ?? {};

      const isCustomTemplate = selectedTemplate?.startsWith(CUSTOM_TEMPLATE_PREFIX) ?? false;

      if (isCustomTemplate) {
        const customId = selectedTemplate!.slice(CUSTOM_TEMPLATE_PREFIX.length);
        const preview = await fetchCustomTemplatePreview(
          customId,
          previewLanguage,
          values,
          sampleValues,
          t,
        );

        emailPreviews.push({
          nodeId: action.id,
          nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
          subject: preview.subject,
          senderAddress: "noreply@mentingo.com",
          recipientAddress: sampleValues.user_email ?? "jan.kowalski@example.com",
          htmlBody: preview.html,
        });
      } else {
        const preview = await fetchSystemTemplatePreview(
          selectedTemplate ?? "default_email",
          previewLanguage,
          values,
          t,
        );

        emailPreviews.push({
          nodeId: action.id,
          nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
          subject: preview.subject,
          senderAddress: "noreply@mentingo.com",
          recipientAddress: sampleValues.userEmail ?? "jan.kowalski@example.com",
          htmlBody: preview.html,
        });
      }
    }
  }

  return {
    overallStatus,
    nodeResults,
    eventData,
    placeholderMappings,
    emailPreviews,
  };
}
