import { ALLOWED_AGE_LIMITS } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useChangeAgeLimit } from "~/api/mutations/admin/useChangeAgeLimit";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import type { GetPublicGlobalSettingsResponse, UpdateAgeLimitBody } from "~/api/generated-api";

interface AgeLimitSelectProps {
  limit: GetPublicGlobalSettingsResponse["data"]["ageLimit"];
}

export const AgeLimitSelect = ({ limit }: AgeLimitSelectProps) => {
  const { t } = useTranslation();

  const [ageLimit, setAgeLimit] = useState<UpdateAgeLimitBody["ageLimit"]>(limit);
  const { mutate: updateAgeLimit, isPending } = useChangeAgeLimit();

  const handleAgeLimitChange = (value: string) => {
    setAgeLimit(
      value !== "null" ? (Number.parseInt(value) as UpdateAgeLimitBody["ageLimit"]) : null,
    );
  };

  const handleSaveAgeLimit = () => {
    if (limit === ageLimit) return;

    updateAgeLimit({ ageLimit: ageLimit });
  };

  return (
    <Card id="age-limit" data-testid={SETTINGS_PAGE_HANDLES.AGE_LIMIT_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("ageLimitView.header")}</CardTitle>
        <CardDescription className="body-lg-md">{t("ageLimitView.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={JSON.stringify(ageLimit)} onValueChange={handleAgeLimitChange}>
          <SelectTrigger
            className="body-sm-md"
            data-testid={SETTINGS_PAGE_HANDLES.AGE_LIMIT_SELECT}
          >
            <SelectValue placeholder={t(`ageLimitView.select.placeholder`)} />
          </SelectTrigger>
          <SelectContent>
            {ALLOWED_AGE_LIMITS.map((age) => {
              return (
                <SelectItem
                  key={age}
                  value={JSON.stringify(age)}
                  className={cn({ "body-sm-md": ageLimit === age })}
                  data-testid={SETTINGS_PAGE_HANDLES.ageLimitOption(JSON.stringify(age))}
                >
                  {age ? JSON.stringify(age) : t(`ageLimitView.select.null.label`)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button
          disabled={isPending || ageLimit === limit}
          type="submit"
          onClick={handleSaveAgeLimit}
          data-testid={SETTINGS_PAGE_HANDLES.AGE_LIMIT_SAVE}
        >
          {t("common.button.save")}
        </Button>
      </CardFooter>
    </Card>
  );
};
