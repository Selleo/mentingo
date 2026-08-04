import { getStepDefinition } from "../automationBuilder.types";
import { DEFAULT_EMAIL_TEMPLATE_ID, EMAIL_TEMPLATES } from "../emailTemplates.constants";

import type { BuilderNode } from "../automationBuilder.types";
import type {
  EventDataField,
  NodeValidationResult,
  PlaceholderMappingEntry,
  SimulationResult,
} from "../simulation.types";

function isSystemTemplateId(templateId: string): boolean {
  return (
    templateId !== DEFAULT_EMAIL_TEMPLATE_ID && EMAIL_TEMPLATES.some((t) => t.id === templateId)
  );
}

export function validateNodes(
  nodes: BuilderNode[],
  t: (key: string, options?: Record<string, string>) => string,
): {
  nodeResults: NodeValidationResult[];
  overallStatus: "success" | "failed";
  eventData: EventDataField[];
  placeholderMappings: SimulationResult["placeholderMappings"];
  sampleValues: Record<string, string>;
} {
  const sampleValues = getSampleValues(t);
  const triggerNode = nodes.find((n) => n.kind === "trigger");
  const actionNodes = nodes.filter((n) => n.kind === "action");

  const nodeResults: NodeValidationResult[] = [];

  if (triggerNode) {
    const triggerErrors: NodeValidationResult["errors"] = [];

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

  for (const action of actionNodes) {
    const actionErrors: NodeValidationResult["errors"] = [];

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

    const placeholderValues = (action.config.placeholderValues as Record<string, string>) ?? {};
    const selectedTemplateId = action.config.emailTemplate as string | undefined;
    const templateDef = selectedTemplateId
      ? EMAIL_TEMPLATES.find((tmpl) => tmpl.id === selectedTemplateId)
      : undefined;

    if (templateDef && selectedTemplateId && !isSystemTemplateId(selectedTemplateId)) {
      const unmappedPlaceholders = templateDef.placeholders.filter((p) => !placeholderValues[p]);

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

  const triggerDef = triggerNode ? getStepDefinition(triggerNode.type) : undefined;
  const eventData: EventDataField[] = (triggerDef?.providedVariables ?? []).map(
    (v: { key: string; labelKey: string; dataType?: "string" | "number" | "date" | "url" }) => ({
      key: v.key,
      label: t(v.labelKey),
      dataType: v.dataType ?? "string",
    }),
  );

  const placeholderMappings: SimulationResult["placeholderMappings"] = {};
  for (const action of actionNodes) {
    const values = (action.config.placeholderValues as Record<string, string>) ?? {};
    const entries: PlaceholderMappingEntry[] = Object.entries(values).map(
      ([placeholder, variable]) => ({
        placeholder,
        mappedVariable: variable || null,
        sampleValue: variable ? (sampleValues[variable] ?? null) : null,
      }),
    );
    if (entries.length > 0) {
      placeholderMappings[action.id] = entries;
    }
  }

  return { nodeResults, overallStatus, eventData, placeholderMappings, sampleValues };
}

const SAMPLE_URLS: Record<string, string> = {
  course_url: "https://app.mentingo.com/courses/abc123",
  invite_link: "https://app.mentingo.com/invite/xyz",
  reset_password_link: "https://app.mentingo.com/reset/token123",
  platform_url: "https://app.mentingo.com",
  certificate_url: "https://app.mentingo.com/certificates/cert-001",
  announcement_url: "https://app.mentingo.com/announcements/1",
  chat_url: "https://app.mentingo.com/chat/msg-001",
  courseUrl: "https://app.mentingo.com/courses/abc123",
  inviteLink: "https://app.mentingo.com/invite/xyz",
  resetPasswordLink: "https://app.mentingo.com/reset/token123",
  platformUrl: "https://app.mentingo.com",
  certificateUrl: "https://app.mentingo.com/certificates/cert-001",
  announcementUrl: "https://app.mentingo.com/announcements/1",
  chatUrl: "https://app.mentingo.com/chat/msg-001",
  profileLink: "https://app.mentingo.com/profile/sample-user",
  progressLink: "https://app.mentingo.com/progress/abc123",
};

const SAMPLE_DATES: Record<string, string> = {
  due_date: "2025-08-15",
  login_date: "2025-07-22",
  finished_at: "2025-07-20",
  expiration_date: "2025-12-31",
  registration_date: "2025-06-01",
  created_at: "2025-06-01",
  dueDate: "2025-08-15",
  loginDate: "2025-07-22",
  finishedAt: "2025-07-20",
  expirationDate: "2025-12-31",
  registrationDate: "2025-06-01",
  archivedAt: "2025-07-01",
};

function getSampleValues(t: (key: string) => string): Record<string, string> {
  const sd = (key: string) => t(`automationBuilder.simulation.sampleData.${key}`);

  const textValues: Record<string, string> = {
    user_first_name: sd("firstName"),
    user_last_name: sd("lastName"),
    user_email: sd("email"),
    course_name: sd("courseName"),
    chapter_name: sd("chapterName"),
    certificate_name: sd("certificateName"),
    announcement_title: sd("announcementTitle"),
    announcement_content: sd("announcementContent"),
    author_full_name: sd("authorFullName"),
    message_content: sd("messageContent"),
    days_left: sd("daysLeft"),
    days_inactive: sd("daysInactive"),
    userFirstName: sd("firstName"),
    userLastName: sd("lastName"),
    userEmail: sd("email"),
    courseName: sd("courseName"),
    chapterName: sd("chapterName"),
    certificateName: sd("certificateName"),
    announcementTitle: sd("announcementTitle"),
    announcementContent: sd("announcementContent"),
    authorFullName: sd("authorFullName"),
    messageContent: sd("messageContent"),
    daysLeft: sd("daysLeft"),
    daysInactive: sd("daysInactive"),
    userName: sd("fullName"),
    invitedByUserName: sd("invitedByUserName"),
    hasCertificate: "true",
    archiveReason: "expired",
  };

  return { ...SAMPLE_URLS, ...SAMPLE_DATES, ...textValues };
}
