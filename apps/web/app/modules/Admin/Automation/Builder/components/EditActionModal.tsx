import { X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";

import { useBuilderStore } from "../automationBuilderStore";

import type { BuilderNode, TriggerType } from "../automationBuilder.types";
import type { FC } from "react";

// ─── Email template definitions with their placeholders ──────────────────────

//-----------------------------Placeholder definitions for email templates-----------------------------

interface EmailTemplateDefinition {
  id: string;
  labelKey: string;
  placeholders: string[];
}

const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    id: "user_invite",
    labelKey: "automationBuilder.editAction.templates.userInvite",
    placeholders: ["invitedByUserName", "createPasswordLink"],
  },
  {
    id: "welcome",
    labelKey: "automationBuilder.editAction.templates.welcome",
    placeholders: ["coursesLink"],
  },
  {
    id: "user_first_login",
    labelKey: "automationBuilder.editAction.templates.userFirstLogin",
    placeholders: ["name", "coursesUrl"],
  },
  {
    id: "user_assigned_to_course",
    labelKey: "automationBuilder.editAction.templates.userAssignedToCourse",
    placeholders: ["courseName", "courseLink", "formatedCourseDueDate"],
  },
  {
    id: "user_short_inactivity",
    labelKey: "automationBuilder.editAction.templates.userShortInactivity",
    placeholders: ["courseName", "courseLink"],
  },
  {
    id: "user_long_inactivity",
    labelKey: "automationBuilder.editAction.templates.userLongInactivity",
    placeholders: ["courseName", "courseLink"],
  },
  {
    id: "user_finished_chapter",
    labelKey: "automationBuilder.editAction.templates.userFinishedChapter",
    placeholders: ["chapterName", "courseName", "courseLink"],
  },
  {
    id: "user_finished_course",
    labelKey: "automationBuilder.editAction.templates.userFinishedCourse",
    placeholders: ["courseName", "buttonLink", "hasCertificate"],
  },
  {
    id: "create_password_reminder",
    labelKey: "automationBuilder.editAction.templates.createPasswordReminder",
    placeholders: ["createPasswordLink"],
  },
  {
    id: "certificate_expiration_warning",
    labelKey: "automationBuilder.editAction.templates.certificateExpirationWarning",
    placeholders: ["courseName", "courseLink", "expiresAt"],
  },
  {
    id: "certificate_expired",
    labelKey: "automationBuilder.editAction.templates.certificateExpired",
    placeholders: ["courseName", "courseLink"],
  },
  {
    id: "announcement",
    labelKey: "automationBuilder.editAction.templates.announcement",
    placeholders: ["title", "content", "buttonLink"],
  },
  {
    id: "course_due_date_reminder",
    labelKey: "automationBuilder.editAction.templates.courseDueDateReminder",
    placeholders: ["courseName", "courseLink", "dueDate", "daysBeforeDueDate"],
  },
  {
    id: "new_user",
    labelKey: "automationBuilder.editAction.templates.newUser",
    placeholders: ["userName", "profileLink"],
  },
  {
    id: "finished_course",
    labelKey: "automationBuilder.editAction.templates.finishedCourse",
    placeholders: ["userName", "courseName", "progressLink"],
  },
];

// ─── Trigger variable definitions ────────────────────────────────────────────
// Each trigger type provides a set of variables that can be used to fill placeholders

const TRIGGER_VARIABLES: Record<TriggerType, string[]> = {
  user_invited: ["email", "userId", "invitedByUserName", "createPasswordLink", "origin"],
  users_imported_invite: ["email", "userId", "invitedByUserName", "createPasswordLink", "origin"],
  user_password_reminder: ["email", "userId", "createPasswordLink"],
  user_password_changed: ["email", "userId"],
  user_welcome: ["email", "userId", "coursesLink", "origin"],
  user_first_login: ["userId", "name", "coursesUrl"],
  users_assigned_to_course: [
    "courseId",
    "courseName",
    "courseLink",
    "formatedCourseDueDate",
    "studentIds",
  ],
  users_short_inactivity: ["userId", "email", "courseName", "courseLink"],
  users_long_inactivity: ["userId", "email", "courseName", "courseLink"],
  user_chapter_finished: [
    "userId",
    "courseId",
    "chapterId",
    "chapterName",
    "courseName",
    "courseLink",
  ],
  user_course_finished: ["userId", "courseId", "courseName", "buttonLink", "hasCertificate"],
  user_registered: ["userId", "userName", "email", "profileLink"],
  user_password_created: ["userId", "email"],
  course_completed: ["userId", "courseId", "courseName", "userName", "progressLink"],
  certificate_expiration_warning: ["userId", "courseName", "courseLink", "expiresAt"],
  certificate_archived: ["userId", "courseName", "courseLink"],
  announcement_published: ["title", "content", "buttonLink"],
  course_chat_user_mentioned: ["userId", "courseName", "courseLink", "mentionedBy"],
  course_due_date_reminder: [
    "userId",
    "courseId",
    "courseName",
    "courseLink",
    "dueDate",
    "daysBeforeDueDate",
  ],
};

