import {
  Archive,
  ChevronDown,
  Copy,
  MoreVertical,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import { EMAIL_TEMPLATE_STATUSES } from "../emailTemplates.constants";

import type { EmailTemplate } from "../emailTemplates.types";
import type { SupportedLanguages } from "@repo/shared";

const menuItemClassName =
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export type EmailTemplateEditorToolbarProps = {
  template: EmailTemplate;
  language: SupportedLanguages;
  isTranslationComplete: boolean;
  isActionPending: boolean;
  hasUnsavedChanges: boolean;
  onLanguageChange: (language: SupportedLanguages) => void;
  onCreateLanguage: (language: SupportedLanguages) => Promise<void>;
  onDeleteLanguage: (language: SupportedLanguages) => Promise<void>;
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
  onCreateLanguage,
  onDeleteLanguage,
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
  const publishControlsRef = useRef<HTMLDivElement>(null);
  const [saveMenuWidth, setSaveMenuWidth] = useState<number>();
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const isArchived = template.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED;
  const isReadonly = !template.editable || isArchived;
  const canSaveDraft = !isActionPending && !isReadonly && hasUnsavedChanges;
  const canPublish =
    !isActionPending &&
    !isReadonly &&
    (hasUnsavedChanges ||
      template.hasUnpublishedChanges ||
      template.status !== EMAIL_TEMPLATE_STATUSES.PUBLISHED);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="h4 truncate">
          {template.name[language] ||
            template.name[template.baseLanguage] ||
            t("emailTemplates.ui.editor")}
        </h1>
        <p className="text-xs text-neutral-500" data-testid={EMAIL_TEMPLATES_HANDLES.STATUS}>
          {t(`emailTemplates.ui.${template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM}`)}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {hasUnsavedChanges && (
          <span
            className="inline-flex h-10 items-center text-xs leading-none text-neutral-500"
            role="status"
          >
            {t("emailTemplates.ui.unsavedTitle")}
          </span>
        )}
        <fieldset
          disabled={isActionPending}
          aria-label={t("emailTemplates.ui.language")}
          className="[&_button]:h-10"
        >
          <LanguageSelector
            testIds={{
              select: EMAIL_TEMPLATES_HANDLES.LANGUAGE,
              option: EMAIL_TEMPLATES_HANDLES.LANGUAGE_OPTION,
              createDialog: EMAIL_TEMPLATES_HANDLES.LANGUAGE_CREATE_DIALOG,
              createConfirmButton: EMAIL_TEMPLATES_HANDLES.LANGUAGE_CREATE_CONFIRM,
              deleteButton: EMAIL_TEMPLATES_HANDLES.LANGUAGE_DELETE,
            }}
            formKey={template.id ?? template.event ?? "builtin"}
            value={language}
            baseLanguage={template.baseLanguage}
            availableLocales={template.availableLocales}
            onChange={(nextLanguage) => {
              if (!isActionPending) onLanguageChange(nextLanguage);
            }}
            onCreateLanguage={onCreateLanguage}
            onDeleteLanguage={onDeleteLanguage}
            canCreateLanguage={!isReadonly}
            canDeleteLanguage={!isReadonly && !hasUnsavedChanges}
            canSetBaseLanguage={false}
          />
        </fieldset>
        {!isReadonly && (
          <Button
            variant="outline"
            disabled={
              isActionPending ||
              hasUnsavedChanges ||
              language === template.baseLanguage ||
              !isTranslationComplete
            }
            data-testid={EMAIL_TEMPLATES_HANDLES.BASE_LANGUAGE}
            onClick={onSetBaseLanguage}
          >
            {t("emailTemplates.ui.setBaseLanguage")}
          </Button>
        )}
        {!template.editable && (
          <Button
            disabled={isActionPending}
            data-testid={EMAIL_TEMPLATES_HANDLES.COPY}
            onClick={onCopyDefault}
          >
            <Copy className="mr-2 size-4" />
            {t("emailTemplates.ui.copyDefault")}
          </Button>
        )}
        {template.editable && isArchived && (
          <Button
            disabled={isActionPending}
            data-testid={EMAIL_TEMPLATES_HANDLES.RESTORE}
            onClick={onRestore}
          >
            <RotateCcw className="mr-2 size-4" />
            {t("emailTemplates.ui.restore")}
          </Button>
        )}
        {!isReadonly && (
          <div
            ref={publishControlsRef}
            className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center"
          >
            <span
              aria-hidden="true"
              className="invisible pointer-events-none col-span-2 col-start-1 row-start-1 flex h-0 items-center justify-center gap-2 whitespace-nowrap px-3 text-sm font-medium"
            >
              <Save className="size-4 shrink-0" />
              {t("emailTemplates.ui.saveDraft")}
            </span>
            <Button
              variant="primary"
              className={cn("col-start-1 row-start-1 whitespace-nowrap rounded-r-none", {
                "rounded-bl-none": isSaveMenuOpen,
              })}
              data-testid={EMAIL_TEMPLATES_HANDLES.PUBLISH}
              disabled={!canPublish}
              onClick={onPublish}
            >
              {t("emailTemplates.ui.publish")}
            </Button>
            <DropdownMenu
              open={isSaveMenuOpen}
              onOpenChange={(open) => {
                setIsSaveMenuOpen(open);
                if (open)
                  setSaveMenuWidth(publishControlsRef.current?.getBoundingClientRect().width);
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="primary"
                  className={cn(
                    "col-start-2 row-start-1 rounded-l-none border-l border-white/25 px-2",
                    {
                      "rounded-br-none": isSaveMenuOpen,
                    },
                  )}
                  disabled={!canSaveDraft}
                  aria-label={t("emailTemplates.ui.saveDraft")}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={0}
                avoidCollisions={false}
                style={{ width: saveMenuWidth }}
                className="min-w-0 rounded-t-none rounded-b-lg border-0 bg-transparent p-0 shadow-none"
              >
                <DropdownMenuItem
                  className="flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-t-none rounded-b-lg border border-input bg-background px-3 text-sm font-medium text-primary-800 outline-none transition-colors hover:border-primary-500 focus:border-primary-500 focus:bg-primary-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  data-testid={EMAIL_TEMPLATES_HANDLES.SAVE}
                  disabled={!canSaveDraft}
                  onSelect={onSave}
                >
                  <Save className="size-4 shrink-0" />
                  {t("emailTemplates.ui.saveDraft")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("emailTemplates.ui.actions")}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48 space-y-1 p-2">
            <DropdownMenuItem
              className={menuItemClassName}
              disabled={isActionPending}
              data-testid={EMAIL_TEMPLATES_HANDLES.SEND_TEST}
              onSelect={onSendTest}
            >
              <Send className="size-4" />
              {t("emailTemplates.ui.sendTest")}
            </DropdownMenuItem>
            {template.editable && (
              <>
                <DropdownMenuItem
                  className={menuItemClassName}
                  disabled={isActionPending || hasUnsavedChanges}
                  data-testid={EMAIL_TEMPLATES_HANDLES.DUPLICATE}
                  onSelect={onDuplicate}
                >
                  <Copy className="size-4" />
                  {t("emailTemplates.ui.duplicate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!isArchived && (
                  <DropdownMenuItem
                    className={cn(
                      menuItemClassName,
                      "text-error-700 focus:bg-error-50 focus:text-error-700",
                    )}
                    disabled={isActionPending || hasUnsavedChanges}
                    data-testid={EMAIL_TEMPLATES_HANDLES.ARCHIVE}
                    onSelect={onArchive}
                  >
                    <Archive className="size-4" />
                    {t("emailTemplates.ui.archive")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className={cn(
                    menuItemClassName,
                    "text-error-700 focus:bg-error-50 focus:text-error-700",
                  )}
                  disabled={isActionPending || hasUnsavedChanges}
                  data-testid={EMAIL_TEMPLATES_HANDLES.DELETE}
                  onSelect={onDelete}
                >
                  <Trash2 className="size-4" />
                  {t("emailTemplates.ui.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
