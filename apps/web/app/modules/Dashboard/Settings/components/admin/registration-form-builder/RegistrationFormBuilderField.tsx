import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Archive, GripVertical, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { LinkOnlyEditor } from "~/components/RichText/LinkOnlyEditor";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../../e2e/data/settings/handles";

import type { RegistrationFormValues } from "./registrationFormBuilder.utils";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { SupportedLanguages } from "@repo/shared";
import type { Control, FieldErrors } from "react-hook-form";

type RegistrationFormBuilderFieldProps = {
  control: Control<RegistrationFormValues>;
  errors: FieldErrors<RegistrationFormValues>;
  isArchived: boolean;
  isPersisted: boolean;
  index: number;
  isArchiving: boolean;
  isRequired: boolean;
  onArchive: (index: number) => void;
  onDelete: (index: number) => void;
  onRestore: (index: number) => void;
  sortAttributes: DraggableAttributes;
  sortListeners: DraggableSyntheticListeners | undefined;
  visibleIndex: number;
};

export function RegistrationFormBuilderField({
  control,
  errors,
  isArchived,
  isPersisted,
  index,
  isArchiving,
  isRequired,
  onArchive,
  onDelete,
  onRestore,
  sortAttributes,
  sortListeners,
  visibleIndex,
}: RegistrationFormBuilderFieldProps) {
  const { t } = useTranslation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const headingLabel = t("registrationFormBuilder.field.heading", {
    index: visibleIndex + 1,
  });

  const getLabelErrorMessage = (language: SupportedLanguages) => {
    const languageError = errors.fields?.[index]?.label?.[language];

    if (typeof languageError?.message !== "string") {
      return undefined;
    }

    return t(languageError.message);
  };

  const hasFieldError = Boolean(errors.fields?.[index]);
  const requiredBadgeLabel = t(
    isRequired
      ? "registrationFormBuilder.field.requiredBadge"
      : "registrationFormBuilder.field.optionalBadge",
  );

  const renderStateActionButton = () => {
    if (!isPersisted) {
      return (
        <Button
          type="button"
          variant="outline"
          disabled={isArchiving}
          onClick={() => onDelete(index)}
          data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldDelete(index)}
        >
          <Trash2 className="mr-2 size-4" />
          {t("common.button.delete")}
        </Button>
      );
    }

    if (isArchived) {
      return (
        <Button
          type="button"
          variant="outline"
          disabled={isArchiving}
          onClick={() => onRestore(index)}
          data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldRestore(index)}
        >
          <RotateCcw className="mr-2 size-4" />
          {t("registrationFormBuilder.field.restore")}
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        disabled={isArchiving}
        onClick={() => onArchive(index)}
        data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldArchive(index)}
      >
        <Archive className="mr-2 size-4" />
        {t("registrationFormBuilder.field.archive")}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border bg-background p-4 transition-colors",
        hasFieldError ? "border-red-500" : "border-border",
      )}
      data-testid={SETTINGS_PAGE_HANDLES.registrationFormField(index)}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label={headingLabel}
            {...sortAttributes}
            {...sortListeners}
          >
            <GripVertical className="size-4" />
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="body-base-md text-neutral-900">{headingLabel}</p>
              <Badge variant={isRequired ? "secondary" : "default"}>{requiredBadgeLabel}</Badge>
              {isArchived && (
                <Badge variant="default">{t("registrationFormBuilder.field.archivedBadge")}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isArchiving || isArchived}
            onClick={() => setIsEditDialogOpen(true)}
            data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldEdit(index)}
          >
            <Pencil className="mr-2 size-4" />
            {t("common.button.edit")}
          </Button>
          {renderStateActionButton()}
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent
          className="max-w-5xl border-neutral-200 bg-gradient-to-b from-background to-muted/10 p-0"
          data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldDialog(index)}
        >
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
            <DialogTitle className="h5 text-neutral-900">{headingLabel}</DialogTitle>
            <DialogDescription className="body-sm text-muted-foreground">
              {t("registrationFormBuilder.field.cardDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/90 px-4 py-3">
              <div className="space-y-1">
                <Label className="body-base-md text-neutral-900">
                  {t("registrationFormBuilder.field.required")}
                </Label>
                <p className="body-sm text-muted-foreground">
                  {t("registrationFormBuilder.field.requiredDescription")}
                </p>
              </div>
              <Controller
                control={control}
                name={`fields.${index}.required`}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldRequired(index)}
                  />
                )}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {Object.values(SUPPORTED_LANGUAGES).map((language) => (
                <div
                  key={language}
                  className="space-y-2 rounded-lg border border-border bg-background/90 p-4"
                >
                  <Label className="body-base-md text-neutral-900">
                    {t("registrationFormBuilder.field.languageLabel", {
                      language: t(`common.languages.${language}`),
                    })}
                  </Label>
                  <Controller
                    control={control}
                    name={`fields.${index}.label.${language}`}
                    render={({ field }) => (
                      <LinkOnlyEditor
                        content={field.value}
                        enableLinkClick
                        onChange={field.onChange}
                        placeholder={t("registrationFormBuilder.field.labelPlaceholder")}
                        editorTestId={SETTINGS_PAGE_HANDLES.registrationFormFieldLabel(
                          index,
                          language,
                        )}
                      />
                    )}
                  />
                  <div
                    data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldLabelError(
                      index,
                      language,
                    )}
                  >
                    <FormValidationError message={getLabelErrorMessage(language)} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => setIsEditDialogOpen(false)}
                data-testid={SETTINGS_PAGE_HANDLES.registrationFormFieldClose(index)}
              >
                {t("common.button.close")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
