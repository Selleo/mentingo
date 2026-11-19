import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";

import { AUTHORING_CONNECTION_STATE } from "../courseAuthoring.constants";

import type { AuthoringConnectionState } from "../courseAuthoring.types";

type Props = {
  connection: AuthoringConnectionState;
  onReconnect: () => void;
};

/** Distinguishes recoverable connection loss from terminal access or session failures. */
export const AuthoringConnectionNotice = ({ connection, onReconnect }: Props) => {
  const { t } = useTranslation();
  const message = match(connection)
    .with(AUTHORING_CONNECTION_STATE.LIVE, () => null)
    .with(AUTHORING_CONNECTION_STATE.CONNECTING, AUTHORING_CONNECTION_STATE.RECOVERING, () =>
      t("courseAuthoring.conversation.reconnecting"),
    )
    .with(AUTHORING_CONNECTION_STATE.OFFLINE, () =>
      t("courseAuthoring.conversation.connectionOffline"),
    )
    .with(AUTHORING_CONNECTION_STATE.PERMISSION_REVOKED, () =>
      t("courseAuthoring.conversation.connectionPermissionRevoked"),
    )
    .with(AUTHORING_CONNECTION_STATE.SESSION_UNAVAILABLE, () =>
      t("courseAuthoring.conversation.connectionSessionUnavailable"),
    )
    .exhaustive();

  if (message === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-2 text-sm text-neutral-500"
    >
      <p>{message}</p>
      {connection === AUTHORING_CONNECTION_STATE.OFFLINE && (
        <Button type="button" variant="outline" size="sm" onClick={onReconnect}>
          {t("courseAuthoring.conversation.reconnect")}
        </Button>
      )}
    </div>
  );
};