// ─── Supported languages ─────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pl", label: "Polski" },
  { value: "de", label: "Deutsch" },
  { value: "lt", label: "Lietuvių" },
  { value: "cs", label: "Čeština" },
  { value: "es", label: "Español" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface EditActionModalProps {
  open: boolean;
  onClose: () => void;
  node: BuilderNode;
}

export const EditActionModal: FC<EditActionModalProps> = ({ open, onClose, node }) => {
  const { t } = useTranslation();
  const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);
  const nodes = useBuilderStore((s) => s.nodes);

  const triggerNode = nodes.find((n) => n.kind === "trigger");
  const triggerType = triggerNode?.type as TriggerType | undefined;

  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    (node.config.emailTemplate as string) ?? "",
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    (node.config.language as string) ?? "en",
  );
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>(
    (node.config.placeholderValues as Record<string, string>) ?? {},
  );

  // Get available trigger variables for select options
  const triggerVariables = useMemo(() => {
    if (!triggerType) return [];
    return TRIGGER_VARIABLES[triggerType] ?? [];
  }, [triggerType]);

  // Get placeholders from selected template
  const templatePlaceholders = useMemo(() => {
    const template = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplate);
    return template?.placeholders ?? [];
  }, [selectedTemplate]);

  const handleTemplateChange = useCallback((value: string) => {
    setSelectedTemplate(value);
    setPlaceholderValues({});
  }, []);

  const handleLanguageChange = useCallback((value: string) => {
    setSelectedLanguage(value);
  }, []);

  const handlePlaceholderChange = useCallback((placeholder: string, value: string) => {
    setPlaceholderValues((prev) => ({ ...prev, [placeholder]: value }));
  }, []);

  const handleSave = useCallback(() => {
    updateNodeConfig(node.id, {
      emailTemplate: selectedTemplate,
      language: selectedLanguage,
      placeholderValues,
    });
    onClose();
  }, [node.id, selectedTemplate, selectedLanguage, placeholderValues, updateNodeConfig, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="h-[90vh] max-w-[90vw] flex flex-col gap-0 p-0" noCloseButton>
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <div>
            <DialogTitle className="text-xl font-semibold">
              {t("automationBuilder.editAction.title")}
            </DialogTitle>
            <p className="mt-1 text-sm text-muted-foreground">{node.label}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8">
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <Separator />

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left side: Template & Language selection */}
          <div className="flex w-1/2 flex-col gap-6 overflow-y-auto border-r p-6">
            <div>
              <h3 className="mb-4 text-base font-semibold">
                {t("automationBuilder.editAction.sendEmail")}
              </h3>

              {/* Email Template Select */}
              <div className="space-y-2">
                <Label>{t("automationBuilder.editAction.emailTemplate")}</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("automationBuilder.editAction.selectTemplate")} />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {t(template.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language Select */}
              <div className="mt-4 space-y-2">
                <Label>{t("automationBuilder.editAction.language")}</Label>
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Right side: Placeholder mappings */}
          <div className="flex w-1/2 flex-col overflow-y-auto p-6">
            <h3 className="mb-4 text-base font-semibold">
              {t("automationBuilder.editAction.placeholders")}
            </h3>

            {!selectedTemplate && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.selectTemplateFirst")}
              </p>
            )}

            {selectedTemplate && templatePlaceholders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.noPlaceholders")}
              </p>
            )}

            {selectedTemplate && templatePlaceholders.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("automationBuilder.editAction.placeholdersDescription")}
                </p>

                {templatePlaceholders.map((placeholder) => (
                  <div key={placeholder} className="space-y-1.5">
                    <Label className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {`{{${placeholder}}}`}
                      </code>
                    </Label>
                    <Select
                      value={placeholderValues[placeholder] ?? ""}
                      onValueChange={(value) => handlePlaceholderChange(placeholder, value)}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("automationBuilder.editAction.selectVariable")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {triggerVariables.map((variable) => (
                          <SelectItem key={variable} value={variable}>
                            {`{{${variable}}}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {selectedTemplate && triggerVariables.length === 0 && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700">
                  {t("automationBuilder.editAction.noTriggerVariables")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t("common.button.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t("common.button.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
