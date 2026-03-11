import { Archive, GripVertical } from "lucide-react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { LinkOnlyEditor } from "~/components/RichText/LinkOnlyEditor";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { SUPPORTED_LANGUAGES } from "~/utils/browser-language";

import type { RegistrationFormValues } from "./registrationFormBuilder.utils";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { Control, FieldErrors } from "react-hook-form";

type RegistrationFormBuilderFieldProps = {
  control: Control<RegistrationFormValues>;
  errors: FieldErrors<RegistrationFormValues>;
  index: number;
  isArchiving: boolean;
  isRequired: boolean;
  onArchive: (index: number) => void;
  sortAttributes: DraggableAttributes;
  sortListeners: DraggableSyntheticListeners | undefined;
  visibleIndex: number;
};

export function RegistrationFormBuilderField({
  control,
  errors,
  index,
  isArchiving,
  isRequired,
  onArchive,
  sortAttributes,
  sortListeners,
  visibleIndex,
}: RegistrationFormBuilderFieldProps) {
  const { t } = useTranslation();
  const languageNames: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
    en: t("changeUserLanguageView.options.english"),
    pl: t("changeUserLanguageView.options.polish"),
  };
  const getLabelErrorMessage = (language: (typeof SUPPORTED_LANGUAGES)[number]) => {
    const languageError = errors.fields?.[index]?.label?.[language];

    if (typeof languageError?.message !== "string") {
      return undefined;
    }

    return t(languageError.message);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4 transition-colors">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label={t("registrationFormBuilder.field.heading", {
              index: visibleIndex + 1,
            })}
            {...sortAttributes}
            {...sortListeners}
          >
            <GripVertical className="size-4" />
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="body-base-md text-neutral-900">
                {t("registrationFormBuilder.field.heading", {
                  index: visibleIndex + 1,
                })}
              </p>
              <Badge variant={isRequired ? "secondary" : "default"}>
                {t(
                  isRequired
                    ? "registrationFormBuilder.field.requiredBadge"
                    : "registrationFormBuilder.field.optionalBadge",
                )}
              </Badge>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isArchiving}
          onClick={() => onArchive(index)}
        >
          <Archive className="mr-2 size-4" />
          {t("registrationFormBuilder.field.archive")}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 border-y border-border py-3">
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
          render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
        />
      </div>

      <div className="space-y-3">
        <div className="grid gap-4 xl:grid-cols-2">
          {SUPPORTED_LANGUAGES.map((language) => (
            <div key={language} className="space-y-2">
              <Label className="body-base-md text-neutral-900">
                {t("registrationFormBuilder.field.languageLabel", {
                  language: languageNames[language],
                })}
              </Label>
              <Controller
                control={control}
                name={`fields.${index}.label.${language}`}
                render={({ field }) => (
                  <LinkOnlyEditor
                    content={field.value}
                    onChange={field.onChange}
                    placeholder={t("registrationFormBuilder.field.labelPlaceholder")}
                  />
                )}
              />
              <FormValidationError message={getLabelErrorMessage(language)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
