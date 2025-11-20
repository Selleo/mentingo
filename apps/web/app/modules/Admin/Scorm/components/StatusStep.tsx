import { useNavigate } from "@remix-run/react";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateCourse } from "~/api/mutations";
import { useUploadFile } from "~/api/mutations/admin/useUploadFile";
import { useUploadScormPackage } from "~/api/mutations/admin/useUploadScormPackage";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";

import { useScormFormStore } from "../store/scormForm.store";

import type { CourseFormData, CourseStatus, StepComponentProps } from "../types/scorm.types";
import type { Languages } from "@repo/shared";

export function StatusStep({ handleBack, handleNext: _ }: StepComponentProps) {
  const navigate = useNavigate();
  const { setValue, watch, handleSubmit } = useFormContext<CourseFormData>();
  const { mutateAsync: createCourse, isPending: isCreateCoursePending } = useCreateCourse();
  const { mutateAsync: uploadFile, isPending: isUploadFilePending } = useUploadFile();
  const { mutateAsync: uploadScormPackage, isPending: isUploadScormPending } =
    useUploadScormPackage();

  const status = watch("status");
  const { t } = useTranslation();

  const { resetForm } = useScormFormStore();

  const onSubmit = async (data: CourseFormData) => {
    try {
      const thumbnailResult = data.details.thumbnail
        ? await uploadFile({
            file: data.details.thumbnail,
            resource: "course",
          })
        : null;

      const courseResult = await createCourse({
        data: {
          categoryId: data.details.category,
          description: data.details.description,
          title: data.details.title,
          thumbnailS3Key: thumbnailResult?.fileKey,
          isScorm: true,
          priceInCents: data.pricing.price || 0,
          language: SUPPORTED_LANGUAGES.EN as Languages,
        },
      });

      if (!courseResult?.data?.id) {
        throw new Error("Course creation failed - no course ID received");
      }

      if (!data.scorm.file) {
        throw new Error("No SCORM file provided");
      }

      await uploadScormPackage({
        file: data.scorm.file,
        courseId: courseResult.data.id,
      });

      resetForm();
      navigate("/courses");
    } catch (error) {
      console.error("Error creating course:", error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <RadioGroup
        defaultValue={status}
        onValueChange={(value: CourseStatus) => setValue("status", value)}
      >
        <div className="space-y-4">
          <Card
            className={cn("flex items-start space-x-4 px-4", {
              "border-primary-500 bg-primary-50": status === "draft",
            })}
          >
            <RadioGroupItem value="draft" id="draft" className="my-5" />
            <Label
              htmlFor="draft"
              className="flex size-full flex-1 cursor-pointer flex-col gap-2 py-4"
            >
              <div className="text-lg font-medium">{t("common.other.draft")}</div>
              <div className="text-sm font-normal">{t("adminScorm.other.draftBody")}</div>
            </Label>
          </Card>

          <Card
            className={cn("flex items-start space-x-4 px-4", {
              "border-primary-500 bg-primary-50": status === "published",
            })}
          >
            <RadioGroupItem value="published" id="published" className="my-5" />
            <Label
              htmlFor="published"
              className="flex size-full flex-1 cursor-pointer flex-col gap-2 py-4"
            >
              <div className="text-lg font-medium">{t("common.other.publish")}</div>
              <div className="text-sm font-normal">{t("adminScorm.other.publishBody")}</div>
            </Label>
          </Card>
        </div>
      </RadioGroup>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleBack}>
          {t("adminScorm.button.back")}
        </Button>
        <Button
          onClick={() => {
            handleSubmit(onSubmit)();
          }}
          disabled={isCreateCoursePending || isUploadFilePending || isUploadScormPending}
        >
          {isCreateCoursePending || isUploadFilePending || isUploadScormPending
            ? t("adminScorm.button.creatingCourse")
            : t("adminScorm.button.createCourse")}
        </Button>
      </div>
    </div>
  );
}
