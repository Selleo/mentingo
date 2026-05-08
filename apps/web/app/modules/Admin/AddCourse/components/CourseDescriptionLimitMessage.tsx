import { cn } from "~/lib/utils";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { MAX_COURSE_DESCRIPTION_HTML_LENGTH, MAX_COURSE_DESCRIPTION_LENGTH } from "../constants";

type CourseDescriptionLimitMessageProps = {
  description: string;
  charactersLeftLabel: string;
  reachedCharactersLimitLabel: string;
  reachedCharactersLimitHtmlLabel: string;
};

export const getCourseDescriptionCharactersLeft = (description: string) =>
  MAX_COURSE_DESCRIPTION_LENGTH - stripHtmlTags(description).length;

export const CourseDescriptionLimitMessage = ({
  description,
  charactersLeftLabel,
  reachedCharactersLimitLabel,
  reachedCharactersLimitHtmlLabel,
}: CourseDescriptionLimitMessageProps) => {
  const charactersLeft = getCourseDescriptionCharactersLeft(description);

  if (description.length > MAX_COURSE_DESCRIPTION_HTML_LENGTH) {
    return <p className="text-sm text-red-500">{reachedCharactersLimitHtmlLabel}</p>;
  }

  if (charactersLeft <= 0) {
    return <p className="text-sm text-red-500">{reachedCharactersLimitLabel}</p>;
  }

  return (
    <p className={cn("mt-1 text-neutral-800")}>
      {charactersLeft} {charactersLeftLabel}
    </p>
  );
};
