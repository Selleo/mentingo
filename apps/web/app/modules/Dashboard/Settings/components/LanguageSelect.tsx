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

import type { Language } from "../Language/LanguageStore";

export default function LanguageSelect() {
  const { t } = useTranslation();
  const { mutate: changeLanguage, isPending } = useChangeLanguage();
  const { language: currentLanguage } = useCurrentLanguage();

  const handleLanguageChange = (newLanguage: Language) => {
    changeLanguage({
      language: newLanguage,
    });
  };

  return (
    <Card id="change-language">
      <CardHeader>
        <CardTitle>{t("changeUserLanguageView.header")}</CardTitle>
        <CardDescription>{t("changeUserLanguageView.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="language">{t("changeUserLanguageView.field.language")}</Label>
        <Select value={currentLanguage} onValueChange={handleLanguageChange} disabled={isPending}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t("changeUserLanguageView.options.english")}</SelectItem>
            <SelectItem value="pl">{t("changeUserLanguageView.options.polish")}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
