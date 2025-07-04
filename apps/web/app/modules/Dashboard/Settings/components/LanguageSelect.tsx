import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";

import { useLanguageStore } from "../Language/LanguageStore";

export default function LanguageSelect() {
  const { t } = useTranslation();

  const { language, setLanguage } = useLanguageStore((state) => ({
    language: state.language === "en" || state.language === "pl" ? state.language : "en",
    setLanguage: state.setLanguage,
  }));

  return (
    <Card id="change-language">
      <CardHeader>
        <CardTitle>{t("changeUserLanguageView.header")}</CardTitle>
        <CardDescription>{t("changeUserLanguageView.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="language">{t("changeUserLanguageView.field.language")}</Label>
        <Select value={language} onValueChange={setLanguage}>
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
