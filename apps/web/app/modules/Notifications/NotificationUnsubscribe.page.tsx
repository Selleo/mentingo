import { Link, useSearchParams } from "@remix-run/react";
import {
  ACCOUNT_SETTINGS_PATH,
  DISCUSSION_UNSUBSCRIBE_TOKEN_PARAM,
  DISCUSSION_UNSUBSCRIBE_TYPES,
} from "@repo/shared";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useUnsubscribeFromDiscussionEmails } from "~/api/mutations/useUnsubscribeFromDiscussionEmails";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { setPageTitle } from "~/utils/setPageTitle";

import { NOTIFICATIONS_HANDLES } from "./handles";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.notificationUnsubscribe");

export default function NotificationUnsubscribePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get(DISCUSSION_UNSUBSCRIBE_TOKEN_PARAM);
  const {
    mutate: unsubscribe,
    data: result,
    isPending,
    error,
  } = useUnsubscribeFromDiscussionEmails();
  const isLinkRejected = isAxiosError(error) && error.response?.status === 400;

  const description = match({
    result,
    isInvalid: isLinkRejected || !token,
    hasFailed: Boolean(error),
  })
    .with({ isInvalid: true }, () => t("discussionNotifications.unsubscribe.invalidLink"))
    .with({ hasFailed: true }, () => t("discussionNotifications.unsubscribe.tryAgain"))
    .with({ result: { type: DISCUSSION_UNSUBSCRIBE_TYPES.REPLIES } }, () =>
      t("discussionNotifications.unsubscribe.done.replies"),
    )
    .with({ result: { type: DISCUSSION_UNSUBSCRIBE_TYPES.MENTIONS } }, () =>
      t("discussionNotifications.unsubscribe.done.mentions"),
    )
    .with({ result: { type: DISCUSSION_UNSUBSCRIBE_TYPES.THREAD } }, () =>
      t("discussionNotifications.unsubscribe.done.thread"),
    )
    .otherwise(() => t("discussionNotifications.unsubscribe.confirmDescription"));
  const canConfirm = Boolean(token) && !result && !isLinkRejected;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Card
        className="mx-auto w-full max-w-md"
        data-testid={NOTIFICATIONS_HANDLES.UNSUBSCRIBE_PAGE}
      >
        <CardHeader>
          <CardTitle className="h4 text-center">
            {t("discussionNotifications.unsubscribe.title")}
          </CardTitle>
          <CardDescription
            className="text-center"
            data-testid={NOTIFICATIONS_HANDLES.UNSUBSCRIBE_MESSAGE}
          >
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          {canConfirm && token && (
            <Button
              type="button"
              disabled={isPending}
              data-testid={NOTIFICATIONS_HANDLES.UNSUBSCRIBE_CONFIRM_BUTTON}
              onClick={() => unsubscribe(token)}
            >
              {t("discussionNotifications.unsubscribe.confirm")}
            </Button>
          )}
          <Link to={ACCOUNT_SETTINGS_PATH} className="body-sm-md text-primary-700 hover:underline">
            {t("discussionNotifications.unsubscribe.manageInSettings")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
