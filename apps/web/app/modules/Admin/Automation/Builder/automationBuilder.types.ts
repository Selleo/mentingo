export type ConditionType =
  | "course_deadline"
  | "overdue"
  | "not_completed"
  | "user_enrolled"
  | "certificate_expiring_soon"
  | "live_transmission_starting_soon";

export type ActionType = "send_email";

export type NodeKind = "condition" | "action";

// ---------------------------------------------------------------------------
// Polymorphic step definitions
// ---------------------------------------------------------------------------

export interface StepConfigField {
  key: string;
  labelKey: string;
  type: "text" | "number" | "select" | "textarea";
  placeholderKey?: string;
  options?: { value: string; labelKey: string }[];
}

/**
 * Base abstract-like interface for all automation step definitions.
 * Each condition/action implements this via a concrete class below.
 */
export interface AutomationStepDefinition {
  kind: NodeKind;
  type: ConditionType | ActionType;
  labelKey: string;
  icon: string;
  color: "blue" | "emerald";
  configFields: StepConfigField[];
}

// ---------------------------------------------------------------------------
// Condition classes (polymorphic — each implements AutomationStepDefinition)
// ---------------------------------------------------------------------------

class CourseDeadlineCondition implements AutomationStepDefinition {
  kind = "condition" as const;
  type = "course_deadline" as const;
  labelKey = "automationBuilder.blocks.courseDeadline";
  icon = "calendar-clock";
  color = "blue" as const;
  configFields: StepConfigField[] = [
    {
      key: "daysBefore",
      labelKey: "automationBuilder.config.daysBefore",
      type: "number",
      placeholderKey: "automationBuilder.config.daysBeforePlaceholder",
    },
    { key: "courseId", labelKey: "automationBuilder.config.course", type: "select", options: [] },
  ];
}

class OverdueCondition implements AutomationStepDefinition {
  kind = "condition" as const;
  type = "overdue" as const;
  labelKey = "automationBuilder.blocks.overdue";
  icon = "alert-triangle";
  color = "blue" as const;
  configFields: StepConfigField[] = [
    {
      key: "daysOverdue",
      labelKey: "automationBuilder.config.daysOverdue",
      type: "number",
      placeholderKey: "automationBuilder.config.daysOverduePlaceholder",
    },
  ];
}

class NotCompletedCondition implements AutomationStepDefinition {
  kind = "condition" as const;
  type = "not_completed" as const;
  labelKey = "automationBuilder.blocks.notCompleted";
  icon = "circle-x";
  color = "blue" as const;
  configFields: StepConfigField[] = [
    { key: "courseId", labelKey: "automationBuilder.config.course", type: "select", options: [] },
    {
      key: "daysEnrolled",
      labelKey: "automationBuilder.config.daysEnrolled",
      type: "number",
      placeholderKey: "automationBuilder.config.daysEnrolledPlaceholder",
    },
  ];
}

class UserEnrolledCondition implements AutomationStepDefinition {
  kind = "condition" as const;
  type = "user_enrolled" as const;
  labelKey = "automationBuilder.blocks.userEnrolled";
  icon = "user-plus";
  color = "blue" as const;
  configFields: StepConfigField[] = [
    { key: "courseId", labelKey: "automationBuilder.config.course", type: "select", options: [] },
  ];
}

class CertificateExpiringSoonCondition implements AutomationStepDefinition {
  kind = "condition" as const;
  type = "certificate_expiring_soon" as const;
  labelKey = "automationBuilder.blocks.certificateExpiringSoon";
  icon = "award";
  color = "blue" as const;
  configFields: StepConfigField[] = [
    {
      key: "daysBefore",
      labelKey: "automationBuilder.config.daysBefore",
      type: "number",
      placeholderKey: "automationBuilder.config.daysBeforePlaceholder",
    },
  ];
}

class LiveTransmissionStartingSoonCondition implements AutomationStepDefinition {
  kind = "condition" as const;
  type = "live_transmission_starting_soon" as const;
  labelKey = "automationBuilder.blocks.liveTransmissionStartingSoon";
  icon = "video";
  color = "blue" as const;
  configFields: StepConfigField[] = [
    {
      key: "minutesBefore",
      labelKey: "automationBuilder.config.minutesBefore",
      type: "number",
      placeholderKey: "automationBuilder.config.minutesBeforePlaceholder",
    },
  ];
}

// ---------------------------------------------------------------------------
// Action classes
// ---------------------------------------------------------------------------

class SendEmailAction implements AutomationStepDefinition {
  kind = "action" as const;
  type = "send_email" as const;
  labelKey = "automationBuilder.blocks.sendEmail";
  icon = "mail";
  color = "emerald" as const;
  configFields: StepConfigField[] = [
    {
      key: "subject",
      labelKey: "automationBuilder.editPanel.emailSubject",
      type: "text",
      placeholderKey: "automationBuilder.editPanel.emailSubjectPlaceholder",
    },
    {
      key: "body",
      labelKey: "automationBuilder.editPanel.emailBody",
      type: "textarea",
      placeholderKey: "automationBuilder.editPanel.emailBodyPlaceholder",
    },
    {
      key: "recipient",
      labelKey: "automationBuilder.editPanel.emailRecipient",
      type: "select",
      options: [
        { value: "enrolled_user", labelKey: "automationBuilder.editPanel.recipientEnrolledUser" },
        { value: "admin", labelKey: "automationBuilder.editPanel.recipientAdmin" },
        { value: "manager", labelKey: "automationBuilder.editPanel.recipientManager" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Registry — single source of truth for all step definitions
// ---------------------------------------------------------------------------

export const STEP_DEFINITIONS: AutomationStepDefinition[] = [
  new CourseDeadlineCondition(),
  new OverdueCondition(),
  new NotCompletedCondition(),
  new UserEnrolledCondition(),
  new CertificateExpiringSoonCondition(),
  new LiveTransmissionStartingSoonCondition(),
  new SendEmailAction(),
];

export const CONDITION_DEFINITIONS = STEP_DEFINITIONS.filter((s) => s.kind === "condition");
export const ACTION_DEFINITIONS = STEP_DEFINITIONS.filter((s) => s.kind === "action");

export function getStepDefinition(
  type: ConditionType | ActionType,
): AutomationStepDefinition | undefined {
  return STEP_DEFINITIONS.find((s) => s.type === type);
}

// ---------------------------------------------------------------------------
// Legacy sidebar block type (kept for sidebar DnD compatibility)
// ---------------------------------------------------------------------------

export interface SidebarBlock {
  kind: NodeKind;
  type: ConditionType | ActionType;
  labelKey: string;
  icon: string;
}

export const CONDITION_BLOCKS: SidebarBlock[] = CONDITION_DEFINITIONS.map((d) => ({
  kind: d.kind,
  type: d.type,
  labelKey: d.labelKey,
  icon: d.icon,
}));

export const ACTION_BLOCKS: SidebarBlock[] = ACTION_DEFINITIONS.map((d) => ({
  kind: d.kind,
  type: d.type,
  labelKey: d.labelKey,
  icon: d.icon,
}));

// ---------------------------------------------------------------------------
// Node shape (used in store)
// ---------------------------------------------------------------------------

export interface BuilderNode {
  id: string;
  kind: NodeKind;
  type: ConditionType | ActionType;
  label: string;
  parentId: string | null;
  children: string[];
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface BuilderState {
  nodes: BuilderNode[];
  selectedNodeId: string | null;
  automationName: string;
  isActive: boolean;
  lastSavedAt: string | null;
}
