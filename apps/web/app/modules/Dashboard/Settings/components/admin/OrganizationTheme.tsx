import { HEX_COLOR_REGEX } from "@repo/shared";
import lowerCase from "lodash-es/lowerCase";
import { useRef } from "react";
import { HexColorPicker } from "react-colorful";
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
import { Input } from "~/components/ui/input";
import { useTheme } from "~/modules/Theme";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

export const OrganizationTheme = () => {
  const { t } = useTranslation();

  const { primaryColor, contrastColor, setColorSchema } = useTheme();
  const currentPrimaryColor = useRef(primaryColor);
  const currentContrastColor = useRef(contrastColor);
  const disableSubmit =
    lowerCase(primaryColor) === lowerCase(currentPrimaryColor.current) &&
    lowerCase(contrastColor) === lowerCase(currentContrastColor.current);

  const { mutate: updateColorSchema } = useUpdateColorSchema();

  useUnmount(() => {
    setColorSchema(currentPrimaryColor.current, currentContrastColor.current);
  });

  return (
    <Card data-testid={SETTINGS_PAGE_HANDLES.THEME_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("organizationTheme.title")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("organizationTheme.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center md:flex-row justify-center gap-4">
          <div className="flex flex-col gap-2">
            <HexColorPicker
              color={primaryColor}
              onChange={(color) => setColorSchema(color, contrastColor)}
            />
            <div className="flex items-center justify-center space-x-1">
              <span className="text-sm text-gray-500">#</span>
              <Input
                type="text"
                id="primary-color-input"
                value={primaryColor.replace(/^#/, "")}
                onChange={(event) => {
                  const value = event.target.value.startsWith("#")
                    ? event.target.value
                    : `#${event.target.value}`;

                  if (HEX_COLOR_REGEX.test(value)) {
                    setColorSchema(value, contrastColor);
                  }
                }}
                className="w-24"
                data-testid={SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <HexColorPicker
              color={contrastColor}
              onChange={(color) => setColorSchema(primaryColor, color)}
            />
            <div className="flex items-center justify-center space-x-1">
              <span className="text-sm text-gray-500">#</span>
              <Input
                type="text"
                id="contrast-color-input"
                value={contrastColor.replace(/^#/, "")}
                onChange={(event) => {
                  const value = event.target.value.startsWith("#")
                    ? event.target.value
                    : `#${event.target.value}`;

                  if (HEX_COLOR_REGEX.test(value)) {
                    setColorSchema(primaryColor, value);
                  }
                }}
                className="w-24"
                data-testid={SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-4 border-t py-4">
        <Button
          data-testid={SETTINGS_PAGE_HANDLES.THEME_SAVE}
          disabled={disableSubmit}
          onClick={() => {
            updateColorSchema(
              { primaryColor, contrastColor },
              {
                onSuccess: ({ data }) => {
                  if (data?.primaryColor) {
                    currentPrimaryColor.current = data.primaryColor;
                  }

                  if (data?.contrastColor) {
                    currentContrastColor.current = data.contrastColor;
                  }
                },
              },
            );
          }}
        >
          {t("common.button.save")}
        </Button>
        <Button
          variant="outline"
          disabled={disableSubmit}
          data-testid={SETTINGS_PAGE_HANDLES.THEME_CANCEL}
          onClick={() => {
            setColorSchema(currentPrimaryColor.current, currentContrastColor.current);
          }}
        >
          {t("common.button.cancel")}
        </Button>
      </CardFooter>
    </Card>
  );
};
