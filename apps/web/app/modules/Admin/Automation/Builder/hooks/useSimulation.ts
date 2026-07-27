import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { getStepDefinition } from "../automationBuilder.types";
import { EMAIL_TEMPLATES } from "../emailTemplates.constants";

import type { BuilderNode } from "../automationBuilder.types";
import type { SimulationPanelState, SimulationResult } from "../components/SimulationPanel";

// ─── Sample data for template variable substitution ──────────────────────────
const SAMPLE_VALUES: Record<string, string> = {
  user_first_name: "Jan",
  user_last_name: "Kowalski",
  user_email: "jan.kowalski@example.com",
  course_name: "Szkolenie BHP 2025",
  course_url: "https://app.mentingo.com/courses/abc123",
  due_date: "2025-08-15",
  invite_link: "https://app.mentingo.com/invite/xyz",
  reset_password_link: "https://app.mentingo.com/reset/token123",
  platform_url: "https://app.mentingo.com",
  login_date: "2025-07-22",
  chapter_name: "Rozdział 1: Wprowadzenie",
  finished_at: "2025-07-20",
  certificate_url: "https://app.mentingo.com/certificates/cert-001",
  certificate_name: "Certyfikat BHP",
  expiration_date: "2025-12-31",
  days_left: "30",
  days_inactive: "14",
  registration_date: "2025-06-01",
  created_at: "2025-06-01",
  announcement_title: "Nowe szkolenie dostępne",
  announcement_content: "Zapraszamy na nowe szkolenie...",
  announcement_url: "https://app.mentingo.com/announcements/1",
  author_full_name: "Anna Nowak",
  message_content: "Hej, sprawdź to!",
  chat_url: "https://app.mentingo.com/chat/msg-001",
};

/**
 * Simulation hook — performs client-side validation of the builder node tree
 * and produces a SimulationResult with sample data. No backend calls.
 */
