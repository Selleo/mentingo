import { useNavigate } from "@remix-run/react";
import { MailWarning } from "lucide-react";
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
import { TooltipProvider } from "~/components/ui/tooltip";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { PhishingGate } from "./PhishingGate";
import { PhishingLoading, PhishingError, PhishingEmpty } from "./PhishingStates";

import type { FormEvent, ReactNode } from "react";
import type { ApiClient } from "~/api/api-client";
type CampaignInput = Parameters<typeof ApiClient.api.phishingControllerCreatePhishingCampaign>[0];

function ReviewItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className="body-base text-neutral-950">{children}</dd>
    </div>
  );
}

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
  const [sendWindow, setSendWindow] = useState({
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "17:00",
  });
  const updateSendWindow = (key: keyof typeof sendWindow) => (value: string) =>
    setSendWindow((current) => ({ ...current, [key]: value }));
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      now = new Date().toISOString();
    if (scheduled && (!sendWindow.startDate || !sendWindow.endDate)) {
      setError(t("phishing.invalidCampaign"));
      return;
    }
    const input: CampaignInput = {
      requestId,
      name: String(form.get("name")),
      scenarioId: String(form.get("scenarioId")),
      courseId: String(form.get("courseId")),
      userIds: selectedUsers.map(({ value }) => value),
      groupIds: selectedGroups.map(({ value }) => value),
      sendWindow: {
        start: scheduled
          ? new Date(`${sendWindow.startDate}T${sendWindow.startTime}`).toISOString()
          : now,
        end: scheduled
          ? new Date(`${sendWindow.endDate}T${sendWindow.endTime}`).toISOString()
          : now,
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
  if (loadingOptions || loadingScenarios) return <PhishingLoading />;
  if (optionsError || scenariosError) return <PhishingError />;
  if (!scenarios?.length || !options?.courses.length)
    return <PhishingEmpty message={t("phishing.noOptions")} />;
  return (
    <div className="flex flex-col gap-y-6">
      <div className="rounded-xl border bg-gradient-to-r from-neutral-50 to-background p-5 shadow-sm">
        <div className="flex items-center gap-2 text-neutral-900">
          <MailWarning className="size-7 text-primary-700" aria-hidden="true" />
          <h2 className="h4 text-neutral-950">{t("phishing.newCampaign")}</h2>
        </div>
        <p className="mt-2 text-sm text-neutral-600">{t("phishing.description")}</p>
      </div>
      <Card className="rounded-xl shadow-sm" hidden={!!review}>
        <CardContent className="p-5">
          <form onSubmit={prepare} hidden={!!review}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="h5 text-neutral-950">{t("phishing.details")}</h3>
              <Button type="submit" className="min-w-28">
                {t("phishing.review")}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="name">{t("phishing.name")}</Label>
                <Input id="name" name="name" required maxLength={150} />
              </div>
              <div className="flex flex-col gap-2">
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
                <p id="scenarioLanguage" className="text-sm text-neutral-600">
                  {t("phishing.scenarioLanguage")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
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
            </div>
            <section className="mt-6 border-t border-neutral-200 pt-5">
              <h4 className="h6 mb-1 text-neutral-950">{t("phishing.audience")}</h4>
              <p className="mb-4 text-sm text-neutral-600">{t("phishing.selectionHelp")}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
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
                    getRemoveLabel={(option) =>
                      t("phishing.removeSelection", { label: option.label })
                    }
                    hideClearAllButton
                  />
                </div>
                <div className="flex flex-col gap-2">
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
                    getRemoveLabel={(option) =>
                      t("phishing.removeSelection", { label: option.label })
                    }
                    hideClearAllButton
                  />
                </div>
              </div>
            </section>
            <section className="mt-6 border-t border-neutral-200 pt-5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="scheduled"
                  checked={scheduled}
                  onCheckedChange={(checked) => setScheduled(checked === true)}
                />
                <Label htmlFor="scheduled">{t("phishing.schedule")}</Label>
              </div>
              {scheduled && (
                <TooltipProvider delayDuration={0}>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <CalendarDateTimeField
                      label={t("phishing.start")}
                      tooltip={t("phishing.startTooltip")}
                      date={sendWindow.startDate}
                      time={sendWindow.startTime}
                      onDateChange={updateSendWindow("startDate")}
                      onTimeChange={updateSendWindow("startTime")}
                    />
                    <CalendarDateTimeField
                      label={t("phishing.end")}
                      tooltip={t("phishing.endTooltip")}
                      date={sendWindow.endDate}
                      time={sendWindow.endTime}
                      onDateChange={updateSendWindow("endDate")}
                      onTimeChange={updateSendWindow("endTime")}
                    />
                  </div>
                </TooltipProvider>
              )}
            </section>
            {error && (
              <Alert variant="destructive" className="mt-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
      {review && (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="h5 break-words text-neutral-950">{review.name}</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={isPending} onClick={() => setReview(null)}>
                  {t("phishing.edit")}
                </Button>
                <Button onClick={() => void launch()} disabled={isPending} className="min-w-28">
                  {isPending ? t("phishing.loading") : t("phishing.launch")}
                </Button>
              </div>
            </div>
            <dl className="grid gap-4 md:grid-cols-2">
              <ReviewItem label={t("phishing.scenario")}>
                {scenarios?.find((s) => s.id === review.scenarioId)?.name}
              </ReviewItem>
              <ReviewItem label={t("phishing.course")}>
                {options?.courses.find((c) => c.id === review.courseId)?.label}
              </ReviewItem>
              <ReviewItem label={t("phishing.audience")}>
                {t("phishing.reviewAudience", {
                  people: audienceCount,
                  groups: review.groupIds.length,
                })}
              </ReviewItem>
              <ReviewItem label={t("phishing.columns.sendWindow")}>
                {formatLocalizedDate(i18n.language, review.sendWindow.start)} –{" "}
                {formatLocalizedDate(i18n.language, review.sendWindow.end)}
              </ReviewItem>
            </dl>
            <Alert>
              <AlertDescription>{t("phishing.authorization")}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
export default function CreatePhishingPage() {
  const { t } = useTranslation();
  return (
    <PhishingGate>
      <PageWrapper
        breadcrumbs={[
          { title: t("phishing.title"), href: "/phishing" },
          { title: t("phishing.newCampaign"), href: "/phishing/new" },
        ]}
      >
        <CreateCampaign />
      </PageWrapper>
    </PhishingGate>
  );
}
