import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useUpdateUser } from "~/api/mutations/useUpdateUser";
import { currentUserQueryOptions, useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
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
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import type { UpdateUserBody } from "~/api/generated-api";

export const clientLoader = async () => {
  await queryClient.prefetchQuery(currentUserQueryOptions);
  return null;
};

const updateUserSchema = z.object({
  email: z.string().email(),
});

export default function UserForm() {
  const { mutate: updateUser } = useUpdateUser();
  const { data: currentUser } = useCurrentUserSuspense();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserBody>({ resolver: zodResolver(updateUserSchema) });

  const onSubmit = (data: UpdateUserBody) => {
    updateUser({ data });
  };

  return (
    <Card id="change-email">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle className="h5">{t("changeUserEmailView.header")}</CardTitle>
          <CardDescription className="body-lg-md">
            {t("changeUserEmailView.subHeader")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="email" className="body-base-md">
            {t("changeUserEmailView.field.email")}
          </Label>
          <Input
            id="email"
            placeholder="user@email.com"
            defaultValue={currentUser?.email}
            className={cn({
              "border-red-500 focus:!ring-red-500": errors.email,
            })}
            {...register("email", { required: t("changeUserEmailView.validation.email") })}
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button>{t("common.button.save")}</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
