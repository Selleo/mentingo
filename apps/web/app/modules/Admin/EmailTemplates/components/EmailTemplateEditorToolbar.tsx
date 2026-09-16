import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Archive, Check, Copy, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_STATUSES,
  EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS,
  EMAIL_TEMPLATE_STATUS_BADGE_ICONS,
} from "../emailTemplates.constants";

import type { EmailTemplate } from "../emailTemplates.types";
import type { SupportedLanguages } from "@repo/shared";

export type EmailTemplateEditorToolbarProps = {
  template: EmailTemplate;
  language: SupportedLanguages;
  isTranslationComplete: boolean;
  isActionPending: boolean;
  hasUnsavedChanges: boolean;
  onLanguageChange: (language: SupportedLanguages) => void;
  onSetBaseLanguage: () => void;
  onSendTest: () => void;
  onCopyDefault: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onSave: () => void;
  onPublish: () => void;
};

export function EmailTemplateEditorToolbar({
  template,
  language,
  isTranslationComplete,
  isActionPending,
  hasUnsavedChanges,
  onLanguageChange,
  onSetBaseLanguage,
  onSendTest,
  onCopyDefault,
  onDuplicate,
  onDelete,
  onArchive,
  onRestore,
  onSave,
  onPublish,
}: EmailTemplateEditorToolbarProps) {
  const { t } = useTranslation();
  const isReadonly = !template.editable || template.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="h4">
          {template.name[template.baseLanguage] || t("emailTemplates.ui.editor")}
        </h4>
        <Badge
          variant={
            EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS[template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM]
          }
          fontWeight="bold"
          icon={
            EMAIL_TEMPLATE_STATUS_BADGE_ICONS[template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM]
          }
          iconClasses="size-4"
          className="w-fit"
        >
          {t(`emailTemplates.ui.${template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM}`)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="space-y-2">
            <fieldset
              disabled={isActionPending}
              aria-label={t("emailTemplates.ui.language")}
              className="[&_button]:h-10"
            >
              <LanguageSelector
                formKey={template.id ?? template.event}
                value={language}
                baseLanguage={template.baseLanguage}
                availableLocales={Object.values(SUPPORTED_LANGUAGES)}
                onChange={(nextLanguage) => {
                  if (!isActionPending) onLanguageChange(nextLanguage);
                }}
                canCreateLanguage={false}
                canDeleteLanguage={false}
                canSetBaseLanguage={false}
              />
            </fieldset>
          </div>
          {!isReadonly && (
            <Button
              variant="outline"
              disabled={
                isActionPending ||
                hasUnsavedChanges ||
                language === template.baseLanguage ||
                !isTranslationComplete
              }
              onClick={onSetBaseLanguage}
            >
              {t("emailTemplates.ui.setBaseLanguage")}
            </Button>
          )}
        </div>
        <div
          className="flex h-10 items-center gap-1 rounded-lg border bg-white p-1 [&>button]:h-full"
          role="group"
          aria-label={t("emailTemplates.ui.sendTest")}
        >
          <Button
            variant="ghost"
            size="icon"
            title={t("emailTemplates.ui.sendTest")}
            aria-label={t("emailTemplates.ui.sendTest")}
            disabled={isActionPending}
            onClick={onSendTest}
          >
            <Send className="size-4" />
          </Button>
        </div>
        {!template.editable ? (
          <Button disabled={isActionPending} onClick={onCopyDefault}>
            <Copy className="mr-2 size-4" />
            {t("emailTemplates.ui.copyDefault")}
          </Button>
        ) : (
          <>
            <div
              className="flex h-10 items-center gap-1 rounded-lg border bg-white p-1 [&>button]:h-full"
              role="group"
              aria-label={t("emailTemplates.ui.actions")}
            >
              <Button
                variant="ghost"
                size="icon"
                title={t("emailTemplates.ui.duplicate")}
                aria-label={t("emailTemplates.ui.duplicate")}
                disabled={isActionPending || hasUnsavedChanges}
                onClick={onDuplicate}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={t("emailTemplates.ui.delete")}
                aria-label={t("emailTemplates.ui.delete")}
                disabled={isActionPending || hasUnsavedChanges}
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
              </Button>
              {template.status !== EMAIL_TEMPLATE_STATUSES.ARCHIVED && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("emailTemplates.ui.archive")}
                  aria-label={t("emailTemplates.ui.archive")}
                  disabled={isActionPending || hasUnsavedChanges}
                  onClick={onArchive}
                >
                  <Archive className="size-4" />
                </Button>
              )}
            </div>
            {template.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED ? (
              <Button disabled={isActionPending} onClick={onRestore}>
                <RotateCcw className="mr-2 size-4" />
                {t("emailTemplates.ui.restore")}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  data-testid={EMAIL_TEMPLATES_HANDLES.SAVE}
                  disabled={isActionPending || !hasUnsavedChanges}
                  onClick={onSave}
                >
                  <Save className="mr-2 size-4" />
                  {t(
                    template.status === EMAIL_TEMPLATE_STATUSES.PUBLISHED
                      ? "emailTemplates.ui.save"
                      : "emailTemplates.ui.saveDraft",
                  )}
                </Button>
                {template.status !== EMAIL_TEMPLATE_STATUSES.PUBLISHED && (
                  <Button
                    data-testid={EMAIL_TEMPLATES_HANDLES.PUBLISH}
                    disabled={isActionPending}
                    onClick={onPublish}
                  >
                    <Check className="mr-2 size-4" />
                    {t("emailTemplates.ui.publish")}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
