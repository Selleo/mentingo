import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { Icon } from "~/components/Icon";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

import type { Control, FieldErrors } from "react-hook-form";

interface CreateAnnouncementFormProps {
  control: Control;
  errors: FieldErrors;
}

export default function CreateQAForm({ control, errors }: CreateAnnouncementFormProps) {
  const { t } = useTranslation();

  const { data: groups } = useGroupsQuerySuspense();

  return (
    <Card className="w-full">
      <CardHeader className="px-6 pt-6 md:px-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="size-10 rounded-lg bg-primary-100 p-2">
            <Icon name="Megaphone" className="text-primary-800" />
          </div>
        </div>
        <h2 className="h5 md:h4">{t("announcements.createPage.header")}</h2>
        <p className="body-sm-md md:body-base-md text-neutral-800">
          {t("announcements.createPage.subheader")}
        </p>
      </CardHeader>
      <CardContent className="px-6 md:px-8">
        <div className="space-y-4">
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="body-sm-md md:body-base-md mb-1 block">
                  <span className="text-error-600">*</span>{" "}
                  {t(`announcements.createPage.fields.${field.name}`)}
                </Label>
                <Input
                  id={field.name}
                  type="text"
                  placeholder={t(`announcements.createPage.placeholders.${field.name}`)}
                  {...field}
                />
                {errors[field.name] && (
                  <p className="body-sm text-error-600">{errors[field.name]?.message}</p>
                )}
              </div>
            )}
          />
          <Controller
            control={control}
            name="groupId"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="body-sm-md md:body-base-md mb-1 block">
                  <span className="text-error-600">*</span>{" "}
                  {t(`announcements.createPage.fields.group`)}
                </Label>
                <Select
                  onValueChange={(value) => field.onChange(value === "everyone" ? null : value)}
                  value={field.value || "everyone"}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder={t(`announcements.createPage.placeholders.group`)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="everyone">
                        {t("announcements.createPage.fields.everyone")}
                      </SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="body-sm-md md:body-base-md mb-1 block">
                  <span className="text-error-600">*</span>{" "}
                  {t(`announcements.createPage.fields.${field.name}`)}
                </Label>
                <Textarea
                  id={field.name}
                  className="min-h-[300px]"
                  placeholder={t(`announcements.createPage.placeholders.${field.name}`)}
                  {...field}
                />
                {errors[field.name] && (
                  <p className="body-sm text-error-600">{errors[field.name]?.message}</p>
                )}
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
