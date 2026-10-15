import { useNavigate } from "@remix-run/react";
import { AUTOMATION_RESERVED_BRANDING_PLACEHOLDER } from "@repo/shared";
import { AlertTriangle, FileText, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useArchiveEmailTemplate } from "~/api/mutations/emailTemplates/useArchiveEmailTemplate";
import { useCopyDefaultEmailTemplate } from "~/api/mutations/emailTemplates/useCopyDefaultEmailTemplate";
import { useDeleteEmailTemplate } from "~/api/mutations/emailTemplates/useDeleteEmailTemplate";
import { useDuplicateEmailTemplate } from "~/api/mutations/emailTemplates/useDuplicateEmailTemplate";
import { usePublishEmailTemplate } from "~/api/mutations/emailTemplates/usePublishEmailTemplate";
import { useRemoveEmailTemplateLanguage } from "~/api/mutations/emailTemplates/useRemoveEmailTemplateLanguage";
import { useRestoreEmailTemplate } from "~/api/mutations/emailTemplates/useRestoreEmailTemplate";
import { useSendTestEmailTemplate } from "~/api/mutations/emailTemplates/useSendTestEmailTemplate";
import { useUpdateEmailTemplate } from "~/api/mutations/emailTemplates/useUpdateEmailTemplate";
import { useUpdateEmailTemplateBaseLanguage } from "~/api/mutations/emailTemplates/useUpdateEmailTemplateBaseLanguage";
import { useUploadEmailTemplateImage } from "~/api/mutations/emailTemplates/useUploadEmailTemplateImage";
import { useEmailTemplateEvents } from "~/api/queries/useEmailTemplateEvents";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { PageWrapper } from "~/components/PageWrapper";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";
import { UnsavedChangesExitGuard } from "~/modules/Admin/components/UnsavedChangesExitGuard";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_SOURCES,
  EMAIL_TEMPLATE_STATUSES,
  EMAIL_TEMPLATE_LIST_PATH,
} from "../emailTemplates.constants";
import {
  getEmailTemplatePublicationConflicts,
  createEmptyEmailTemplateDocument,
  getEmailTemplateTranslationChanges,
  getEmailTemplateInvalidContentLanguage,
  isEmailTemplateTranslationComplete,
} from "../emailTemplates.utils";
import {
  removeEmailTemplateTags,
  removeTagsFromEmailBlocks,
} from "../utils/removeEmailTemplateTags";

import { EmailTemplateBlocks } from "./EmailTemplateBlocks";
import { EmailTemplateConfirmation } from "./EmailTemplateConfirmation";
import { EmailTemplateEditorToolbar } from "./EmailTemplateEditorToolbar";
import { EmailTemplateEventSettings } from "./EmailTemplateEventSettings";
import { EmailTemplateTextField } from "./EmailTemplateTextField";

import type {
  EmailTemplatePublicationConflict,
  EmailTemplateConfirmationAction,
  EmailTemplate,
  EmailTemplateFormValues,
} from "../emailTemplates.types";
import type {
  AutomationEventDefinition,
  AutomationEventKind,
  AutomationPlaceholderDefinition,
  SupportedLanguages,
} from "@repo/shared";

export type EmailTemplateEditorProps = { template: EmailTemplate };

