import { useCallback, useRef, useState } from "react";

import { getStepDefinition } from "../automationBuilder.types";
import { EMAIL_TEMPLATES } from "../emailTemplates.constants";

import type { BuilderNode } from "../automationBuilder.types";
import type { SimulationPanelState, SimulationResult } from "../components/SimulationPanel";

// ─── Mock simulation delay (ms) ─────────────────────────────────────────────
const SIMULATION_DELAY = 1500;

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
 * Mock simulation hook — performs client-side validation of the builder node tree
 * and produces a SimulationResult with sample data. No backend calls.
 */
export function useMockSimulation() {
  const [simulationState, setSimulationState] = useState<SimulationPanelState>({ type: "idle" });
  const [isSimulating, setIsSimulating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSimulation = useCallback((nodes: BuilderNode[]) => {
    // Cancel any in-progress mock timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setIsSimulating(true);
    setSimulationState({ type: "loading" });

    timerRef.current = setTimeout(() => {
      const result = buildMockResult(nodes);
      setSimulationState({ type: "success", result });
      setIsSimulating(false);
      setPanelOpen(true);
    }, SIMULATION_DELAY);
  }, []);

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
    isSimulating,
    panelOpen,
    runSimulation,
    closePanel,
    retry,
  };
}

// ─── Mock result builder ─────────────────────────────────────────────────────

function buildMockResult(nodes: BuilderNode[]): SimulationResult {
  const triggerNode = nodes.find((n) => n.kind === "trigger");
  const actionNodes = nodes.filter((n) => n.kind === "action");

  const nodeResults: SimulationResult["nodeResults"] = [];

  // Validate trigger
  if (triggerNode) {
    const triggerErrors: SimulationResult["nodeResults"][number]["errors"] = [];

    if (!triggerNode.type) {
      triggerErrors.push({
        nodeId: triggerNode.id,
        nodeName: triggerNode.label || "Zdarzenie startowe",
        field: "type",
        description: "Wybierz typ zdarzenia startowego",
      });
    }

    nodeResults.push({
      nodeId: triggerNode.id,
      nodeName: triggerNode.label || "Zdarzenie startowe",
      kind: "trigger",
      status: triggerErrors.length > 0 ? "invalid" : "valid",
      errors: triggerErrors,
    });
  } else {
    // No trigger at all — report as a global error on a virtual node
    nodeResults.push({
      nodeId: "missing-trigger",
      nodeName: "Zdarzenie startowe",
      kind: "trigger",
      status: "invalid",
      errors: [
        {
          nodeId: "missing-trigger",
          nodeName: "Zdarzenie startowe",
          field: "trigger",
          description: "Dodaj co najmniej jeden węzeł triggera",
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
        nodeName: action.label || "Wyślij e-mail",
        field: "emailTemplate",
        description: "Wybierz opublikowany szablon e-mail",
      });
    }

    if (!action.config.language) {
      actionErrors.push({
        nodeId: action.id,
        nodeName: action.label || "Wyślij e-mail",
        field: "language",
        description: "Wybierz język szablonu e-mail",
      });
    }

    // Check placeholder mappings against template definition
    const placeholderValues = (action.config.placeholderValues as Record<string, string>) ?? {};
    const selectedTemplateId = action.config.emailTemplate as string | undefined;
    const templateDef = selectedTemplateId
      ? EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId)
      : undefined;

    if (templateDef) {
      const unmappedPlaceholders = templateDef.placeholders.filter((p) => !placeholderValues[p]);

      if (unmappedPlaceholders.length > 0) {
        for (const placeholder of unmappedPlaceholders) {
          actionErrors.push({
            nodeId: action.id,
            nodeName: action.label || "Wyślij e-mail",
            field: `placeholderValues.${placeholder}`,
            description: `Placeholder {{${placeholder}}} nie jest zmapowany — przypisz zmienną zdarzenia`,
          });
        }
      }
    }

    nodeResults.push({
      nodeId: action.id,
      nodeName: action.label || "Wyślij e-mail",
      kind: "action",
      status: actionErrors.length > 0 ? "invalid" : "valid",
      errors: actionErrors,
    });
  }

  if (actionNodes.length === 0) {
    nodeResults.push({
      nodeId: "missing-action",
      nodeName: "Akcja",
      kind: "action",
      status: "invalid",
      errors: [
        {
          nodeId: "missing-action",
          nodeName: "Akcja",
          field: "action",
          description: "Dodaj co najmniej jeden węzeł akcji (np. Wyślij e-mail)",
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
      label: v.labelKey,
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
      const courseName = SAMPLE_VALUES[values.courseName ?? "course_name"] ?? "Szkolenie BHP 2025";
      const courseLink =
        SAMPLE_VALUES[values.courseLink ?? "course_url"] ??
        "https://app.mentingo.com/courses/abc123";

      emailPreviews.push({
        nodeId: action.id,
        nodeName: action.label || "Wyślij e-mail",
        subject: `Zostałeś przypisany do kursu: ${courseName}`,
        senderAddress: "noreply@mentingo.com",
        recipientAddress: "jan.kowalski@example.com",
        htmlBody: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a;">Cześć Jan!</h2>
            <p style="color: #4a4a4a; line-height: 1.6;">
              Zostałeś przypisany do nowego kursu: <strong>${courseName}</strong>.
            </p>
            <a href="${courseLink}"
               style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
              Przejdź do kursu
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
