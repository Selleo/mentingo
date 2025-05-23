import { memo } from "react";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";

import type { GetCategoryByIdResponse, UpdateCategoryBody } from "~/api/generated-api";

export const CategoryDetails = memo<{
  name: keyof UpdateCategoryBody;
  control: Control<UpdateCategoryBody>;
  category: GetCategoryByIdResponse["data"];
}>(({ name, control, category }) => {
  const { t } = useTranslation();

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={category[name] as UpdateCategoryBody[typeof name]}
      render={({ field }) => {
        if (name === "archived") {
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="archived"
                checked={field.value as boolean | undefined}
                onCheckedChange={(checked) => field.onChange(checked)}
              />
              <label
                htmlFor="archived"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t("common.other.archived")}
              </label>
            </div>
          );
        }

        return (
          <Input
            {...field}
            value={field.value as string}
            onChange={(e) => {
              field.onChange(e);
            }}
            className="w-full rounded-md border border-neutral-300 px-2 py-1"
          />
        );
      }}
    />
  );
});
