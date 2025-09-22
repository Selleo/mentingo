import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateDefaultCourseCurrency } from "~/api/mutations/admin/useUpdateDefaultCourseCurrency";
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

import { ALLOWED_CURRENCIES } from "../../constants";

import type { AllowedCurrency } from "../../types";

interface DefaultCourseCurrencySelectProps {
  currentCurrency: AllowedCurrency;
}

export const DefaultCourseCurrencySelect = ({
  currentCurrency,
}: DefaultCourseCurrencySelectProps) => {
  const { t } = useTranslation();

  const [selectedCurrency, setSelectedCurrency] = useState<AllowedCurrency>(currentCurrency);
  const { mutate: updateDefaultCourseCurrency, isPending } = useUpdateDefaultCourseCurrency();

  const handleCurrencyChange = (value: AllowedCurrency) => {
    setSelectedCurrency(value);
  };

  const handleSaveDefaultCurrency = () => {
    if (selectedCurrency === currentCurrency) return;

    updateDefaultCourseCurrency({ defaultCourseCurrency: selectedCurrency });
  };

  return (
    <Card id="default-course-currency">
      <CardHeader>
        <CardTitle>{t("defaultCourseCurrencyView.header")}</CardTitle>
        <CardDescription>{t("defaultCourseCurrencyView.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
          <SelectTrigger>
            <SelectValue
              placeholder={t(`defaultCourseCurrencyView.select.${selectedCurrency}.placeholder`)}
            />
          </SelectTrigger>
          <SelectContent>
            {ALLOWED_CURRENCIES.map((currency) => {
              return (
                <SelectItem key={currency} value={currency}>
                  {t(`defaultCourseCurrencyView.select.${currency}.label`)} -{" "}
                  {t(`defaultCourseCurrencyView.select.${currency}.sign`)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button
          disabled={isPending || selectedCurrency === currentCurrency}
          type="submit"
          onClick={handleSaveDefaultCurrency}
        >
          {t("common.button.save")}
        </Button>
      </CardFooter>
    </Card>
  );
};
