import { useBeforeUnload, useBlocker, useNavigate, useParams } from "@remix-run/react";
import {
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  EMAIL_TEMPLATE_STATUSES,
  computeEmailTemplateDiagnostics,
  groupEmailTemplateDiagnostics,
} from "@repo/shared";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useArchiveEmailTemplate } from "~/api/mutations/admin/useArchiveEmailTemplate";
import { useDuplicateEmailTemplate } from "~/api/mutations/admin/useDuplicateEmailTemplate";
import { useMakeDraftEmailTemplate } from "~/api/mutations/admin/useMakeDraftEmailTemplate";
import { usePublishEmailTemplate } from "~/api/mutations/admin/usePublishEmailTemplate";
import { useSendTestEmail } from "~/api/mutations/admin/useSendTestEmail";
import { useUnarchiveEmailTemplate } from "~/api/mutations/admin/useUnarchiveEmailTemplate";
import { useUpdateEmailTemplate } from "~/api/mutations/admin/useUpdateEmailTemplate";
import { useEmailTemplate } from "~/api/queries/admin/useEmailTemplate";
import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import Loader from "~/modules/common/Loader/Loader";
import { setPageTitle } from "~/utils/setPageTitle";

import { InlineDiagnosticStack } from "./components/InlineDiagnosticNote/InlineDiagnosticStack";
import { SubjectInput } from "./components/SubjectInput/SubjectInput";
import { useEditEmailTemplateForm } from "./hooks/useEditEmailTemplateForm";
import { swapBaseLanguageContent } from "./utils/swapBaseLanguageContent";

import type { MetaFunction } from "@remix-run/react";
import type {
  EmailTemplateBlocks,
  EmailTemplateStatus,
  EmailTemplateStrings,
  SupportedLanguages,
  TranslationFragment,
} from "@repo/shared";

const collectNodeUuids = (blocks: EmailTemplateBlocks): Set<string> => {
  const uuids = new Set<string>();
  const walk = (node: EmailTemplateBlocks) => {
    const uuid = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
    if (typeof uuid === "string" && uuid.length > 0) uuids.add(uuid);
    node.content?.forEach(walk);
  };
  walk(blocks);
  return uuids;
};

const EmailTemplateEditor = lazy(() =>
  import("./components/BuilderCanvas/EmailTemplateEditor").then((m) => ({
    default: m.EmailTemplateEditor,
  })),
);

const EmailTemplateExitGuard = ({ enabled }: { enabled: boolean }) => {
  const { t } = useTranslation();
  const message = t("emailTemplates.edit.unsavedChanges");
  const blocker = useBlocker(enabled);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useBeforeUnload(
    (event) => {
      if (!enabled) return;
      event.preventDefault();
      event.returnValue = message;
    },
    { capture: true },
  );

  useEffect(() => {
    setIsDialogOpen(blocker.state === "blocked");
  }, [blocker.state]);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && blocker.state === "blocked") blocker.reset();
        setIsDialogOpen(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("emailTemplates.edit.unsavedChangesTitle")}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              blocker.reset();
              setIsDialogOpen(false);
            }}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              blocker.proceed();
              setIsDialogOpen(false);
            }}
          >
            {t("common.button.proceed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.editEmailTemplate");

export default function EditEmailTemplatePage() {
  const { t } = useTranslation();
  const { id } = useParams();

  const { data: template, isLoading, isError } = useEmailTemplate(id ?? "", { enabled: !!id });

  const breadcrumbs = [
    { title: t("emailTemplates.breadcrumbs.list"), href: "/admin/email-templates" },
    {
      title: template?.name ?? t("emailTemplates.breadcrumbs.edit"),
      href: `/admin/email-templates/${id}`,
    },
  ];

  if (isLoading || !id) {
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <Loader />
      </PageWrapper>
    );
  }

  if (isError || !template) {
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <p className="text-destructive">{t("emailTemplates.edit.loadFailed")}</p>
      </PageWrapper>
    );
  }

  return <EditEmailTemplateBuilder template={template} breadcrumbs={breadcrumbs} />;
}

type EditEmailTemplateBuilderProps = {
  template: NonNullable<ReturnType<typeof useEmailTemplate>["data"]>;
  breadcrumbs: { title: string; href: string }[];
};

