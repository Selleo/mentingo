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
    (nodes: BuilderNode[]) => {
      setSimulationState({ type: "loading" });
      setPanelOpen(true);

      const result = buildSimulationResultSync(nodes, t);
      setSimulationState({ type: "success", result });

      // Async enhancement: fetch real previews for custom templates in background
      enhanceWithCustomPreviews(nodes, result, t).then((enhanced) => {
        if (enhanced) {
          setSimulationState({ type: "success", result: enhanced });
        }
      });
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

// ─── Synchronous simulation result builder ───────────────────────────────────

function buildSimulationResultSync(
  nodes: BuilderNode[],
  t: (key: string, options?: Record<string, string>) => string,
): SimulationResult {
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

      const isCustomTemplate = selectedTemplate?.startsWith(CUSTOM_TEMPLATE_PREFIX) ?? false;

      emailPreviews.push({
        nodeId: action.id,
        nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
        subject: buildInitialSubject(selectedTemplate ?? "default_email", isCustomTemplate, t),
        senderAddress: "noreply@mentingo.com",
        recipientAddress: isCustomTemplate
          ? (sampleValues.user_email ?? "jan.kowalski@example.com")
          : (sampleValues.userEmail ?? "jan.kowalski@example.com"),
        htmlBody: buildInitialHtml(selectedTemplate ?? "default_email", previewLanguage, t),
      });
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

function buildInitialSubject(
  templateId: string,
  _isCustom: boolean,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  const previewLabel = t("automationBuilder.simulation.preview.label");
  return `${previewLabel}: ${templateId}`;
}

function buildInitialHtml(
  templateId: string,
  _language: string,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  const templateLabel = templateId;
  const systemTemplateNote = t("automationBuilder.simulation.preview.systemTemplateNote", {
    templateLabel,
  });
  const emailDescription = t("automationBuilder.simulation.preview.emailDescription");
  const platformName = t("automationBuilder.simulation.preview.platformName");

  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 12px; color: #92400e;">
          ${systemTemplateNote}
        </p>
      </div>
      <p style="color: #4a4a4a; line-height: 1.6;">
        ${emailDescription}
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 32px;">
        ${platformName}
      </p>
    </div>`;
}

// ─── Async enhancement for custom template previews ──────────────────────────

async function enhanceWithCustomPreviews(
  nodes: BuilderNode[],
  baseResult: SimulationResult,
  t: (key: string, options?: Record<string, string>) => string,
): Promise<SimulationResult | null> {
  if (baseResult.overallStatus !== "success") return null;

  const { sampleValues } = validateNodes(nodes, t);
  const actionNodes = nodes.filter((n) => n.kind === "action");
  let hasCustomTemplates = false;
  const updatedPreviews = [...baseResult.emailPreviews];

  for (let i = 0; i < actionNodes.length; i++) {
    const action = actionNodes[i];
    const selectedTemplate = action.config.emailTemplate as string | undefined;
    const selectedLanguage = (action.config.language as string) ?? "en";
    const previewLanguage = selectedLanguage === "user_default" ? "en" : selectedLanguage;
    const values = (action.config.placeholderValues as Record<string, string>) ?? {};

    const isCustomTemplate = selectedTemplate?.startsWith(CUSTOM_TEMPLATE_PREFIX) ?? false;

    if (isCustomTemplate) {
      hasCustomTemplates = true;
      const customId = selectedTemplate!.slice(CUSTOM_TEMPLATE_PREFIX.length);
      const preview = await fetchCustomTemplatePreview(
        customId,
        previewLanguage,
        values,
        sampleValues,
        t,
      );

      const previewIdx = updatedPreviews.findIndex((p) => p.nodeId === action.id);
      if (previewIdx >= 0) {
        updatedPreviews[previewIdx] = {
          ...updatedPreviews[previewIdx],
          subject: preview.subject,
          htmlBody: preview.html,
        };
      }
    } else {
      // Also fetch system template preview from API for better fidelity
      const preview = await fetchSystemTemplatePreview(
        selectedTemplate ?? "default_email",
        previewLanguage,
        values,
        t,
      );

      const previewIdx = updatedPreviews.findIndex((p) => p.nodeId === action.id);
      if (previewIdx >= 0) {
        updatedPreviews[previewIdx] = {
          ...updatedPreviews[previewIdx],
          subject: preview.subject,
          htmlBody: preview.html,
        };
      }
    }
  }

  // Only return enhanced result if we actually fetched something
  if (!hasCustomTemplates && actionNodes.length === 0) return null;

  return {
    ...baseResult,
    emailPreviews: updatedPreviews,
  };
}
