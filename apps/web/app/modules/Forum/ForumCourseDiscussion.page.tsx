import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useForumCourseDiscussionSuspense } from "~/api/queries/forum/useForumCourseDiscussion";
import { PageWrapper } from "~/components/PageWrapper";
import { ForumFeatureGuard } from "~/Guards/ForumFeatureGuard";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import { ForumCourseDiscussionDetails } from "./components/ForumCourseDiscussionDetails";
import { FORUM_COURSE_DISCUSSIONS_PATH, getForumCourseDiscussionPath } from "./forum.utils";

export default function ForumCourseDiscussionPage() {
  return (
    <ForumFeatureGuard>
      <ForumCourseDiscussion />
    </ForumFeatureGuard>
  );
}

function ForumCourseDiscussion() {
  const { t } = useTranslation();
  const { courseId = "" } = useParams();
  const language = useLanguageStore((state) => state.language);
  const { data: courseDiscussion } = useForumCourseDiscussionSuspense(courseId, language);

  const breadcrumbs = [
    { title: t("forum.title"), href: "/forum" },
    { title: t("forum.courseDiscussions.title"), href: FORUM_COURSE_DISCUSSIONS_PATH },
    ...(courseDiscussion
      ? [
          {
            title: t("forum.courseDiscussions.heading", { course: courseDiscussion.courseTitle }),
            href: getForumCourseDiscussionPath(courseDiscussion.courseId),
          },
        ]
      : []),
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      {courseDiscussion ? (
        <ForumCourseDiscussionDetails courseDiscussion={courseDiscussion} />
      ) : (
        <p
          className="body-sm text-neutral-600"
          data-testid={FORUM_HANDLES.COURSE_DISCUSSION_NOT_FOUND}
        >
          {t("forum.errors.courseDiscussionNotFound")}
        </p>
      )}
    </PageWrapper>
  );
}
