import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadAchievementImage } from "~/api/mutations/admin/useAchievementMutations";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

import type {
  Achievement,
  AchievementTranslationsInput,
  SupportedLocale,
  UpsertAchievementPayload,
} from "~/api/queries/admin/useAchievements";

const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "pl", "de", "lt", "cs"];

type AchievementFormState = {
  imageReference: string;
  imageUrl?: string;
  pointThreshold: number;
  isActive: boolean;
  translations: AchievementTranslationsInput;
};

type AchievementFormProps = {
  achievement?: Achievement;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (payload: Required<UpsertAchievementPayload>) => void;
};

const emptyTranslations = (): AchievementTranslationsInput =>
  SUPPORTED_LOCALES.reduce((acc, locale) => {
    acc[locale] = { name: "", description: "" };
    return acc;
  }, {} as AchievementTranslationsInput);

const buildInitialState = (achievement?: Achievement): AchievementFormState => {
  const translations = emptyTranslations();

  achievement?.translations.forEach((translation) => {
    translations[translation.locale] = {
      name: translation.name,
      description: translation.description,
    };
  });

  return {
    imageReference: achievement?.imageReference ?? "",
    imageUrl: achievement?.imageUrl,
    pointThreshold: achievement?.pointThreshold ?? 1,
    isActive: achievement?.isActive ?? true,
    translations,
  };
};

export function AchievementForm({
  achievement,
  isSubmitting,
  submitLabel,
  onSubmit,
}: AchievementFormProps) {
  const { t } = useTranslation();
  const [formState, setFormState] = useState(() => buildInitialState(achievement));
  const { mutate: uploadImage, isPending: isUploading } = useUploadAchievementImage();

  useEffect(() => {
    setFormState(buildInitialState(achievement));
  }, [achievement]);

  const isValid = useMemo(() => {
    return (
      formState.imageReference.length > 0 &&
      formState.pointThreshold >= 1 &&
      SUPPORTED_LOCALES.every(
        (locale) =>
          formState.translations[locale].name.trim().length > 0 &&
          formState.translations[locale].description.trim().length > 0,
      )
    );
  }, [formState]);

  const updateTranslation = (
    locale: SupportedLocale,
    field: "name" | "description",
    value: string,
  ) => {
    setFormState((previous) => ({
      ...previous,
      translations: {
        ...previous.translations,
        [locale]: {
          ...previous.translations[locale],
          [field]: value,
        },
      },
    }));
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    if (!image) return;

    uploadImage(image, {
      onSuccess: (uploaded) => {
        setFormState((previous) => ({
          ...previous,
          imageReference: uploaded.fileKey,
          imageUrl: uploaded.fileUrl,
        }));
      },
    });
  };

  return (
    <form
      className="space-y-6 rounded-lg bg-white p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid) return;

        onSubmit({
          imageReference: formState.imageReference,
          pointThreshold: formState.pointThreshold,
          isActive: formState.isActive,
          translations: formState.translations,
        });
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <Label>{t("adminAchievementsView.form.image")}</Label>
          <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-lg border bg-neutral-50">
            {formState.imageUrl ? (
              <img src={formState.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="px-4 text-center text-sm text-neutral-500">
                {t("adminAchievementsView.form.noImage")}
              </span>
            )}
          </div>
          <Input type="file" accept="image/*" onChange={handleImageChange} />
          {isUploading && (
            <p className="text-sm text-neutral-500">{t("common.other.uploadingImage")}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="point-threshold">
              {t("adminAchievementsView.form.pointThreshold")}
            </Label>
            <Input
              id="point-threshold"
              type="number"
              min={1}
              value={formState.pointThreshold}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  pointThreshold: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={formState.isActive}
              onCheckedChange={(checked) =>
                setFormState((previous) => ({ ...previous, isActive: checked }))
              }
            />
            <Label>{t("adminAchievementsView.form.active")}</Label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SUPPORTED_LOCALES.map((locale) => (
          <div key={locale} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">{t(`common.languages.${locale}`)}</h3>
            <div className="space-y-2">
              <Label>{t("adminAchievementsView.form.name")}</Label>
              <Input
                value={formState.translations[locale].name}
                onChange={(event) => updateTranslation(locale, "name", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("adminAchievementsView.form.description")}</Label>
              <Textarea
                value={formState.translations[locale].description}
                onChange={(event) => updateTranslation(locale, "description", event.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isValid || isSubmitting || isUploading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
