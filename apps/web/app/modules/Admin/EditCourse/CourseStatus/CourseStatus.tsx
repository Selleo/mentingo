import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Form, FormField, FormItem, FormMessage } from "~/components/ui/form";

import { useCourseStatusFlags } from "../hooks/useCourseStatusFlags";

import CourseStatusCard from "./CourseStatusCard";
import { useCourseStatusForm } from "./hooks/useCourseStatusForm";

import type { SupportedLanguages } from "@repo/shared";
import type { CourseStatus } from "~/api/queries/useCourses";

type CoursePublishStatusProps = {
  courseId: string;
  status: CourseStatus;
  language: SupportedLanguages;
};

const CoursePublishStatus = ({ courseId, status, language }: CoursePublishStatusProps) => {
  const { form, onSubmit } = useCourseStatusForm({ courseId, status, language });
  const { t } = useTranslation();

  const currentStatus = form.watch("status");
  const { isPublished, isDraft, isPrivate } = useCourseStatusFlags(currentStatus);

  return (
    <div className="flex w-full max-w-[744px] flex-col gap-y-6 bg-white p-8">
      <div className="flex flex-col gap-y-1.5">
        <h5 className="h5 text-neutral-950">{t("adminCourseView.status.header")}</h5>
        <p className="body-base text-neutral-900">{t("adminCourseView.status.subHeader")}</p>
      </div>
      <Form {...form}>
        <form className="flex flex-col gap-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            name="status"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-col space-y-6">
                  <CourseStatusCard
                    checked={isDraft}
                    onChange={() => field.onChange("draft")}
                    headerKey="adminCourseView.status.draftHeader"
                    bodyKey="adminCourseView.status.draftBody"
                    id="draft"
                  />
                  <CourseStatusCard
                    checked={isPrivate}
                    onChange={() => field.onChange("private")}
                    headerKey="adminCourseView.status.privateHeader"
                    bodyKey="adminCourseView.status.privateBody"
                    id="private"
                  />
                  <CourseStatusCard
                    checked={isPublished}
                    onChange={() => field.onChange("published")}
                    headerKey="adminCourseView.status.publishedHeader"
                    bodyKey="adminCourseView.status.publishedBody"
                    id="published"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="w-20">
            <Button type="submit">{t("common.button.save")}</Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CoursePublishStatus;
