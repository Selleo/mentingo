/** Displays durable author requests using the AI Mentor chat's message geometry and colors. */
import { useTranslation } from "react-i18next";

import type { AuthoringRequestView } from "../courseAuthoring.types";

type Props = { requests: AuthoringRequestView[] };

/** Preserves every saved instruction without attributing shared-session messages to the current editor. */
export const AuthoringRequestHistory = ({ requests }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 pt-4">
      {requests.map((request) => (
        <div key={request.id} className="flex max-w-full flex-row-reverse items-end gap-3">
          <div className="flex min-w-0 max-w-[90%] flex-col items-end gap-1">
            <p
              className="w-fit max-w-full whitespace-pre-wrap break-words rounded-xl bg-primary-100 px-4 py-2 text-sm leading-relaxed text-gray-800"
              aria-label={t("courseAuthoring.conversation.request")}
            >
              {request.instruction}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
