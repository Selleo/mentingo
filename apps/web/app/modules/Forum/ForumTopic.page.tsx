import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useForumTopicSuspense } from "~/api/queries/forum/useForumTopic";
import { PageWrapper } from "~/components/PageWrapper";
import { ForumFeatureGuard } from "~/Guards/ForumFeatureGuard";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import { ForumTopicDetails } from "./components/ForumTopicDetails";
import { getTopicHeading } from "./forum.utils";

export default function ForumTopicPage() {
  return (
    <ForumFeatureGuard>
      <ForumTopic />
    </ForumFeatureGuard>
  );
}

function ForumTopic() {
  const { t } = useTranslation();
  const { topicId = "" } = useParams();
  const language = useLanguageStore((state) => state.language);
  const { data: topic } = useForumTopicSuspense(topicId, language);

  const breadcrumbs = [
    { title: t("forum.title"), href: "/forum" },
    ...(topic ? [{ title: getTopicHeading(topic, t), href: `/forum/topics/${topic.id}` }] : []),
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      {topic ? (
        <ForumTopicDetails topic={topic} />
      ) : (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.TOPIC_NOT_FOUND}>
          {t("forum.errors.topicNotFound")}
        </p>
      )}
    </PageWrapper>
  );
}
