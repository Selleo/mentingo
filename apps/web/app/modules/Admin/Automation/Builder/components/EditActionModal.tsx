import { Loader2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";

import { getStepDefinition } from "../automationBuilder.types";
import { useBuilderStore } from "../automationBuilderStore";
import { DEFAULT_EMAIL_TEMPLATE_ID, EMAIL_TEMPLATES } from "../emailTemplates.constants";
import { useSaveAutomationSteps } from "../hooks/useSaveAutomationSteps";

import type { BuilderNode, TriggerType, PayloadVariable } from "../automationBuilder.types";
import type { AutomationEmailTemplateOption } from "../hooks/useEmailTemplatesForAutomation";
import type { FC } from "react";

const CUSTOM_TEMPLATE_PREFIX = "custom:";

const USER_DEFAULT_LANGUAGE = "user_default";

type LanguageOption =
  | { value: string; labelKey: string; label?: undefined }
  | { value: string; label: string; labelKey?: undefined };

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: USER_DEFAULT_LANGUAGE, labelKey: "automationBuilder.editAction.userDefaultLanguage" },
  { value: "en", label: "English" },
  { value: "pl", label: "Polski" },
  { value: "de", label: "Deutsch" },
  { value: "lt", label: "Lietuvių" },
  { value: "cs", label: "Čeština" },
  { value: "es", label: "Español" },
];

interface EditActionModalProps {
  open: boolean;
  onClose: () => void;
  node: BuilderNode;
  customTemplates: AutomationEmailTemplateOption[];
  isLoadingCustomTemplates: boolean;
}

export const EditActionModal: FC<EditActionModalProps> = ({
  open,
  onClose,
  node,
  customTemplates,
  isLoadingCustomTemplates,
}) => {
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
    (node.config.language as string) ?? "user_default",
  );
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>(
    (node.config.placeholderValues as Record<string, string>) ?? {},
  );

  const triggerVariables: PayloadVariable[] = useMemo(() => {
    if (!triggerType) return [];
    const def = getStepDefinition(triggerType);
    return def?.providedVariables ?? [];
  }, [triggerType]);

  const isDefaultTemplate = selectedTemplate === DEFAULT_EMAIL_TEMPLATE_ID;
  const isCustomTemplate = selectedTemplate.startsWith(CUSTOM_TEMPLATE_PREFIX);
  const isSystemTemplate =
    !isDefaultTemplate &&
    !isCustomTemplate &&
    EMAIL_TEMPLATES.some((t) => t.id === selectedTemplate);

  const templatePlaceholders = useMemo(() => {
    if (isCustomTemplate) {
      const customId = selectedTemplate.slice(CUSTOM_TEMPLATE_PREFIX.length);
      const custom = customTemplates.find((t) => t.id === customId);
      return custom?.placeholders ?? [];
    }
    const template = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplate);
    return template?.placeholders ?? [];
  }, [selectedTemplate, isCustomTemplate, customTemplates]);

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

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-1/2 flex-col gap-6 overflow-y-auto border-r p-6">
            <div>
              <h3 className="mb-4 text-base font-semibold">
                {t("automationBuilder.editAction.sendEmail")}
              </h3>

              <div className="space-y-2">
                <Label>{t("automationBuilder.editAction.emailTemplate")}</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("automationBuilder.editAction.selectTemplate")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>
                        {t("automationBuilder.editAction.defaultTemplatesGroup")}
                      </SelectLabel>
                      {EMAIL_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {t(template.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>

                    <SelectGroup>
                      <SelectLabel>
                        {t("automationBuilder.editAction.customTemplatesGroup")}
                      </SelectLabel>
                      {isLoadingCustomTemplates && (
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                          <Loader2 className="size-3 animate-spin" />
                          {t("common.other.loading")}
                        </div>
                      )}
                      {!isLoadingCustomTemplates && customTemplates.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {t("automationBuilder.editAction.noCustomTemplates")}
                        </div>
                      )}
                      {customTemplates.map((template) => (
                        <SelectItem
                          key={template.id}
                          value={`${CUSTOM_TEMPLATE_PREFIX}${template.id}`}
                        >
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 space-y-2">
                <Label>{t("automationBuilder.editAction.language")}</Label>
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.labelKey ? t(lang.labelKey) : lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex w-1/2 flex-col overflow-y-auto p-6">
            <h3 className="mb-4 text-base font-semibold">
              {t("automationBuilder.editAction.placeholders")}
            </h3>

            {isDefaultTemplate && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.defaultEmailNoMapping")}
              </p>
            )}

            {isSystemTemplate && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.systemTemplateNoMapping")}
              </p>
            )}

            {!isDefaultTemplate && !isSystemTemplate && !selectedTemplate && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.editAction.selectTemplateFirst")}
              </p>
            )}

            {!isDefaultTemplate &&
              !isSystemTemplate &&
              selectedTemplate &&
              templatePlaceholders.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("automationBuilder.editAction.noPlaceholders")}
                </p>
              )}

            {!isDefaultTemplate &&
              !isSystemTemplate &&
              selectedTemplate &&
              templatePlaceholders.length > 0 && (
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

            {!isDefaultTemplate &&
              !isSystemTemplate &&
              selectedTemplate &&
              triggerVariables.length === 0 && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700">
                    {t("automationBuilder.editAction.noTriggerVariables")}
                  </p>
                </div>
              )}
          </div>
        </div>

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
