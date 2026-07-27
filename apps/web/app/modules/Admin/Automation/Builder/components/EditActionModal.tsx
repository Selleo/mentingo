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

import { getStepDefinition } from "../automationBuilder.types";
import { useBuilderStore } from "../automationBuilderStore";
import { DEFAULT_EMAIL_TEMPLATE_ID, EMAIL_TEMPLATES } from "../emailTemplates.constants";
import { useSaveAutomationSteps } from "../hooks/useSaveAutomationSteps";

import type { BuilderNode, TriggerType, PayloadVariable } from "../automationBuilder.types";
import type { FC } from "react";

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
  const { saveSteps } = useSaveAutomationSteps();

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

  // Get available trigger variables from the shared step definition
  const triggerVariables: PayloadVariable[] = useMemo(() => {
    if (!triggerType) return [];
    const def = getStepDefinition(triggerType);
    return def?.providedVariables ?? [];
  }, [triggerType]);

  const isDefaultTemplate = selectedTemplate === DEFAULT_EMAIL_TEMPLATE_ID;

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
    // Persist the updated step tree to the backend
    setTimeout(() => saveSteps(), 0);
    onClose();
  }, [
    node.id,
    selectedTemplate,
    selectedLanguage,
    placeholderValues,
    updateNodeConfig,
    onClose,
    saveSteps,
  ]);

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

            {isDefaultTemplate && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.defaultEmailNoMapping")}
              </p>
            )}

            {!isDefaultTemplate && !selectedTemplate && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.selectTemplateFirst")}
              </p>
            )}

            {!isDefaultTemplate && selectedTemplate && templatePlaceholders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.noPlaceholders")}
              </p>
            )}

            {!isDefaultTemplate && selectedTemplate && templatePlaceholders.length > 0 && (
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
                          <SelectItem key={variable.key} value={variable.key}>
                            {t(variable.labelKey)} ({`{{${variable.key}}}`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {!isDefaultTemplate && selectedTemplate && triggerVariables.length === 0 && (
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
