import { PERMISSIONS } from "@repo/shared";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCancelLiveTrainingRegistration } from "~/api/mutations/live-training/useCancelLiveTrainingRegistration";
import { useRegisterLiveTraining } from "~/api/mutations/live-training/useRegisterLiveTraining";
import { useUpdateLiveTraining } from "~/api/mutations/live-training/useUpdateLiveTraining";
import { useLiveTrainingRegistrations } from "~/api/queries/live-training/useLiveTrainingRegistrations";
import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { LIVE_TRAINING_HANDLES } from "../../../../e2e/data/live-training/handles";

import type { LiveTrainingDetails, LiveTrainingUiActions } from "../liveTraining.types";

export function LiveTrainingRegistration({
  liveTraining,
  actions,
}: {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: user } = useCurrentUserSuspense();
  const { mutate: update, isPending: isUpdating } = useUpdateLiveTraining();
  const { mutate: register, isPending: isRegistering } = useRegisterLiveTraining();
  const { mutate: cancel, isPending: isCancelling } = useCancelLiveTrainingRegistration();
  const enabled = Boolean(liveTraining.settings.registrationRequired);
  const [pendingRegistrationMode, setPendingRegistrationMode] = useState<boolean | null>(null);
  const { data: members, isError } = useLiveTrainingRegistrations(
    liveTraining.id,
    enabled && actions.canManageSession,
  );
  const registration = liveTraining.registration;
  const isHost = liveTraining.hostIds.includes(user.id) || liveTraining.authorId === user.id;
  const canRegister = hasPermission(user.permissions, PERMISSIONS.LIVE_TRAINING_JOIN) && !isHost;
  if (!enabled && !actions.canShowEdit) return null;

  return (
    <section className="mt-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList aria-hidden="true" className="size-4 text-neutral-500" />
        <h2 className="text-sm font-semibold text-neutral-950">
          {t("liveTrainingView.registration.title")}
        </h2>
      </div>
      <div className="grid gap-3 text-sm">
        {actions.canShowEdit && (
          <label className="flex items-center justify-between gap-4 text-neutral-500">
            <span>{t("liveTrainingView.registration.required")}</span>
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-primary-600"
              data-testid={LIVE_TRAINING_HANDLES.REGISTRATION_TOGGLE}
              checked={pendingRegistrationMode ?? enabled}
              disabled={
                isUpdating ||
                Boolean(registration?.registeredCount || registration?.waitlistedCount)
              }
              onChange={(event) => {
                const registrationRequired = event.target.checked;
                setPendingRegistrationMode(registrationRequired);
                update(
                  { id: liveTraining.id, data: { language, settings: { registrationRequired } } },
                  { onSettled: () => setPendingRegistrationMode(null) },
                );
              }}
            />
          </label>
        )}
        {enabled && registration && (
          <>
            <dl>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">
                  {t("liveTrainingView.registration.registered")}
                </dt>
                <dd className="text-right tabular-nums text-neutral-900">
                  {registration.registeredCount} / {liveTraining.maxParticipants}
                </dd>
              </div>
            </dl>
            <div
              className="empty:hidden text-neutral-900"
              data-testid={LIVE_TRAINING_HANDLES.REGISTRATION_STATUS}
              aria-live="polite"
            >
              {registration.status === "registered" && (
                <p>{t("liveTrainingView.registration.confirmed")}</p>
              )}
              {registration.status === "waitlisted" && (
                <p>
                  {t("liveTrainingView.registration.position", { position: registration.position })}
                </p>
              )}
            </div>
            {!registration.isOpen && (
              <p className="text-sm text-neutral-500">
                {t("liveTrainingView.registration.closed")}
              </p>
            )}
            {canRegister && registration.isOpen && (
              <div>
                {registration.status ? (
                  <Button
                    variant="outline"
                    data-testid={LIVE_TRAINING_HANDLES.CANCEL_REGISTRATION_BUTTON}
                    disabled={isCancelling}
                    onClick={() => cancel(liveTraining.id)}
                  >
                    {t("liveTrainingView.registration.cancel")}
                  </Button>
                ) : (
                  <Button
                    data-testid={LIVE_TRAINING_HANDLES.REGISTER_BUTTON}
                    disabled={isRegistering}
                    onClick={() => register(liveTraining.id)}
                  >
                    {t("liveTrainingView.registration.register")}
                  </Button>
                )}
              </div>
            )}
            {actions.canManageSession && (
              <div
                data-testid={LIVE_TRAINING_HANDLES.REGISTRATION_LIST}
                className="mt-1 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2"
              >
                {isError && <p role="alert">{t("common.toast.somethingWentWrong")}</p>}
                {(["registered", "waitlisted"] as const).map((status) => (
                  <div key={status}>
                    <h3 className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold text-neutral-950">
                      {t(`liveTrainingView.registration.${status}`)}
                      <span className="rounded border border-neutral-200 px-2 py-0.5 text-xs font-normal tabular-nums text-neutral-500">
                        {status === "registered"
                          ? registration.registeredCount
                          : registration.waitlistedCount}
                      </span>
                    </h3>
                    <ol className="grid max-h-64 gap-2 overflow-y-auto text-sm">
                      {members
                        ?.filter((member) => member.status === status)
                        .map((member, index) => (
                          <li
                            key={member.userId}
                            className="flex min-w-0 gap-3 rounded border border-neutral-200 px-3 py-2 text-neutral-900"
                          >
                            <span className="shrink-0 tabular-nums text-neutral-500">
                              {index + 1}.
                            </span>
                            <span className="min-w-0 break-words">{member.fullName}</span>
                          </li>
                        ))}
                    </ol>
                    {members && !members.some((member) => member.status === status) && (
                      <p className="text-sm text-neutral-500">
                        {t("liveTrainingView.registration.empty")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
