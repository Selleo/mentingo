import Loader from "~/modules/common/Loader/Loader";

import { EmbedFrame } from "./EmbedFrame";

import type { GetLessonByIdResponse } from "~/api/generated-api";
import type { LessonResource } from "~/modules/Admin/EditCourse/EditCourse.types";

interface EmbedLessonProps {
  lessonResources: LessonResource[];
  lesson: GetLessonByIdResponse["data"];
}

export const EmbedLesson = ({ lessonResources, lesson }: EmbedLessonProps) => {
  if (!lesson) return <Loader />;

  return (
    <div className="flex flex-col gap-5">
      {lessonResources.map((resource) => (
        <EmbedFrame key={resource.id} resource={resource} title={lesson.title} />
      ))}
    </div>
  );
};
