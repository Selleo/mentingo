import { useNavigate } from "@remix-run/react";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useRepeatCourse } from "~/api/mutations/useRepeatCourse";
import { Button } from "~/components/ui/button";

import { COURSE_OVERVIEW_HANDLES } from "../../../../e2e/data/courses/handles";
import { navigateToNextLesson } from "../utils/navigateToNextLesson";

import type { GetCourseResponse } from "~/api/generated-api";

export function CourseRepetition({ course }: { course: GetCourseResponse["data"] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: repeatCourse, isPending } = useRepeatCourse(course.id);
  const state = course.learningState;
  if (!course.enrolled || !state?.current?.completedAt) return null;
  if (state.repetition || !state.enabled) return null;
  const currentStateId = state.current.id;
  return (
    <Button
      className="gap-2"
      data-testid={COURSE_OVERVIEW_HANDLES.REPEAT_BUTTON}
      disabled={isPending}
      onClick={async () => {
        const result = await repeatCourse(currentStateId).catch(() => null);
        if (!result) return;
        navigateToNextLesson(course, navigate, { openFirstLesson: true });
      }}
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      {t("courseRepetition.repeat")}
    </Button>
  );
}