function EditEmailTemplateBuilder({ template, breadcrumbs }: EditEmailTemplateBuilderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguages>(template.baseLanguage);

  const { form, onSubmit, isSubmitting } = useEditEmailTemplateForm(template);

  const { mutate: publish, isPending: isPublishing } = usePublishEmailTemplate();
  const { mutate: makeDraft, isPending: isMakingDraft } = useMakeDraftEmailTemplate();
  const { mutate: archive, isPending: isArchiving } = useArchiveEmailTemplate();
  const { mutate: unarchive, isPending: isUnarchiving } = useUnarchiveEmailTemplate();
  const { mutateAsync: duplicate } = useDuplicateEmailTemplate();
  const { mutateAsync: rename, isPending: isRenaming } = useUpdateEmailTemplate();
  const { mutate: sendTestEmail, isPending: isSendingTestEmail } = useSendTestEmail();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(template.name);
  const [isNameOverflowing, setIsNameOverflowing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isEditingName) setNameDraft(template.name);
  }, [template.name, isEditingName]);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingName) return;
    const el = nameButtonRef.current;
    if (!el) return;
    const check = () => setIsNameOverflowing(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isEditingName, template.name]);

  const availableLocales = form.watch("availableLocales");
  const baseLanguage = form.watch("baseLanguage");
  const blocks = form.watch("blocks");
  const strings = form.watch("strings");
  const subject = form.watch("subject");
  const isDirty = form.formState.isDirty;

  const diagnostics = useMemo(
    () =>
      computeEmailTemplateDiagnostics({
        name: template.name,
        availableLocales,
        baseLanguage,
        subject,
        blocks,
        strings,
      }),
    [template.name, availableLocales, baseLanguage, subject, blocks, strings],
  );

  const blockingErrorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === "error").length,
    [diagnostics],
  );
  const knownNodeUuids = useMemo(() => collectNodeUuids(blocks), [blocks]);
  const diagnosticGroups = useMemo(
    () => groupEmailTemplateDiagnostics(diagnostics, knownNodeUuids),
    [diagnostics, knownNodeUuids],
  );

  const submitForm = form.handleSubmit(onSubmit);
  const handleSave = async () => {
    if (template.status === EMAIL_TEMPLATE_STATUSES.PUBLISHED && blockingErrorCount > 0) {
      toast({
        variant: "destructive",
        description: t("emailTemplates.publishDiagnostics.blockedToast.save"),
      });
      return;
    }
    await submitForm();
  };

  const isStatusChanging = isPublishing || isMakingDraft || isArchiving || isUnarchiving;

  const handleStatusChange = async (nextStatus: EmailTemplateStatus) => {
    if (nextStatus === template.status || isStatusChanging) return;
    if (nextStatus === EMAIL_TEMPLATE_STATUSES.PUBLISHED && blockingErrorCount > 0) {
      toast({
        variant: "destructive",
        description: t("emailTemplates.publishDiagnostics.blockedToast.publish"),
      });
      return;
    }
    if (form.formState.isDirty) {
      await submitForm();
    }
    switch (nextStatus) {
      case EMAIL_TEMPLATE_STATUSES.PUBLISHED:
        publish(template.id);
        return;
      case EMAIL_TEMPLATE_STATUSES.DRAFT:
        if (template.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED) {
          unarchive(template.id);
        } else {
          makeDraft(template.id);
        }
        return;
      case EMAIL_TEMPLATE_STATUSES.ARCHIVED:
        archive(template.id);
        return;
    }
  };

  const handleDuplicate = async () => {
    const duplicatedTemplate = await duplicate(template.id);
    navigate(`/admin/email-templates/${duplicatedTemplate.data.id}`);
  };

  const handleSendTestEmail = async () => {
    if (form.formState.isDirty) {
      await submitForm();
    }
    sendTestEmail({ id: template.id, language: currentLanguage });
  };

  const handleBlocksChange = useCallback(
    (next: EmailTemplateBlocks) => {
      form.setValue("blocks", next, { shouldDirty: true });
    },
    [form],
  );

  const handleTranslationsChange = useCallback(
    (nextForLanguage: Record<string, TranslationFragment>) => {
      const nextStrings: EmailTemplateStrings = {
        ...strings,
        [currentLanguage]: nextForLanguage,
      };
      form.setValue("strings", nextStrings, { shouldDirty: true });
    },
    [form, strings, currentLanguage],
  );

  const handleAddLanguage = useCallback(
    (language: SupportedLanguages) => {
      form.setValue("availableLocales", [...availableLocales, language], { shouldDirty: true });
      const nextStrings: EmailTemplateStrings = { ...strings, [language]: {} };
      form.setValue("strings", nextStrings, { shouldDirty: true });
    },
    [form, availableLocales, strings],
  );

  const commitNameEdit = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === template.name) {
      setNameDraft(template.name);
      setIsEditingName(false);
      return;
    }
    try {
      await rename({ id: template.id, data: { name: trimmed } });
      form.setValue("name", trimmed, { shouldDirty: false });
      setIsEditingName(false);
    } catch {
      setNameDraft(template.name);
    }
  }, [nameDraft, template.id, template.name, rename, form]);

  const cancelNameEdit = useCallback(() => {
    setNameDraft(template.name);
    setIsEditingName(false);
  }, [template.name]);

  const handleRemoveLanguage = useCallback(
    (language: SupportedLanguages) => {
      form.setValue(
        "availableLocales",
        availableLocales.filter((l) => l !== language),
        { shouldDirty: true },
      );
      const nextStrings: EmailTemplateStrings = { ...strings };
      delete nextStrings[language];
      form.setValue("strings", nextStrings, { shouldDirty: true });
    },
    [form, availableLocales, strings],
  );

  const handleSetBaseLanguage = useCallback(
    (language: SupportedLanguages) => {
      if (language === baseLanguage) return;
      const { blocks: nextBlocks, strings: nextStrings } = swapBaseLanguageContent({
        blocks,
        strings,
        oldBase: baseLanguage,
        newBase: language,
      });
      form.setValue("blocks", nextBlocks, { shouldDirty: true });
      form.setValue("strings", nextStrings, { shouldDirty: true });
      form.setValue("baseLanguage", language, { shouldDirty: true });
    },
    [form, baseLanguage, blocks, strings],
  );

  const handleLanguageChange = useCallback(
    (language: SupportedLanguages) => {
      if (language === currentLanguage) return;
      setCurrentLanguage(language);
    },
    [currentLanguage],
  );

  const handleSubjectChange = useCallback(
    (value: string) => {
      form.setValue("subject", { ...subject, [currentLanguage]: value }, { shouldDirty: true });
    },
    [form, subject, currentLanguage],
  );

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <EmailTemplateExitGuard enabled={isDirty && !isSubmitting} />
      <FormProvider {...form}>
        <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
            <div className="relative min-w-0 max-w-full flex-1">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  data-testid="edit-email-template-name-input"
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={cancelNameEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNameEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelNameEdit();
                    }
                  }}
                  maxLength={200}
                  size={Math.max(nameDraft.length + 1, 8)}
                  disabled={isRenaming}
                  className="block max-w-full rounded border border-primary-500 bg-white px-2 py-0.5 text-lg font-semibold whitespace-nowrap focus:outline-none disabled:opacity-60"
                  aria-label={t("emailTemplates.form.field.name")}
                />
              ) : (
                <>
                  <button
                    ref={nameButtonRef}
                    type="button"
                    data-testid="edit-email-template-name-button"
                    onClick={() => setIsEditingName(true)}
                    title={t("emailTemplates.actions.rename")}
                    className="block max-w-full overflow-x-auto whitespace-nowrap rounded px-2 py-0.5 text-left text-lg font-semibold hover:bg-neutral-100"
                  >
                    {template.name}
                  </button>
                  {isNameOverflowing && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r bg-gradient-to-l from-white to-transparent"
                    />
                  )}
                </>
              )}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <Button
                variant="outline"
                onClick={handleDuplicate}
                data-testid="edit-email-template-duplicate-button"
              >
                {t("emailTemplates.actions.duplicate")}
              </Button>
              <Select
                value={template.status}
                onValueChange={(value) => handleStatusChange(value as EmailTemplateStatus)}
                disabled={isStatusChanging}
              >
                <SelectTrigger
                  className="h-9 w-full sm:w-[160px]"
                  aria-label={t("emailTemplates.list.columns.status")}
                  data-testid="edit-email-template-status-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(EMAIL_TEMPLATE_STATUSES).map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`emailTemplates.status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={isDirty ? "default" : "outline"}
                size="sm"
                className={cn({ "border border-primary-700": isDirty })}
                onClick={handleSave}
                disabled={isSubmitting}
                data-testid="edit-email-template-save-button"
              >
                {t("common.button.save")}
              </Button>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-2 border-b p-2 xl:p-3">
            <LanguageSelector
              formKey={[template.id, baseLanguage, availableLocales.join(",")].join(":")}
              value={currentLanguage}
              baseLanguage={baseLanguage}
              availableLocales={availableLocales}
              onChange={handleLanguageChange}
              onCreateLanguage={handleAddLanguage}
              onDeleteLanguage={handleRemoveLanguage}
              onSetBaseLanguage={handleSetBaseLanguage}
              labels={{
                placeholder: "emailTemplates.language.label",
                baseLanguage: "emailTemplates.language.baseLanguage",
                notAddedLanguages: "emailTemplates.language.notAddedLanguages",
                createTitle: "emailTemplates.language.createTitle",
                createDescription: "emailTemplates.language.createDescription",
                deleteTitle: "emailTemplates.language.deleteTitle",
                deleteDescription: "emailTemplates.language.deleteDescription",
                setBaseLanguage: "emailTemplates.language.setBaseLanguage",
                setBaseTitle: "emailTemplates.language.setBaseTitle",
                setBaseDescription: "emailTemplates.language.setBaseDescription",
              }}
              testIds={{
                select: "edit-email-template-language-select",
                option: (language) => `edit-email-template-language-option-${language}`,
                createConfirmButton: "edit-email-template-language-create-confirm-button",
                deleteButton: "edit-email-template-language-delete-button",
                deleteConfirmButton: "edit-email-template-language-delete-confirm-button",
                setBaseLanguageButton: "edit-email-template-language-set-base-button",
                setBaseLanguageConfirmButton:
                  "edit-email-template-language-set-base-confirm-button",
              }}
            />
            <Button
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail || isSubmitting}
              data-testid="edit-email-template-send-test-button"
            >
              {t("emailTemplates.actions.sendTest")}
            </Button>
          </div>
          <div
            className="min-h-0 flex-1 space-y-3 overflow-auto py-6"
            data-testid="edit-email-template-page"
          >
            <div className="mx-auto w-[90%] max-w-[500px] rounded-3xl border border-neutral-200 bg-white px-4 py-4 shadow-sm sm:px-[50px]">
              <label
                htmlFor="email-template-subject"
                className="mb-1 block text-xs font-medium text-neutral-600"
              >
                {t("emailTemplates.form.field.subject")}
              </label>
              <SubjectInput
                id="email-template-subject"
                value={subject?.[currentLanguage] ?? ""}
                onChange={handleSubjectChange}
                placeholder={
                  currentLanguage !== baseLanguage && subject?.[baseLanguage]
                    ? subject[baseLanguage]
                    : t("emailTemplates.form.field.subjectPlaceholder")
                }
                ariaLabel={t("emailTemplates.form.field.subject")}
                testId="edit-email-template-subject-input"
              />
            </div>
            <Suspense fallback={<Loader />}>
              <EmailTemplateEditor
                blocks={blocks}
                strings={strings}
                language={currentLanguage}
                baseLanguage={baseLanguage}
                onBlocksChange={handleBlocksChange}
                onStringsChange={handleTranslationsChange}
                diagnosticsByNodeUuid={diagnosticGroups.byNodeUuid}
              />
            </Suspense>
            {diagnosticGroups.orphan.length > 0 && (
              <div className="mx-auto mt-8 w-[90%] max-w-[500px] space-y-1">
                <InlineDiagnosticStack diagnostics={diagnosticGroups.orphan} />
              </div>
            )}
          </div>
        </div>
      </FormProvider>
    </PageWrapper>
  );
}
