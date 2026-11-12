import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useForumTopic } from "~/api/queries/forum/useForumTopic";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { PageWrapper } from "~/components/PageWrapper";
import { Skeleton } from "~/components/ui/skeleton";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import { ForumTopicDetails } from "./components/ForumTopicDetails";
import { getTopicHeading } from "./forum.utils";

export default function ForumTopicPage() {
  const { t } = useTranslation();
  const { topicId = "" } = useParams();
  const language = useLanguageStore((state) => state.language);
  const { data: globalSettings, error: settingsError } = useGlobalSettings();
  const isForumEnabled = globalSettings?.forumEnabled === true;
  const { data: topic, error: topicError } = useForumTopic(topicId, language, {
    enabled: isForumEnabled,
  });

  const breadcrumbs = [
    { title: t("forum.title"), href: "/forum" },
    ...(topic ? [{ title: getTopicHeading(topic, t), href: `/forum/topics/${topic.id}` }] : []),
  ];

  const renderContent = () => {
    if (settingsError) {
      return (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.ERROR}>
          {getTranslatedApiErrorMessage(settingsError, t, t("forum.loadError"))}
        </p>
      );
    }

    if (!globalSettings) return <Skeleton className="h-64 w-full" />;

    if (!isForumEnabled) {
      return (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.UNAVAILABLE}>
          {t("forum.unavailable")}
        </p>
      );
    }

    if (topicError) {
      return (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.TOPIC_NOT_FOUND}>
          {getTranslatedApiErrorMessage(topicError, t, t("forum.errors.topicNotFound"))}
        </p>
      );
    }

    if (!topic) return <Skeleton className="h-64 w-full" />;

    return <ForumTopicDetails topic={topic} />;
  };

  return <PageWrapper breadcrumbs={breadcrumbs}>{renderContent()}</PageWrapper>;
}