export function useSimulation() {
  const { t } = useTranslation();
  const [simulationState, setSimulationState] = useState<SimulationPanelState>({ type: "idle" });
  const [panelOpen, setPanelOpen] = useState(false);

  const runSimulation = useCallback(
    (nodes: BuilderNode[]) => {
      const result = buildSimulationResult(nodes, t);
      setSimulationState({ type: "success", result });
      setPanelOpen(true);
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
    isSimulating: false,
    panelOpen,
    runSimulation,
    closePanel,
    retry,
  };
}

// ─── Simulation result builder ───────────────────────────────────────────────

function buildSimulationResult(
  nodes: BuilderNode[],
  t: (key: string, options?: Record<string, string>) => string,
): SimulationResult {
  const triggerNode = nodes.find((n) => n.kind === "trigger");
  const actionNodes = nodes.filter((n) => n.kind === "action");

  const nodeResults: SimulationResult["nodeResults"] = [];

  // Validate trigger
  if (triggerNode) {
    const triggerErrors: SimulationResult["nodeResults"][number]["errors"] = [];

    if (!triggerNode.type) {
      triggerErrors.push({
        nodeId: triggerNode.id,
        nodeName: triggerNode.label || t("automationBuilder.simulation.errors.triggerNodeName"),
        field: "type",
        description: t("automationBuilder.simulation.errors.selectTriggerType"),
      });
    }

    nodeResults.push({
      nodeId: triggerNode.id,
      nodeName: triggerNode.label || t("automationBuilder.simulation.errors.triggerNodeName"),
      kind: "trigger",
      status: triggerErrors.length > 0 ? "invalid" : "valid",
      errors: triggerErrors,
    });
  } else {
    // No trigger at all — report as a global error on a virtual node
    nodeResults.push({
      nodeId: "missing-trigger",
      nodeName: t("automationBuilder.simulation.errors.triggerNodeName"),
      kind: "trigger",
      status: "invalid",
      errors: [
        {
          nodeId: "missing-trigger",
          nodeName: t("automationBuilder.simulation.errors.triggerNodeName"),
          field: "trigger",
          description: t("automationBuilder.simulation.errors.addTriggerNode"),
        },
      ],
    });
  }

  // Validate each action node
  for (const action of actionNodes) {
    const actionErrors: SimulationResult["nodeResults"][number]["errors"] = [];

    if (!action.config.emailTemplate) {
      actionErrors.push({
        nodeId: action.id,
        nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
        field: "emailTemplate",
        description: t("automationBuilder.simulation.errors.selectEmailTemplate"),
      });
    }

    if (!action.config.language) {
      actionErrors.push({
        nodeId: action.id,
        nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
        field: "language",
        description: t("automationBuilder.simulation.errors.selectLanguage"),
      });
    }

    // Check placeholder mappings against template definition
    const placeholderValues = (action.config.placeholderValues as Record<string, string>) ?? {};
    const selectedTemplateId = action.config.emailTemplate as string | undefined;
    const templateDef = selectedTemplateId
      ? EMAIL_TEMPLATES.find((tmpl) => tmpl.id === selectedTemplateId)
      : undefined;

    if (templateDef) {
      const unmappedPlaceholders = templateDef.placeholders.filter((p) => !placeholderValues[p]);

      if (unmappedPlaceholders.length > 0) {
        for (const placeholder of unmappedPlaceholders) {
          actionErrors.push({
            nodeId: action.id,
            nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
            field: `placeholderValues.${placeholder}`,
            description: t("automationBuilder.simulation.errors.unmappedPlaceholder", {
              placeholder,
            }),
          });
        }
      }
    }

    nodeResults.push({
      nodeId: action.id,
      nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
      kind: "action",
      status: actionErrors.length > 0 ? "invalid" : "valid",
      errors: actionErrors,
    });
  }

  if (actionNodes.length === 0) {
    nodeResults.push({
      nodeId: "missing-action",
      nodeName: t("automationBuilder.simulation.errors.actionLabel"),
      kind: "action",
      status: "invalid",
      errors: [
        {
          nodeId: "missing-action",
          nodeName: t("automationBuilder.simulation.errors.actionLabel"),
          field: "action",
          description: t("automationBuilder.simulation.errors.addActionNode"),
        },
      ],
    });
  }

  const overallStatus = nodeResults.every((nr) => nr.status === "valid") ? "success" : "failed";

  // Build event data from trigger definition
  const triggerDef = triggerNode ? getStepDefinition(triggerNode.type) : undefined;
  const eventData: SimulationResult["eventData"] = (triggerDef?.providedVariables ?? []).map(
    (v) => ({
      key: v.key,
      label: t(v.labelKey),
      dataType: v.dataType ?? "string",
    }),
  );

  // Build placeholder mappings per action node (only for valid actions)
  const placeholderMappings: SimulationResult["placeholderMappings"] = {};
  for (const action of actionNodes) {
    const values = (action.config.placeholderValues as Record<string, string>) ?? {};
    const entries = Object.entries(values).map(([placeholder, variable]) => ({
      placeholder,
      mappedVariable: variable || null,
      sampleValue: variable ? (SAMPLE_VALUES[variable] ?? null) : null,
    }));
    if (entries.length > 0) {
      placeholderMappings[action.id] = entries;
    }
  }

  // Build email previews for valid send_email actions
  const emailPreviews: SimulationResult["emailPreviews"] = [];
  if (overallStatus === "success") {
    for (const action of actionNodes) {
      const values = (action.config.placeholderValues as Record<string, string>) ?? {};
      const courseName = SAMPLE_VALUES[values.courseName ?? "course_name"] ?? "Sample Course 2025";
      const courseLink =
        SAMPLE_VALUES[values.courseLink ?? "course_url"] ??
        "https://app.mentingo.com/courses/abc123";

      emailPreviews.push({
        nodeId: action.id,
        nodeName: action.label || t("automationBuilder.simulation.errors.actionNodeName"),
        subject: t("automationBuilder.simulation.preview.subject", { courseName }),
        senderAddress: "noreply@mentingo.com",
        recipientAddress: "jan.kowalski@example.com",
        htmlBody: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a;">${t("automationBuilder.simulation.preview.greeting", { name: "Jan" })}</h2>
            <p style="color: #4a4a4a; line-height: 1.6;">
              ${t("automationBuilder.simulation.preview.assignedToCourse", { courseName })}
            </p>
            <a href="${courseLink}"
               style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
              ${t("automationBuilder.simulation.preview.goToCourse")}
            </a>
            <p style="color: #888; font-size: 12px; margin-top: 32px;">
              Mentingo Learning Platform
            </p>
          </div>
        `,
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