export function EmailTemplateEditor({ template }: EmailTemplateEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: branding } = useGlobalSettings();
  const { data: events } = useEmailTemplateEvents();
  const { data: logoUrl } = usePlatformLogo();

  const [savedTemplate, setSavedTemplate] = useState(template);
  const [triggerEventKind, setTriggerEventKind] = useState<AutomationEventKind | null>(
    template.triggerEventKind ?? null,
  );
  const [placeholders, setPlaceholders] = useState<AutomationPlaceholderDefinition[]>(
    (template.placeholders ??
      template.variables
        .filter((variable) => variable.key !== AUTOMATION_RESERVED_BRANDING_PLACEHOLDER)
        .map((variable) => ({
          name: variable.key,
          label: variable.label,
          type:
            variable.type === "text" || variable.type === "date"
              ? ("string" as const)
              : variable.type,
          required: variable.requiredInTemplate ?? false,
          sampleValue: variable.sampleValue,
        }))) as AutomationPlaceholderDefinition[],
  );

  const { watch, getValues, setValue, reset } = useForm<
    Pick<EmailTemplateFormValues, "name" | "subject">
  >({
    defaultValues: { name: template.name, subject: template.subject },
  });
  const [content, setContent] = useState(template.content);
  const formValues: EmailTemplateFormValues = { ...watch(), content };

  const preferredLanguage = useLanguageStore((state) => state.language);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguages>(
    template.availableLocales.includes(preferredLanguage)
      ? preferredLanguage
      : template.baseLanguage,
  );

  const [pendingConfirmation, setPendingConfirmation] =
    useState<EmailTemplateConfirmationAction>(null);
  const [formError, setFormError] = useState("");
  const [publicationConflicts, setPublicationConflicts] = useState<
    EmailTemplatePublicationConflict[]
  >([]);
  const [hasBlockValidationErrors, setHasBlockValidationErrors] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  const { mutateAsync: updateTemplate } = useUpdateEmailTemplate();
  const { mutateAsync: updateTemplateBaseLanguage } = useUpdateEmailTemplateBaseLanguage();
  const { mutateAsync: publishTemplate } = usePublishEmailTemplate();
  const { mutateAsync: removeTemplateLanguage } = useRemoveEmailTemplateLanguage();
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
    triggerEventKind !== (savedTemplate.triggerEventKind ?? null) ||
    JSON.stringify(placeholders) !==
      JSON.stringify(
        savedTemplate.placeholders ??
          template.variables
            .filter((variable) => variable.key !== AUTOMATION_RESERVED_BRANDING_PLACEHOLDER)
            .map((variable) => ({
              name: variable.key,
              label: variable.label,
              type:
                variable.type === "text" || variable.type === "date"
                  ? ("string" as const)
                  : variable.type,
              required: variable.requiredInTemplate ?? false,
              sampleValue: variable.sampleValue,
            })),
      ) ||
    JSON.stringify(formValues) !==
      JSON.stringify({
        name: savedTemplate.name,
        subject: savedTemplate.subject,
        content: savedTemplate.content,
      });

  const activeLanguageDocument =
    formValues.content[selectedLanguage] ?? createEmptyEmailTemplateDocument();

  const eventTags = (
    events?.find((event) => event.kind === triggerEventKind)?.providedVariables ?? []
  ).map((field) => ({
    name: field.key,
    label: field.label,
    type: field.dataType,
    required: false,
    sampleValue: field.sampleValue,
  }));
  const availablePlaceholders = [
    ...placeholders,
    ...eventTags.filter((tag) => !placeholders.some((item) => item.name === tag.name)),
  ];
  const variables = availablePlaceholders
    .map((item) => ({
      key: item.name,
      label: item.label,
      type:
        item.type === "string" || item.type === "localized_string" ? ("text" as const) : item.type,
      requiredInTemplate: item.required,
      sampleValue: item.sampleValue,
    }))
    .concat([
      {
        key: AUTOMATION_RESERVED_BRANDING_PLACEHOLDER,
        label: AUTOMATION_RESERVED_BRANDING_PLACEHOLDER,
        type: "text",
        requiredInTemplate: false,
        sampleValue: branding?.companyInformation?.companyName ?? "",
      },
    ]) as EmailTemplate["variables"];

  const testEmailPayload = {
    placeholders: availablePlaceholders,
    language: selectedLanguage,
    baseLanguage: savedTemplate.baseLanguage,
    subject: formValues.subject,
    content: formValues.content,
  };

  const applySavedTemplate = (result: EmailTemplate) => {
    setSavedTemplate(result);
    setTriggerEventKind(result.triggerEventKind ?? null);
    setPlaceholders((result.placeholders ?? []) as AutomationPlaceholderDefinition[]);
    reset({ name: result.name, subject: result.subject });
    setContent(result.content);
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
      const conflicts = getEmailTemplatePublicationConflicts(error);
      if (conflicts) {
        setPublicationConflicts(conflicts);
        return;
      }
      setFormError(
        getTranslatedApiErrorMessage(error, t, t("emailTemplates.ui.requestFailed"), {
          allowUntranslatedMessage: false,
        }),
      );
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!savedTemplate.id) return;
    applySavedTemplate(
      await updateTemplate({
        id: savedTemplate.id,
        body: {
          ...getEmailTemplateTranslationChanges(savedTemplate, formValues),
          placeholders: availablePlaceholders,
          triggerEventKind,
        },
      }),
    );
  };

  function handleEventChange(event: AutomationEventDefinition | null, replaceTags: boolean) {
    setTriggerEventKind(event?.kind ?? null);

    if (!replaceTags) {
      setPlaceholders(availablePlaceholders);
      return;
    }

    setPlaceholders(
      (event?.providedVariables ?? []).map((field) => ({
        name: field.key,
        label: field.label,
        type: field.dataType,
        required: false,
        sampleValue: field.sampleValue,
      })),
    );

    setValue(
      "subject",
      Object.fromEntries(
        Object.entries(getValues("subject")).map(([language, subject]) => [
          language,
          removeEmailTemplateTags(subject),
        ]),
      ),
      { shouldDirty: true },
    );

    setContent((current) =>
      Object.fromEntries(
        Object.entries(current).map(([language, document]) => [
          language,
          {
            ...document,
            content: removeTagsFromEmailBlocks(document.content),
          },
        ]),
      ),
    );
  }

  const handleDocumentChange = (content: typeof activeLanguageDocument.content) =>
    setContent((current) => ({
      ...current,
      [selectedLanguage]: { ...activeLanguageDocument, content },
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
          onCreateLanguage={async (language) => {
            setContent((current) => ({
              ...current,
              [language]: createEmptyEmailTemplateDocument(),
            }));
          }}
          onDeleteLanguage={async (language) => {
            if (!savedTemplate.id) return;
            setIsActionPending(true);
            try {
              applySavedTemplate(await removeTemplateLanguage({ id: savedTemplate.id, language }));
            } finally {
              setIsActionPending(false);
            }
          }}
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
              const copiedTemplate = await copyDefaultTemplate(savedTemplate.event!);
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
          onPublish={() => {
            setFormError("");
            setPublicationConflicts([]);
            setPendingConfirmation(EMAIL_TEMPLATE_ACTIONS.PUBLISH);
          }}
        />
        {savedTemplate.source === EMAIL_TEMPLATE_SOURCES.DEFAULT && (
          <Alert className="border-warning-200 bg-warning-50 text-warning-800 [&>svg]:text-warning-700 [&>svg+div]:translate-y-0">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>{t("emailTemplates.ui.defaultHint")}</AlertDescription>
          </Alert>
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
            <div className="grid gap-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                <EmailTemplateTextField
                  testId={EMAIL_TEMPLATES_HANDLES.NAME}
                  leadingIcon={<FileText className="size-4" />}
                  label={t("emailTemplates.ui.name")}
                  value={formValues.name[selectedLanguage] ?? ""}
                  disabled={isReadonly || isActionPending}
                  onChange={(name) =>
                    setValue(
                      "name",
                      { ...getValues("name"), [selectedLanguage]: name },
                      {
                        shouldDirty: true,
                      },
                    )
                  }
                />
              </div>
              <div className="min-w-0 lg:col-start-2 lg:row-start-1">
                <EmailTemplateTextField
                  testId={EMAIL_TEMPLATES_HANDLES.SUBJECT}
                  leadingIcon={<Mail className="size-4" />}
                  label={t("emailTemplates.ui.subject")}
                  value={formValues.subject[selectedLanguage] ?? ""}
                  variables={variables}
                  highlightVariables
                  disabled={isReadonly || isActionPending}
                  onChange={(subject) =>
                    setValue(
                      "subject",
                      { ...getValues("subject"), [selectedLanguage]: subject },
                      { shouldDirty: true },
                    )
                  }
                />
              </div>
              <div className="border-t border-neutral-100 pt-4 lg:col-span-2">
                <EmailTemplateEventSettings
                  template={savedTemplate}
                  eventKind={triggerEventKind}
                  disabled={isReadonly || isActionPending}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onEventChange={handleEventChange}
                />
              </div>
            </div>
            {!isEmailTemplateTranslationComplete(formValues, savedTemplate.baseLanguage) && (
              <p className="text-sm text-destructive">
                {t("emailTemplates.errors.incompleteBaseLanguage")}
              </p>
            )}
            <EmailTemplateBlocks
              placeholders={placeholders}
              onPlaceholdersChange={setPlaceholders}
              showValidationErrors={hasBlockValidationErrors || Boolean(formError)}
              key={selectedLanguage}
              logoUrl={logoUrl}
              companyName={branding?.companyInformation?.companyName}
              primaryColor={branding?.primaryColor}
              blocks={activeLanguageDocument.content}
              variables={variables}
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
        publicationConflicts={publicationConflicts}
        errorMessage={formError}
        isActionPending={isActionPending}
        onClose={() => {
          setPendingConfirmation(null);
          setPublicationConflicts([]);
        }}
        onConfirm={() =>
          void runTemplateAction(async () => {
            if (pendingConfirmation === EMAIL_TEMPLATE_ACTIONS.PUBLISH) {
              if (hasUnsavedChanges) await handleSaveTemplate();

              applySavedTemplate(
                await publishTemplate({
                  id: savedTemplate.id!,
                  confirmedAutomationIds: publicationConflicts.map(({ id }) => id),
                }),
              );
              setPublicationConflicts([]);
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
