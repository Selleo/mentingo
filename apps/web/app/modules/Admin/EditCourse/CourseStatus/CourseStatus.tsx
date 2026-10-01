import { COURSE_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Form, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { cn } from "~/lib/utils";

import { COURSE_STATUS_HANDLES } from "../../../../../e2e/data/courses/handles";
import { useCourseStatusFlags } from "../hooks/useCourseStatusFlags";

import CourseStatusCard from "./CourseStatusCard";
import { useCourseStatusForm } from "./hooks/useCourseStatusForm";

import type { SupportedLanguages } from "@repo/shared";
import type { CourseStatus } from "~/api/queries/useCourses";

type CoursePublishStatusProps = {
  courseId: string;
  status: CourseStatus;
  language: SupportedLanguages;
  className?: string;
  variant?: "legacy" | "settings";
};

const CoursePublishStatus = ({
  courseId,
  status,
  language,
  className,
  variant = "legacy",
}: CoursePublishStatusProps) => {
  const { form, onSubmit } = useCourseStatusForm({ courseId, status, language });
  const { t } = useTranslation();

  const currentStatus = form.watch("status");
  const { isPublished, isDraft, isPrivate } = useCourseStatusFlags(currentStatus);
  const isSettingsVariant = variant === "settings";
  const formId = `course-status-form-${courseId}`;

  return (
    <div
      className={cn(
        "flex w-full max-w-[744px] flex-col gap-y-6 bg-white p-8",
        { "gap-y-4": isSettingsVariant },
        className,
      )}
    >
      <div className={cn({ "flex items-start justify-between gap-4": isSettingsVariant })}>
        <div className={cn("flex flex-col gap-y-1.5", { "gap-1": isSettingsVariant })}>
          <h5
            className={cn("text-neutral-950", {
              h5: !isSettingsVariant,
              "text-base font-semibold": isSettingsVariant,
            })}
          >
            {t("adminCourseView.status.header")}
          </h5>
          <p
            className={cn("text-neutral-900", {
              "body-base": !isSettingsVariant,
              "text-sm": isSettingsVariant,
            })}
          >
            {t("adminCourseView.status.subHeader")}
          </p>
        </div>
        {isSettingsVariant && (
          <Button data-testid={COURSE_STATUS_HANDLES.SAVE_BUTTON} type="submit" form={formId}>
            {t("common.button.save")}
          </Button>
        )}
      </div>
      <Form {...form}>
        <form
          id={formId}
          className={cn("flex flex-col gap-y-6", { "gap-y-4": isSettingsVariant })}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            name="status"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <div className={cn("flex flex-col space-y-6", { "space-y-3": isSettingsVariant })}>
                  <CourseStatusCard
                    variant={variant}
                    checked={isDraft}
                    onChange={() => field.onChange(COURSE_STATUSES.DRAFT)}
                    headerKey="adminCourseView.status.draftHeader"
                    bodyKey="adminCourseView.status.draftBody"
                    id={COURSE_STATUSES.DRAFT}
                  />
                  <CourseStatusCard
                    variant={variant}
                    checked={isPrivate}
                    onChange={() => field.onChange(COURSE_STATUSES.PRIVATE)}
                    headerKey="adminCourseView.status.privateHeader"
                    bodyKey="adminCourseView.status.privateBody"
                    id={COURSE_STATUSES.PRIVATE}
                  />
                  <CourseStatusCard
                    variant={variant}
                    checked={isPublished}
                    onChange={() => field.onChange(COURSE_STATUSES.PUBLISHED)}
                    headerKey="adminCourseView.status.publishedHeader"
                    bodyKey="adminCourseView.status.publishedBody"
                    id={COURSE_STATUSES.PUBLISHED}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {!isSettingsVariant && (
            <div className="w-20">
              <Button data-testid={COURSE_STATUS_HANDLES.SAVE_BUTTON} type="submit">
                {t("common.button.save")}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
};

export default CoursePublishStatus;
