// TODO: Need to be fixed
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Form, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { useCourseStatusFlags } from "../hooks/useCourseStatusFlags";

import { useCourseStatusForm } from "./hooks/useCourseStatusForm";

import type { CourseStatus } from "~/api/queries/useCourses";

type CoursePublishStatusProps = {
  courseId: string;
  status: CourseStatus;
};

const CoursePublishStatus = ({ courseId, status }: CoursePublishStatusProps) => {
  const { form, onSubmit } = useCourseStatusForm({ courseId, status });
  const { t } = useTranslation();

  const currentStatus = form.watch("status");
  const { isPublished, isDraft } = useCourseStatusFlags(currentStatus);

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
                  <div
                    className={cn(
                      "flex cursor-pointer items-start gap-x-4 rounded-md border px-6 py-4",
                      {
                        "border-blue-500": isDraft,
                        "border-gray-300": isPublished,
                      },
                    )}
                    onClick={() => field.onChange("draft")}
                  >
                    <div className="mt-1.5">
                      <Input
                        type="radio"
                        name="status"
                        checked={isDraft}
                        onChange={() => field.onChange("draft")}
                        className="size-4 cursor-pointer p-1"
                        id="draft"
                      />
                    </div>
                    <div>
                      <Label htmlFor="draft" className="body-lg-md cursor-pointer text-neutral-950">
                        <div className="body-lg-md mb-2 text-neutral-950">
                          {t("adminCourseView.status.draftHeader")}
                        </div>
                      </Label>
                      <p
                        className={cn("body-base mt-1", {
                          "text-black": isDraft,
                          "text-gray-500": isPublished,
                        })}
                      >
                        {t("adminCourseView.status.draftBody")}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex cursor-pointer items-start gap-x-4 rounded-md border px-6 py-4",
                      {
                        "border-blue-500": isPublished,
                        "border-gray-300": isDraft,
                      },
                    )}
                    onClick={() => field.onChange("published")}
                  >
                    <div className="mt-1.5">
                      <Input
                        type="radio"
                        name="status"
                        checked={isPublished}
                        onChange={() => field.onChange("published")}
                        className="size-4 cursor-pointer p-1"
                        id="published"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="published"
                        className="body-lg-md cursor-pointer text-neutral-950"
                      >
                        <div className="body-lg-md mb-2 text-neutral-950">
                          {t("adminCourseView.status.publishedHeader")}
                        </div>
                      </Label>
                      <p
                        className={cn("body-base mt-1", {
                          "text-neutral-950": isPublished,
                          "text-neutral-900": isDraft,
                        })}
                      >
                        {t("adminCourseView.status.publishedBody")}
                      </p>
                    </div>
                  </div>
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
