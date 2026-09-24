import { Link, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreatePhishingCampaign } from "~/api/mutations/useCreatePhishingCampaign";
import { usePhishingOptions } from "~/api/queries/usePhishingOptions";
import { usePhishingScenarios } from "~/api/queries/usePhishingScenarios";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { PhishingGate } from "./PhishingGate";

import type { FormEvent } from "react";
import type { ApiClient } from "~/api/api-client";
type CampaignInput = Parameters<typeof ApiClient.api.phishingControllerCreatePhishingCampaign>[0];
function CreateCampaign() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: options, isPending: loadingOptions, isError: optionsError } = usePhishingOptions();
  const {
    data: scenarios,
    isPending: loadingScenarios,
    isError: scenariosError,
  } = usePhishingScenarios();
  const { mutateAsync: create, isPending } = useCreatePhishingCampaign();
  const [review, setReview] = useState<CampaignInput | null>(null),
    [scheduled, setScheduled] = useState(false),
    [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      now = new Date().toISOString();
    const input: CampaignInput = {
      requestId,
      name: String(form.get("name")),
      scenarioId: String(form.get("scenarioId")),
      courseId: String(form.get("courseId")),
      userIds: form.getAll("userIds").map(String),
      groupIds: form.getAll("groupIds").map(String),
      sendWindow: {
        start: scheduled ? new Date(String(form.get("start"))).toISOString() : now,
        end: scheduled ? new Date(String(form.get("end"))).toISOString() : now,
      },
    };
    if (!input.userIds.length && !input.groupIds.length) {
      setError(t("phishing.invalidRecipients"));
      return;
    }
    if (Date.parse(input.sendWindow.end) < Date.parse(input.sendWindow.start)) {
      setError(t("phishing.invalidCampaign"));
      return;
    }
    setError("");
    setReview(input);
  }
  const audienceCount = review
    ? new Set([
        ...review.userIds,
        ...(options?.groups
          .filter((group) => review.groupIds.includes(group.id))
          .flatMap((group) => group.userIds) ?? []),
      ]).size
    : 0;
  async function launch() {
    if (!review) return;
    try {
      await create(review);
      navigate("/phishing");
    } catch {
      /* Mutation hook displays the translated error. */
    }
  }
  if (loadingOptions || loadingScenarios)
    return (
      <PageWrapper>
        <p role="status">{t("phishing.loading")}</p>
      </PageWrapper>
    );
  if (optionsError || scenariosError)
    return (
      <PageWrapper>
        <p role="alert">{t("phishing.serviceError")}</p>
        <Link to="/phishing">{t("phishing.back")}</Link>
      </PageWrapper>
    );
  return (
    <PageWrapper>
      <Link to="/phishing">{t("phishing.back")}</Link>
      <h1 className="my-6 text-2xl font-semibold">{t("phishing.newCampaign")}</h1>
      <form onSubmit={prepare} className="max-w-2xl space-y-5" hidden={!!review}>
        <div>
          <Label htmlFor="name">{t("phishing.name")}</Label>
          <Input id="name" name="name" required maxLength={150} />
        </div>
        <div>
          <Label htmlFor="scenarioId">{t("phishing.scenario")}</Label>
          <select id="scenarioId" name="scenarioId" className="w-full rounded border p-3" required>
            <option value="">{t("phishing.choose")}</option>
            {scenarios?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.description}
              </option>
            ))}
          </select>
          <p className="text-sm text-neutral-600">{t("phishing.scenarioLanguage")}</p>
        </div>
        <div>
          <Label htmlFor="courseId">{t("phishing.course")}</Label>
          <select id="courseId" name="courseId" className="w-full rounded border p-3" required>
            <option value="">{t("phishing.choose")}</option>
            {options?.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="userIds">{t("phishing.people")}</Label>
          <select id="userIds" name="userIds" multiple className="h-44 w-full rounded border p-3">
            {options?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="groupIds">{t("phishing.groups")}</Label>
          <select id="groupIds" name="groupIds" multiple className="h-32 w-full rounded border p-3">
            {options?.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="text-sm">{t("phishing.selectionHelp")}</p>
        </div>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={scheduled}
            onChange={(e) => setScheduled(e.target.checked)}
          />
          {t("phishing.schedule")}
        </label>
        {scheduled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">{t("phishing.start")}</Label>
              <Input id="start" name="start" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="end">{t("phishing.end")}</Label>
              <Input id="end" name="end" type="datetime-local" required />
            </div>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <Button type="submit">{t("phishing.review")}</Button>
      </form>
      {review && (
        <section className="max-w-2xl space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-medium">{review.name}</h2>
          <p>{scenarios?.find((s) => s.id === review.scenarioId)?.name}</p>
          <p>
            {t("phishing.course")}: {options?.courses.find((c) => c.id === review.courseId)?.label}
          </p>
          <p>
            {t("phishing.reviewAudience", {
              people: audienceCount,
              groups: review.groupIds.length,
            })}
          </p>
          <p>
            {new Date(review.sendWindow.start).toLocaleString()} –{" "}
            {new Date(review.sendWindow.end).toLocaleString()}
          </p>
          <p>{t("phishing.authorization")}</p>
          <div className="flex gap-3">
            <Button onClick={() => void launch()} disabled={isPending}>
              {isPending ? t("phishing.loading") : t("phishing.launch")}
            </Button>
            <Button variant="outline" disabled={isPending} onClick={() => setReview(null)}>
              {t("phishing.edit")}
            </Button>
          </div>
        </section>
      )}
    </PageWrapper>
  );
}
export default function CreatePhishingPage() {
  return (
    <PhishingGate>
      <CreateCampaign />
    </PhishingGate>
  );
}
