import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useUpsertUserDetails } from "~/api/mutations";
import { currentUserQueryOptions, useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { useUserDetailsSuspense } from "~/api/queries/useUserDetails";
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
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

import type { UpsertUserDetailsBody } from "~/api/generated-api";

export const clientLoader = async () => {
  await queryClient.prefetchQuery(currentUserQueryOptions);
  return null;
};

const updateUserDetailsSchema = z.object({
  description: z.string(),
  contactEmail: z.string().email(),
  contactPhoneNumber: z.string(),
  jobTitle: z.string(),
});

export default function UserForm() {
  const { data: currentUser } = useCurrentUserSuspense();
  const { data: currentUserDetails } = useUserDetailsSuspense(currentUser?.id ?? "");
  const { t } = useTranslation();

  const { mutate: updateUserDetails } = useUpsertUserDetails();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpsertUserDetailsBody>({
    resolver: zodResolver(updateUserDetailsSchema),
  });

  const onSubmit = async (data: UpsertUserDetailsBody) => {
    updateUserDetails({ data });
  };

  return (
    <Card id="user-details">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle className="h5">{t("changeUserInformationView.header")}</CardTitle>
          <CardDescription className="body-lg-md">
            {t("changeUserInformationView.subHeader")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label htmlFor="Bio - note" className="body-base-md">
              {t("changeUserInformationView.field.description")}
            </Label>
            <Textarea
              placeholder={t("changeUserInformationView.placeholder.description")}
              {...(currentUserDetails?.description && {
                defaultValue: currentUserDetails.description,
              })}
              className={cn("min-h-[150px] resize-none", {
                "border-red-500 focus:!ring-red-500": errors.description,
              })}
              {...register("description")}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="contactEmail" className="body-base-md">
              {t("changeUserInformationView.field.email")}
            </Label>
            <Input
              {...(currentUser?.email && {
                defaultValue: currentUser.email,
              })}
              placeholder="user@email.com"
              className={cn({
                "border-red-500 focus:!ring-red-500": errors.contactEmail,
              })}
              {...register("contactEmail")}
            />
            {errors.contactEmail && (
              <p className="mt-1 text-xs text-red-500">{errors.contactEmail.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="contactPhoneNumber" className="body-base-md">
              {t("changeUserInformationView.field.phoneNumber")}
            </Label>
            <Input
              {...(currentUserDetails?.contactPhone && {
                defaultValue: currentUserDetails.contactPhone,
              })}
              placeholder={t("changeUserInformationView.placeholder.phoneNumber")}
              className={cn({
                "border-red-500 focus:!ring-red-500": errors.contactPhoneNumber,
              })}
              {...register("contactPhoneNumber")}
            />
            {errors.contactPhoneNumber && (
              <p className="mt-1 text-xs text-red-500">{errors.contactPhoneNumber.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="jobTitle" className="body-base-md">
              {t("changeUserInformationView.field.jobTitle")}
            </Label>
            <Input
              {...(currentUserDetails?.jobTitle && {
                defaultValue: currentUserDetails.jobTitle,
              })}
              placeholder={t("changeUserInformationView.placeholder.jobTitle")}
              className={cn({
                "border-red-500 focus:!ring-red-500": errors.jobTitle,
              })}
              {...register("jobTitle")}
            />
            {errors.jobTitle && (
              <p className="mt-1 text-xs text-red-500">{errors.jobTitle.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit">{t("common.button.save")}</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
