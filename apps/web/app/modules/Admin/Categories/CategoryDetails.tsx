import { memo } from "react";
import { type Control, Controller } from "react-hook-form";

import { Input } from "~/components/ui/input";

import { CATEGORY_PAGE_HANDLES } from "../../../../e2e/data/categories/handles";

import type { GetCategoryByIdResponse, UpdateCategoryBody } from "~/api/generated-api";

export type CategoryDetailsField = "title";

export const CategoryDetails = memo<{
  name: CategoryDetailsField;
  control: Control<UpdateCategoryBody>;
  category: GetCategoryByIdResponse["data"];
}>(({ name, control, category }) => {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={category[name] as UpdateCategoryBody[typeof name]}
      render={({ field }) => {
        return (
          <Input
            {...field}
            data-testid={name === "title" ? CATEGORY_PAGE_HANDLES.TITLE : undefined}
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
