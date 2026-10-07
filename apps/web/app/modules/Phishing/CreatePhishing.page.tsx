import { Link, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreatePhishingCampaign } from "~/api/mutations/useCreatePhishingCampaign";
import { usePhishingOptions } from "~/api/queries/usePhishingOptions";
import { usePhishingScenarios } from "~/api/queries/usePhishingScenarios";
import { PageWrapper } from "~/components/PageWrapper";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import MultipleSelector, { type Option } from "~/components/ui/multiselect";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "~/components/ui/select";

import { PhishingGate } from "./PhishingGate";
import { PhishingLoading, PhishingError, PhishingEmpty } from "./PhishingStates";

import type { FormEvent } from "react";
import type { ApiClient } from "~/api/api-client";
type CampaignInput = Parameters<typeof ApiClient.api.phishingControllerCreatePhishingCampaign>[0];
function CreateCampaign() {
  const { t, i18n } = useTranslation();
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
  const [selectedUsers, setSelectedUsers] = useState<Option[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Option[]>([]);
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
      userIds: selectedUsers.map(({ value }) => value),
      groupIds: selectedGroups.map(({ value }) => value),
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
        <PhishingLoading />
      </PageWrapper>
    );
  if (optionsError || scenariosError)
    return (
      <PageWrapper>
        <PhishingError />
        <Button variant="ghost" asChild>
          <Link to="/phishing">{t("phishing.back")}</Link>
        </Button>
      </PageWrapper>
    );
  if (!scenarios?.length || !options?.courses.length)
    return (
      <PageWrapper>
        <Button variant="ghost" asChild>
          <Link to="/phishing">{t("phishing.back")}</Link>
        </Button>
        <PhishingEmpty message={t("phishing.noOptions")} />
      </PageWrapper>
    );
  return (
    <PageWrapper>
      <Button variant="ghost" asChild>
        <Link to="/phishing">{t("phishing.back")}</Link>
      </Button>
      <h1 className="h4 my-6">{t("phishing.newCampaign")}</h1>
      <Card className="max-w-3xl" hidden={!!review}>
        <CardContent className="pt-6">
          <form onSubmit={prepare} className="space-y-6" hidden={!!review}>
            <div className="space-y-2">
              <Label htmlFor="name">{t("phishing.name")}</Label>
              <Input id="name" name="name" required maxLength={150} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenarioId">{t("phishing.scenario")}</Label>
              <Select name="scenarioId" required>
                <SelectTrigger id="scenarioId" aria-describedby="scenarioLanguage">
                  <SelectValue placeholder={t("phishing.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {scenarios?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="scenarioLanguage" className="text-sm text-muted-foreground">
                {t("phishing.scenarioLanguage")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseId">{t("phishing.course")}</Label>
              <Select name="courseId" required>
                <SelectTrigger id="courseId">
                  <SelectValue placeholder={t("phishing.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {options?.courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label asChild>
                <span>{t("phishing.people")}</span>
              </Label>
              <MultipleSelector
                value={selectedUsers}
                onChange={setSelectedUsers}
                options={options?.users.map((u) => ({ value: u.id, label: u.label }))}
                placeholder={t("phishing.choose")}
                commandProps={{ label: t("phishing.people") }}
                inputProps={{ "aria-label": t("phishing.people") }}
                emptyIndicator={t("phishing.noOptions")}
                checkbox={false}
                getRemoveLabel={(option) => t("phishing.removeSelection", { label: option.label })}
                hideClearAllButton
              />
            </div>
            <div className="space-y-2">
              <Label asChild>
                <span>{t("phishing.groups")}</span>
              </Label>
              <MultipleSelector
                value={selectedGroups}
                onChange={setSelectedGroups}
                options={options?.groups.map((g) => ({ value: g.id, label: g.label }))}
                placeholder={t("phishing.choose")}
                commandProps={{ label: t("phishing.groups") }}
                inputProps={{ "aria-label": t("phishing.groups") }}
                emptyIndicator={t("phishing.noOptions")}
                checkbox={false}
                getRemoveLabel={(option) => t("phishing.removeSelection", { label: option.label })}
                hideClearAllButton
              />
              <p className="text-sm">{t("phishing.selectionHelp")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="scheduled"
                checked={scheduled}
                onCheckedChange={(checked) => setScheduled(checked === true)}
              />
              <Label htmlFor="scheduled">{t("phishing.schedule")}</Label>
            </div>
            {scheduled && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start">{t("phishing.start")}</Label>
                  <Input id="start" name="start" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">{t("phishing.end")}</Label>
                  <Input id="end" name="end" type="datetime-local" required />
                </div>
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit">{t("phishing.review")}</Button>
          </form>
        </CardContent>
      </Card>
      {review && (
        <Card className="max-w-3xl">
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-xl font-medium">{review.name}</h2>
            <p>{scenarios?.find((s) => s.id === review.scenarioId)?.name}</p>
            <p>
              {t("phishing.course")}:{" "}
              {options?.courses.find((c) => c.id === review.courseId)?.label}
            </p>
            <p>
              {t("phishing.reviewAudience", {
                people: audienceCount,
                groups: review.groupIds.length,
              })}
            </p>
            <p>
              {new Date(review.sendWindow.start).toLocaleString(i18n.language)} –{" "}
              {new Date(review.sendWindow.end).toLocaleString(i18n.language)}
            </p>
            <p>{t("phishing.authorization")}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void launch()} disabled={isPending}>
                {isPending ? t("phishing.loading") : t("phishing.launch")}
              </Button>
              <Button variant="outline" disabled={isPending} onClick={() => setReview(null)}>
                {t("phishing.edit")}
              </Button>
            </div>
          </CardContent>
        </Card>
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
