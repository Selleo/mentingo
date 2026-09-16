import { useNavigate } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useArchiveEmailTemplate } from "~/api/mutations/emailTemplates/useArchiveEmailTemplate";
import { useCopyDefaultEmailTemplate } from "~/api/mutations/emailTemplates/useCopyDefaultEmailTemplate";
import { useDeleteEmailTemplate } from "~/api/mutations/emailTemplates/useDeleteEmailTemplate";
import { useDuplicateEmailTemplate } from "~/api/mutations/emailTemplates/useDuplicateEmailTemplate";
import { usePublishEmailTemplate } from "~/api/mutations/emailTemplates/usePublishEmailTemplate";
import { useRestoreEmailTemplate } from "~/api/mutations/emailTemplates/useRestoreEmailTemplate";
import { useSendTestEmailTemplate } from "~/api/mutations/emailTemplates/useSendTestEmailTemplate";
import { useUpdateEmailTemplate } from "~/api/mutations/emailTemplates/useUpdateEmailTemplate";
import { useUpdateEmailTemplateBaseLanguage } from "~/api/mutations/emailTemplates/useUpdateEmailTemplateBaseLanguage";
import { useUploadEmailTemplateImage } from "~/api/mutations/emailTemplates/useUploadEmailTemplateImage";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { PageWrapper } from "~/components/PageWrapper";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";
import { UnsavedChangesExitGuard } from "~/modules/Admin/components/UnsavedChangesExitGuard";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_SOURCES,
  EMAIL_TEMPLATE_STATUSES,
  EMAIL_TEMPLATE_EVENT_OPTIONS,
  EMAIL_TEMPLATE_LIST_PATH,
} from "../emailTemplates.constants";
import {
  createEmptyEmailTemplateDocument,
  getEmailTemplateTranslationChanges,
  getEmailTemplateInvalidContentLanguage,
  isEmailTemplateTranslationComplete,
} from "../emailTemplates.utils";

import { EmailTemplateBlocks } from "./EmailTemplateBlocks";
import { EmailTemplateConfirmation } from "./EmailTemplateConfirmation";
import { EmailTemplateEditorToolbar } from "./EmailTemplateEditorToolbar";
import { EmailTemplateTextField } from "./EmailTemplateTextField";

import type {
  EmailTemplateConfirmationAction,
  EmailTemplate,
  EmailTemplateFormValues,
} from "../emailTemplates.types";
import type { SupportedLanguages } from "@repo/shared";

export type EmailTemplateEditorProps = { template: EmailTemplate };

