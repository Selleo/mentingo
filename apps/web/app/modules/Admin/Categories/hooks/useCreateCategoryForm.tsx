import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useCreateCategory } from "~/api/mutations/admin/useCreateCategory";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { createCategoryFormSchema } from "../validators/createCategoryFormSchema";

import type { CreateCategoryFormValues } from "../validators/createCategoryFormSchema";
import type { CreateCategoryResponse } from "~/api/generated-api";

export const useCreateCategoryForm = (onSuccess: (response: CreateCategoryResponse) => void) => {
  const { mutateAsync: createCategory } = useCreateCategory();
  const language = useLanguageStore((state) => state.language);

  const form = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategoryFormSchema),
    defaultValues: {
      title: "",
      language,
    },
  });

  const onSubmit = (values: CreateCategoryFormValues) => {
    createCategory({
      data: values,
    }).then((response) => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

      onSuccess(response);
    });
  };

  return { form, onSubmit };
};
