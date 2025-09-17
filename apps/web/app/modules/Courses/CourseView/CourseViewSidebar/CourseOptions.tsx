import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useEnrollCourse } from "~/api/mutations";
import { courseQueryOptions, useCurrentUser } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { Enroll } from "~/assets/svgs";
import { CopyUrlButton } from "~/components/CopyUrlButton/CopyUrlButton";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { PaymentModal } from "~/modules/stripe/PaymentModal";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseOptionsProps = {
  course: GetCourseResponse["data"];
};

export const CourseOptions = ({ course }: CourseOptionsProps) => {
  const { mutateAsync: enrollCourse } = useEnrollCourse();
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();

  const handleEnrollCourse = async () => {
    await enrollCourse({ id: course?.id }).then(() => {
      queryClient.invalidateQueries(courseQueryOptions(course?.id));
    });
  };

  const renderEnrollButton = () => {
    if (!currentUser) {
      return (
        <Link to="/auth/register">
          <Button className="w-full gap-x-2" variant="primary">
            <Enroll />
            <span>{t("studentCourseView.sideSection.button.enrollCourse")}</span>
          </Button>
        </Link>
      );
    }

    return (
      <Button onClick={handleEnrollCourse} className="gap-x-2" variant="primary">
        <Enroll />
        <span>{t("studentCourseView.sideSection.button.enrollCourse")}</span>
      </Button>
    );
  };

  return (
    <>
      <h4 className="h6 pb-1 text-neutral-950">
        {t("studentCourseView.sideSection.optionHeader")}
      </h4>
      <div className="flex flex-col gap-y-2">
        <CopyUrlButton variant="outline" className="gap-x-2">
          <Icon name="Share" className="h-auto w-6 text-primary-800" />
          <span>{t("studentCourseView.sideSection.button.shareCourse")}</span>
        </CopyUrlButton>
        {course.priceInCents && course.currency ? (
          <PaymentModal
            courseCurrency={course.currency}
            coursePrice={course.priceInCents}
            courseTitle={course.title}
            courseDescription={course.description}
            courseId={course.id}
          />
        ) : (
          renderEnrollButton()
        )}
      </div>
    </>
  );
};
