import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useChangeLanguage } from "~/api/mutations/useChangeLanguage";
import { useCurrentLanguage } from "~/api/mutations/useCurrentLanguage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";

import type { SupportedLanguages } from "@repo/shared";

export default function LanguageSelect() {
  const { t } = useTranslation();
  const { mutate: changeLanguage, isPending } = useChangeLanguage();
  const { language: currentLanguage } = useCurrentLanguage();

  const handleLanguageChange = (newLanguage: SupportedLanguages) => {
    changeLanguage({
      language: newLanguage,
    });
  };

  return (
    <Card id="change-language">
      <CardHeader>
        <CardTitle className="h5">{t("changeUserLanguageView.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("changeUserLanguageView.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="language" className="body-base-md">
          {t("changeUserLanguageView.field.language")}
        </Label>
        <Select value={currentLanguage} onValueChange={handleLanguageChange} disabled={isPending}>
          <SelectTrigger data-testid={SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(SUPPORTED_LANGUAGES).map((language) => (
              <SelectItem key={language} value={language}>
                {t(`common.languages.${language}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
