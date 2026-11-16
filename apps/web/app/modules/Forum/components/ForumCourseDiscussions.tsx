import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useForumCourseDiscussions } from "~/api/queries/forum/useForumCourseDiscussions";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";
import { FORUM_COURSE_DISCUSSIONS_PATH, canReadCourseDiscussions } from "../forum.utils";

import { ForumCourseDiscussionListItem } from "./ForumCourseDiscussionListItem";

const PREVIEWED_COURSE_COUNT = 5;

export function ForumCourseDiscussions() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: globalSettings } = useGlobalSettings();
  const { data: currentUser } = useCurrentUser();
  const { data: courseDiscussions } = useForumCourseDiscussions(
    { page: 1, perPage: PREVIEWED_COURSE_COUNT, language },
    {
      enabled: canReadCourseDiscussions(
        currentUser?.permissions ?? [],
        globalSettings?.courseDiscussionsEnabled,
      ),
    },
  );

  if (!courseDiscussions?.data.length) return null;

  const { totalItems } = courseDiscussions.pagination;

  return (
    <section className="space-y-3" data-testid={FORUM_HANDLES.COURSE_DISCUSSIONS}>
      <h2 className="body-base-md text-neutral-950">{t("forum.courseDiscussions.title")}</h2>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {courseDiscussions.data.map((courseDiscussion) => (
          <li key={courseDiscussion.courseId}>
            <ForumCourseDiscussionListItem courseDiscussion={courseDiscussion} />
          </li>
        ))}
      </ul>
      {totalItems > PREVIEWED_COURSE_COUNT && (
        <Link
          to={FORUM_COURSE_DISCUSSIONS_PATH}
          className="body-sm-md inline-flex text-primary-700 hover:underline"
          data-testid={FORUM_HANDLES.COURSE_DISCUSSIONS_ALL_LINK}
        >
          {t("forum.courseDiscussions.viewAll", { count: totalItems })}
        </Link>
      )}
    </section>
  );
}
