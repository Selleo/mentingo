import { HEX_COLOR_REGEX } from "@repo/shared";
import lowerCase from "lodash-es/lowerCase";
import { useRef } from "react";
import { HexColorPicker } from "react-colorful";
import { useTranslation } from "react-i18next";
import { useUnmount } from "react-use";

import { useUpdatePrimaryColor } from "~/api/mutations";
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

export const OrganizationTheme = () => {
  const { t } = useTranslation();

  const { primaryColor, setPrimaryColor } = useTheme();
  const currentPrimaryColor = useRef(primaryColor);
  const disableSubmit = lowerCase(primaryColor) === lowerCase(currentPrimaryColor.current);

  const { mutate: updatePrimaryColor } = useUpdatePrimaryColor();

  useUnmount(() => {
    setPrimaryColor(currentPrimaryColor.current);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("organizationTheme.title")}</CardTitle>
        <CardDescription>{t("organizationTheme.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <HexColorPicker color={primaryColor} onChange={setPrimaryColor} />
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
                  setPrimaryColor(value);
                }
              }}
              className="w-24"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-4 border-t py-4">
        <Button
          disabled={disableSubmit}
          onClick={() => {
            updatePrimaryColor(
              { primaryColor },
              {
                onSuccess: ({ data }) => {
                  if (data?.primaryColor) {
                    currentPrimaryColor.current = data.primaryColor;
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
          onClick={() => {
            setPrimaryColor(currentPrimaryColor.current);
          }}
        >
          {t("common.button.cancel")}
        </Button>
      </CardFooter>
    </Card>
  );
};
