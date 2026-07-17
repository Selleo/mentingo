export type TriggerType =
  | "course_deadline"
  | "overdue"
  | "not_completed"
  | "user_enrolled"
  | "certificate_expiring_soon"
  | "live_transmission_starting_soon";

export type ActionType = "send_email";

export type NodeKind = "trigger" | "action";

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

export interface AutomationStepDefinition {
  kind: NodeKind;
  type: TriggerType | ActionType;
  labelKey: string;
  icon: string;
  color: "blue" | "emerald";
  configFields: StepConfigField[];
}

// ---------------------------------------------------------------------------
// Trigger definitions
// ---------------------------------------------------------------------------

const COURSE_DEADLINE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_deadline",
  labelKey: "automationBuilder.blocks.courseDeadline",
  icon: "calendar-clock",
  color: "blue",
  configFields: [
    {
      key: "daysBefore",
      labelKey: "automationBuilder.config.daysBefore",
      type: "number",
      placeholderKey: "automationBuilder.config.daysBeforePlaceholder",
    },
    { key: "courseId", labelKey: "automationBuilder.config.course", type: "select", options: [] },
  ],
};

const OVERDUE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "overdue",
  labelKey: "automationBuilder.blocks.overdue",
  icon: "alert-triangle",
  color: "blue",
  configFields: [
    {
      key: "daysOverdue",
      labelKey: "automationBuilder.config.daysOverdue",
      type: "number",
      placeholderKey: "automationBuilder.config.daysOverduePlaceholder",
    },
  ],
};

const NOT_COMPLETED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "not_completed",
  labelKey: "automationBuilder.blocks.notCompleted",
  icon: "circle-x",
  color: "blue",
  configFields: [
    { key: "courseId", labelKey: "automationBuilder.config.course", type: "select", options: [] },
    {
      key: "daysEnrolled",
      labelKey: "automationBuilder.config.daysEnrolled",
      type: "number",
      placeholderKey: "automationBuilder.config.daysEnrolledPlaceholder",
    },
  ],
};

const USER_ENROLLED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_enrolled",
  labelKey: "automationBuilder.blocks.userEnrolled",
  icon: "user-plus",
  color: "blue",
  configFields: [
    { key: "courseId", labelKey: "automationBuilder.config.course", type: "select", options: [] },
  ],
};

const CERTIFICATE_EXPIRING_SOON_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "certificate_expiring_soon",
  labelKey: "automationBuilder.blocks.certificateExpiringSoon",
  icon: "award",
  color: "blue",
  configFields: [
    {
      key: "daysBefore",
      labelKey: "automationBuilder.config.daysBefore",
      type: "number",
      placeholderKey: "automationBuilder.config.daysBeforePlaceholder",
    },
  ],
};

const LIVE_TRANSMISSION_STARTING_SOON_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "live_transmission_starting_soon",
  labelKey: "automationBuilder.blocks.liveTransmissionStartingSoon",
  icon: "video",
  color: "blue",
  configFields: [
    {
      key: "minutesBefore",
      labelKey: "automationBuilder.config.minutesBefore",
      type: "number",
      placeholderKey: "automationBuilder.config.minutesBeforePlaceholder",
    },
  ],
};

// ---------------------------------------------------------------------------
// Action definitions
// ---------------------------------------------------------------------------

const SEND_EMAIL_ACTION: AutomationStepDefinition = {
  kind: "action",
  type: "send_email",
  labelKey: "automationBuilder.blocks.sendEmail",
  icon: "mail",
  color: "emerald",
  configFields: [
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
  ],
};

// ---------------------------------------------------------------------------
// Registry — single source of truth for all step definitions
// ---------------------------------------------------------------------------

export const STEP_DEFINITIONS: AutomationStepDefinition[] = [
  COURSE_DEADLINE_TRIGGER,
  OVERDUE_TRIGGER,
  NOT_COMPLETED_TRIGGER,
  USER_ENROLLED_TRIGGER,
  CERTIFICATE_EXPIRING_SOON_TRIGGER,
  LIVE_TRANSMISSION_STARTING_SOON_TRIGGER,
  SEND_EMAIL_ACTION,
];

export const TRIGGER_DEFINITIONS = STEP_DEFINITIONS.filter(
  (s): s is AutomationStepDefinition & { kind: "trigger" } => s.kind === "trigger",
);

export const ACTION_DEFINITIONS = STEP_DEFINITIONS.filter(
  (s): s is AutomationStepDefinition & { kind: "action" } => s.kind === "action",
);

export function getStepDefinition(
  type: TriggerType | ActionType,
): AutomationStepDefinition | undefined {
  return STEP_DEFINITIONS.find((s) => s.type === type);
}

// ---------------------------------------------------------------------------
// Sidebar block type (used for DnD)
// ---------------------------------------------------------------------------

export interface SidebarBlock {
  kind: NodeKind;
  type: TriggerType | ActionType;
  labelKey: string;
  icon: string;
}

export const TRIGGER_BLOCKS: SidebarBlock[] = TRIGGER_DEFINITIONS.map((d) => ({
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
  type: TriggerType | ActionType;
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