export function EmailTemplateEditor({ template }: EmailTemplateEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: branding } = useGlobalSettings();
  const { data: logoUrl } = usePlatformLogo();

  const [savedTemplate, setSavedTemplate] = useState(template);

  const [formValues, setFormValues] = useState<EmailTemplateFormValues>(() => ({
    name: template.name,
    subject: template.subject,
    content: template.content,
  }));

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguages>(
    template.baseLanguage,
  );

  const [pendingConfirmation, setPendingConfirmation] =
    useState<EmailTemplateConfirmationAction>(null);
  const [formError, setFormError] = useState("");
  const [hasBlockValidationErrors, setHasBlockValidationErrors] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  const { mutateAsync: updateTemplate } = useUpdateEmailTemplate();
  const { mutateAsync: updateTemplateBaseLanguage } = useUpdateEmailTemplateBaseLanguage();
  const { mutateAsync: publishTemplate } = usePublishEmailTemplate();
  const { mutateAsync: deleteTemplate } = useDeleteEmailTemplate();
  const { mutateAsync: archiveTemplate } = useArchiveEmailTemplate();
  const { mutateAsync: restoreTemplate } = useRestoreEmailTemplate();
  const { mutateAsync: copyDefaultTemplate } = useCopyDefaultEmailTemplate();
  const { mutateAsync: duplicateTemplate } = useDuplicateEmailTemplate();
  const { mutateAsync: sendTestEmail } = useSendTestEmailTemplate();
  const { mutateAsync: uploadTemplateImage } = useUploadEmailTemplateImage();

  const isReadonly =
    !savedTemplate.editable || savedTemplate.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED;

  const hasUnsavedChanges =
    JSON.stringify(formValues) !==
    JSON.stringify({
      name: savedTemplate.name,
      subject: savedTemplate.subject,
      content: savedTemplate.content,
    });

  const activeLanguageDocument =
    formValues.content[selectedLanguage] ?? createEmptyEmailTemplateDocument();

  const testEmailPayload = {
    event: savedTemplate.event,
    language: selectedLanguage,
    baseLanguage: savedTemplate.baseLanguage,
    subject: formValues.subject,
    content: formValues.content,
  };

  const applySavedTemplate = (result: EmailTemplate) => {
    setSavedTemplate(result);
    setFormValues({ name: result.name, subject: result.subject, content: result.content });
  };

  const runTemplateAction = async <T,>(action: () => Promise<T>, validateContent = false) => {
    setIsActionPending(true);
    setFormError("");
    try {
      const invalidLanguage =
        validateContent && getEmailTemplateInvalidContentLanguage(formValues.content);

      if (invalidLanguage) {
        setSelectedLanguage(invalidLanguage);
        setHasBlockValidationErrors(true);
        return;
      }

      return await action();
    } catch (error) {
      setFormError(getTranslatedApiErrorMessage(error, t, t("emailTemplates.ui.requestFailed")));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!savedTemplate.id) return;
    applySavedTemplate(
      await updateTemplate({
        id: savedTemplate.id,
        body: getEmailTemplateTranslationChanges(savedTemplate, formValues),
      }),
    );
  };

  const handleDocumentChange = (content: typeof activeLanguageDocument.content) =>
    setFormValues((current) => ({
      ...current,
      content: { ...current.content, [selectedLanguage]: { ...activeLanguageDocument, content } },
    }));

  return (
    <PageWrapper
      data-testid={EMAIL_TEMPLATES_HANDLES.EDITOR}
      breadcrumbs={[
        { title: t("emailTemplates.ui.title"), href: EMAIL_TEMPLATE_LIST_PATH },
        {
          title: savedTemplate.name[savedTemplate.baseLanguage] || t("emailTemplates.ui.editor"),
          href: savedTemplate.id
            ? `${EMAIL_TEMPLATE_LIST_PATH}/${savedTemplate.id}`
            : `${EMAIL_TEMPLATE_LIST_PATH}/defaults/${savedTemplate.event}`,
        },
      ]}
    >
      <UnsavedChangesExitGuard
        testIds={{ cancel: EMAIL_TEMPLATES_HANDLES.STAY, leave: EMAIL_TEMPLATES_HANDLES.LEAVE }}
        enabled={hasUnsavedChanges}
        dialogTitle={t("emailTemplates.ui.unsavedTitle")}
        message={t("emailTemplates.ui.unsavedHint")}
        leaveLabel={t("emailTemplates.ui.leave")}
      />
      <div className="space-y-6">
        <EmailTemplateEditorToolbar
          template={savedTemplate}
          language={selectedLanguage}
          isTranslationComplete={isEmailTemplateTranslationComplete(formValues, selectedLanguage)}
          isActionPending={isActionPending}
          hasUnsavedChanges={hasUnsavedChanges}
          onLanguageChange={setSelectedLanguage}
          onSetBaseLanguage={() =>
            void runTemplateAction(async () => {
              applySavedTemplate(
                await updateTemplateBaseLanguage({
                  id: savedTemplate.id!,
                  body: { baseLanguage: selectedLanguage },
                }),
              );
            })
          }
          onSendTest={() =>
            void runTemplateAction(async () => {
              await sendTestEmail(testEmailPayload);
            }, true)
          }
          onCopyDefault={() =>
            void runTemplateAction(async () => {
              const copiedTemplate = await copyDefaultTemplate(savedTemplate.event);
              navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${copiedTemplate.id}`);
            })
          }
          onDuplicate={() =>
            void runTemplateAction(async () => {
              const copiedTemplate = await duplicateTemplate(savedTemplate.id!);
              navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${copiedTemplate.id}`);
            })
          }
          onDelete={() => setPendingConfirmation(EMAIL_TEMPLATE_ACTIONS.DELETE)}
          onArchive={() => setPendingConfirmation(EMAIL_TEMPLATE_ACTIONS.ARCHIVE)}
          onRestore={() =>
            void runTemplateAction(async () => {
              applySavedTemplate(await restoreTemplate(savedTemplate.id!));
            })
          }
          onSave={() => void runTemplateAction(handleSaveTemplate, true)}
          onPublish={() => setPendingConfirmation(EMAIL_TEMPLATE_ACTIONS.PUBLISH)}
        />
        {savedTemplate.source === EMAIL_TEMPLATE_SOURCES.DEFAULT && (
          <p className="rounded-lg border bg-neutral-50 p-4 text-sm text-neutral-600">
            {t("emailTemplates.ui.defaultHint")}
          </p>
        )}
        {formError && formError !== t("emailTemplates.errors.invalidContent") && (
          <p
            role="alert"
            data-testid={EMAIL_TEMPLATES_HANDLES.ERROR}
            className="rounded-lg border border-destructive p-3 text-sm text-destructive"
          >
            {formError}
          </p>
        )}
        <div className="space-y-4">
          <div className="min-w-0 space-y-5">
            <div className="grid gap-4 rounded-lg border bg-white p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-2 lg:col-start-2 lg:row-start-1">
                <Label>{t("emailTemplates.ui.event")}</Label>
                {savedTemplate.source === EMAIL_TEMPLATE_SOURCES.DEFAULT ? (
                  <Select
                    value={savedTemplate.event}
                    disabled={isActionPending}
                    onValueChange={(event) =>
                      navigate(`${EMAIL_TEMPLATE_LIST_PATH}/defaults/${event}`)
                    }
                  >
                    <SelectTrigger className="w-full" aria-label={t("emailTemplates.ui.event")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_TEMPLATE_EVENT_OPTIONS.map((event) => (
                        <SelectItem key={event} value={event}>
                          {t(`emailTemplates.events.${event}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="flex min-h-10 items-center rounded-md border bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    {t(`emailTemplates.events.${savedTemplate.event}`)}
                  </p>
                )}
              </div>
              <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                <EmailTemplateTextField
                  testId={EMAIL_TEMPLATES_HANDLES.NAME}
                  label={t("emailTemplates.ui.name")}
                  value={formValues.name[selectedLanguage] ?? ""}
                  disabled={isReadonly || isActionPending}
                  onChange={(name) =>
                    setFormValues((current) => ({
                      ...current,
                      name: { ...current.name, [selectedLanguage]: name },
                    }))
                  }
                />
              </div>
              <div className="min-w-0 lg:col-span-2">
                <EmailTemplateTextField
                  testId={EMAIL_TEMPLATES_HANDLES.SUBJECT}
                  label={t("emailTemplates.ui.subject")}
                  value={formValues.subject[selectedLanguage] ?? ""}
                  variables={savedTemplate.variables}
                  highlightVariables
                  disabled={isReadonly || isActionPending}
                  onChange={(subject) =>
                    setFormValues((current) => ({
                      ...current,
                      subject: { ...current.subject, [selectedLanguage]: subject },
                    }))
                  }
                />
              </div>
            </div>
            {!isEmailTemplateTranslationComplete(formValues, savedTemplate.baseLanguage) && (
              <p className="text-sm text-destructive">
                {t("emailTemplates.errors.incompleteBaseLanguage")}
              </p>
            )}
            <EmailTemplateBlocks
              showValidationErrors={hasBlockValidationErrors || Boolean(formError)}
              key={selectedLanguage}
              logoUrl={logoUrl}
              companyName={branding?.companyInformation?.companyName}
              primaryColor={branding?.primaryColor}
              blocks={activeLanguageDocument.content}
              variables={savedTemplate.variables}
              disabled={isReadonly || isActionPending}
              onChange={handleDocumentChange}
              onUpload={async (file) =>
                (await runTemplateAction(() => uploadTemplateImage(file)))?.src
              }
            />
          </div>
        </div>
      </div>
      <EmailTemplateConfirmation
        action={pendingConfirmation}
        isActionPending={isActionPending}
        onClose={() => setPendingConfirmation(null)}
        onConfirm={() =>
          void runTemplateAction(async () => {
            if (pendingConfirmation === EMAIL_TEMPLATE_ACTIONS.PUBLISH) {
              if (hasUnsavedChanges) await handleSaveTemplate();

              applySavedTemplate(await publishTemplate(savedTemplate.id!));
            }
            if (pendingConfirmation === EMAIL_TEMPLATE_ACTIONS.ARCHIVE)
              applySavedTemplate(await archiveTemplate(savedTemplate.id!));
            if (pendingConfirmation === EMAIL_TEMPLATE_ACTIONS.DELETE) {
              await deleteTemplate(savedTemplate.id!);
              navigate(EMAIL_TEMPLATE_LIST_PATH);
            }
            setPendingConfirmation(null);
          }, pendingConfirmation === EMAIL_TEMPLATE_ACTIONS.PUBLISH)
        }
      />
    </PageWrapper>
  );
}
