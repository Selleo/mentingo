import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUnmount } from "react-use";

import { useUpdateColorSchema } from "~/api/mutations";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useTheme } from "~/modules/Theme";
import { getContrastRatio, readCssVariable } from "~/modules/Theme/helpers";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { OrganizationThemeColorField } from "./OrganizationThemeColorField";
import { OrganizationThemePreview } from "./OrganizationThemePreview";

import type { ColorSchema } from "~/modules/Theme/theme.types";

const COLOR_SCHEMA_KEYS = [
  "primaryColor",
  "contrastColor",
  "backgroundColor",
  "accentColor",
] as const;

const isSameColorSchema = (first: ColorSchema, second: ColorSchema) =>
  COLOR_SCHEMA_KEYS.every((key) => first[key]?.toLowerCase() === second[key]?.toLowerCase());

export const OrganizationTheme = () => {
  const { t } = useTranslation();

  const { colorSchema, palette, setColorSchema } = useTheme();
  const savedColorSchema = useRef(colorSchema);
  const disableSubmit = isSameColorSchema(colorSchema, savedColorSchema.current);
  const isAccentAdjusted =
    !colorSchema.accentColor && palette[700] !== colorSchema.primaryColor.toLowerCase();

  const { mutate: updateColorSchema } = useUpdateColorSchema();

  const changeColorSchema = (changes: Partial<ColorSchema>) =>
    setColorSchema({ ...colorSchema, ...changes });

  useUnmount(() => {
    setColorSchema(savedColorSchema.current);
  });

  return (
    <Card data-testid={SETTINGS_PAGE_HANDLES.THEME_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("organizationTheme.title")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("organizationTheme.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-2">
        <div className="flex h-full flex-col divide-y divide-neutral-200">
          <OrganizationThemeColorField
            label={t("organizationTheme.primaryColor.label")}
            description={t("organizationTheme.primaryColor.description")}
            color={colorSchema.primaryColor}
            inputId="primary-color-input"
            inputTestId={SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT}
            onChange={(primaryColor) => changeColorSchema({ primaryColor })}
          />
          <OrganizationThemeColorField
            label={t("organizationTheme.contrastColor.label")}
            description={t("organizationTheme.contrastColor.description")}
            color={colorSchema.contrastColor}
            inputId="contrast-color-input"
            inputTestId={SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT}
            onChange={(contrastColor) => changeColorSchema({ contrastColor })}
            contrastRatio={getContrastRatio(colorSchema.primaryColor, colorSchema.contrastColor)}
          />
          <OrganizationThemeColorField
            label={t("organizationTheme.backgroundColor.label")}
            description={t("organizationTheme.backgroundColor.description")}
            color={colorSchema.backgroundColor ?? palette[50]}
            inputId="background-color-input"
            inputTestId={SETTINGS_PAGE_HANDLES.THEME_BACKGROUND_INPUT}
            onChange={(backgroundColor) => changeColorSchema({ backgroundColor })}
            automaticColor={{
              isAutomatic: !colorSchema.backgroundColor,
              resetTestId: SETTINGS_PAGE_HANDLES.THEME_BACKGROUND_RESET,
              onResetToAutomatic: () => changeColorSchema({ backgroundColor: null }),
            }}
          />
          <OrganizationThemeColorField
            label={t("organizationTheme.accentColor.label")}
            description={
              isAccentAdjusted
                ? t("organizationTheme.accentColor.adjustedDescription")
                : t("organizationTheme.accentColor.description")
            }
            color={colorSchema.accentColor ?? palette[700]}
            inputId="accent-color-input"
            inputTestId={SETTINGS_PAGE_HANDLES.THEME_ACCENT_INPUT}
            onChange={(accentColor) => changeColorSchema({ accentColor })}
            contrastRatio={Math.min(
              getContrastRatio(palette[700], palette[50]),
              getContrastRatio(palette[700], readCssVariable("--color-white")),
            )}
            automaticColor={{
              isAutomatic: !colorSchema.accentColor,
              resetTestId: SETTINGS_PAGE_HANDLES.THEME_ACCENT_RESET,
              onResetToAutomatic: () => changeColorSchema({ accentColor: null }),
            }}
          />
        </div>
        <OrganizationThemePreview />
      </CardContent>
      <CardFooter className="flex gap-4 border-t py-4">
        <Button
          data-testid={SETTINGS_PAGE_HANDLES.THEME_SAVE}
          disabled={disableSubmit}
          onClick={() => {
            updateColorSchema(colorSchema, {
              onSuccess: ({ data }) => {
                if (!data?.primaryColor || !data?.contrastColor) return;

                savedColorSchema.current = {
                  primaryColor: data.primaryColor,
                  contrastColor: data.contrastColor,
                  backgroundColor: data.backgroundColor,
                  accentColor: data.accentColor,
                };
              },
            });
          }}
        >
          {t("common.button.save")}
        </Button>
        <Button
          variant="outline"
          disabled={disableSubmit}
          data-testid={SETTINGS_PAGE_HANDLES.THEME_CANCEL}
          onClick={() => {
            setColorSchema(savedColorSchema.current);
          }}
        >
          {t("common.button.cancel")}
        </Button>
      </CardFooter>
    </Card>
  );
};
