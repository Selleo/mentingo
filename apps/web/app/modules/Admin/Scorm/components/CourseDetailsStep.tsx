import {
  ALLOWED_IMAGE_FILE_EXTENSIONS,
  MAX_SCORM_THUMBNAIL_FILE_SIZE_BYTES,
  formatFileSize,
} from "@repo/shared";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCategoriesSuspense } from "~/api/queries";
import { Button } from "~/components/ui/button";
import { FormField } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

import type { CourseFormData, StepComponentProps } from "../types/scorm.types";

export function CourseDetailsStep({ handleBack, handleNext }: StepComponentProps) {
  const { data: categories } = useCategoriesSuspense();
  const {
    register,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useFormContext<CourseFormData>();
  const courseDescription = watch("details.description");
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-6">
        <div className="flex-1">
          <Label className="text-sm font-medium">
            <span className="text-destructive">*</span> {t("adminScorm.field.title")}
          </Label>
          <Input {...register("details.title")} placeholder={t("adminScorm.placeholder.title")} />
          {errors.details?.title && (
            <p className="text-sm text-destructive">{errors.details.title.message}</p>
          )}
        </div>

        <div className="flex-1">
          <Label className="text-sm font-medium">
            <span className="text-destructive">*</span> {t("adminScorm.field.category")}
          </Label>
          <FormField
            control={control}
            name="details.category"
            render={({ field }) => (
              <Select onValueChange={(value) => setValue("details.category", value)} {...field}>
                <SelectTrigger>
                  <SelectValue placeholder={t("adminScorm.placeholder.category")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem value={category.id} key={category.id}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          {errors.details?.category && (
            <p className="text-sm text-destructive">{errors.details.category.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          <span className="text-destructive">*</span> {t("adminScorm.field.description")}
        </Label>
        <Textarea
          {...register("details.description")}
          placeholder={t("adminScorm.placeholder.description")}
          className="h-40 resize-none"
          maxLength={180}
        />
        <div className="flex justify-start">
          <span className="text-sm text-muted-foreground">
            {180 - (courseDescription?.length || 0)} {t("adminScorm.other.charactersLeft")}
          </span>
        </div>
        {errors.details?.description && (
          <p className="text-sm text-destructive">{errors.details.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("adminScorm.field.thumbnail")}</Label>
        <input
          type="file"
          accept={ALLOWED_IMAGE_FILE_EXTENSIONS.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setValue("details.thumbnail", file);
          }}
          className="hidden"
          id="thumbnail-upload"
        />
        <Label
          htmlFor="thumbnail-upload"
          className="block cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary"
        >
          <div className="space-y-2">
            <p className="font-medium">
              {t("uploadFile.header")} {t("uploadFile.subHeader")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("adminScorm.create.uploadThumbnailDescription", {
                maxSize: formatFileSize(MAX_SCORM_THUMBNAIL_FILE_SIZE_BYTES),
              })}
            </p>
          </div>
        </Label>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleBack}>
          {t("adminScorm.button.back")}
        </Button>
        <Button onClick={handleNext}>{t("adminScorm.other.pricing")}</Button>
      </div>
    </div>
  );
}
