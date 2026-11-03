import { useNavigate } from "@remix-run/react";
import { CalendarClock, GraduationCap, Mail, ShieldCheck, Tag, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreatePhishingCampaign } from "~/api/mutations/useCreatePhishingCampaign";
import { usePhishingAudienceCount } from "~/api/queries/usePhishingAudienceCount";
import { usePhishingScenarios } from "~/api/queries/usePhishingScenarios";
import { PageWrapper } from "~/components/PageWrapper";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { TooltipProvider } from "~/components/ui/tooltip";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { PhishingGate } from "./PhishingGate";
import { PhishingOptionSelect } from "./PhishingOptionSelect";
import { PhishingLoading, PhishingError, PhishingEmpty, PhishingHeader } from "./PhishingStates";

import type { LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import type { ApiClient } from "~/api/api-client";
import type { Option } from "~/components/ui/multiselect";
type CampaignInput = Parameters<typeof ApiClient.api.phishingControllerCreatePhishingCampaign>[0];

function ReviewItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-6">
      <dt className="flex items-center gap-2 text-sm text-neutral-600">
        <Icon className="size-4 shrink-0 text-primary-600" aria-hidden />
        {label}
      </dt>
      <dd className="text-sm text-neutral-950">{children}</dd>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 py-6 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <h3 className="h6 text-neutral-950">{title}</h3>
        <p className="text-sm text-neutral-600">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function CreateCampaign() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    data: scenarios,
    isPending: loadingScenarios,
    isError: scenariosError,
  } = usePhishingScenarios();
  const { mutateAsync: create, isPending } = useCreatePhishingCampaign();
  const [review, setReview] = useState<CampaignInput | null>(null),
    [scheduled, setScheduled] = useState(false),
    [error, setError] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<Option[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Option[]>([]);
  const {
    data: audienceCount,
    isPending: countingAudience,
    isError: audienceError,
    refetch: recountAudience,
  } = usePhishingAudienceCount(review);
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
      scenarioId: selectedScenario[0]?.value ?? "",
      courseId: selectedCourse[0]?.value ?? "",
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
    if (!input.scenarioId) {
      setError(t("phishing.invalidCampaign"));
      return;
    }
    if (!input.courseId) {
      setError(t("phishing.invalidCourse"));
      return;
    }
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
  async function launch() {
    if (!review) return;
    try {
      await create(review);
      navigate("/phishing");
    } catch {
      /* Mutation hook displays the translated error. */
    }
  }
  if (loadingScenarios) return <PhishingLoading />;
  if (scenariosError) return <PhishingError />;
  if (!scenarios?.length) return <PhishingEmpty message={t("phishing.noOptions")} />;
  return (
    <div className="flex flex-col gap-y-6">
      <PhishingHeader title={t("phishing.newCampaign")} description={t("phishing.description")} />
      <Card className="rounded-xl shadow-sm" hidden={!!review}>
        <form onSubmit={prepare} hidden={!!review}>
          <CardContent className="divide-y divide-neutral-200 p-6">
            <FormSection
              title={t("phishing.details")}
              description={t("phishing.detailsDescription")}
            >
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="name">{t("phishing.name")}</Label>
                <Input id="name" name="name" required maxLength={150} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="scenarioId">{t("phishing.scenario")}</Label>
                <PhishingOptionSelect
                  id="scenarioId"
                  label={t("phishing.scenario")}
                  options={scenarios.map((scenario) => ({
                    value: scenario.id,
                    label: `${scenario.name} - ${scenario.description}`,
                  }))}
                  value={selectedScenario}
                  onChange={setSelectedScenario}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="courseId">{t("phishing.course")}</Label>
                <PhishingOptionSelect
                  id="courseId"
                  label={t("phishing.course")}
                  kind="courses"
                  describedBy="courseHelp"
                  value={selectedCourse}
                  onChange={setSelectedCourse}
                />
                <p id="courseHelp" className="text-xs text-neutral-500">
                  {t("phishing.courseHelp")}
                </p>
              </div>
            </FormSection>
            <FormSection title={t("phishing.audience")} description={t("phishing.selectionHelp")}>
              <div className="flex flex-col gap-2">
                <Label asChild>
                  <span>{t("phishing.people")}</span>
                </Label>
                <PhishingOptionSelect
                  id="audienceUsers"
                  label={t("phishing.people")}
                  kind="users"
                  value={selectedUsers}
                  onChange={setSelectedUsers}
                  multiple
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label asChild>
                  <span>{t("phishing.groups")}</span>
                </Label>
                <PhishingOptionSelect
                  id="audienceGroups"
                  label={t("phishing.groups")}
                  kind="groups"
                  value={selectedGroups}
                  onChange={setSelectedGroups}
                  multiple
                />
              </div>
            </FormSection>
            <FormSection
              title={t("phishing.sending")}
              description={t("phishing.sendingDescription")}
            >
              <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 md:col-span-2">
                <Label htmlFor="scheduled" className="cursor-pointer">
                  {t("phishing.schedule")}
                </Label>
                <Switch
                  id="scheduled"
                  checked={scheduled}
                  onCheckedChange={(checked) => setScheduled(checked)}
                />
              </div>
              {scheduled && (
                <TooltipProvider delayDuration={0}>
                  <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
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
            </FormSection>
          </CardContent>
          <div className="flex flex-col gap-4 rounded-b-xl border-t border-neutral-200 bg-neutral-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <Button type="submit" className="min-w-28 self-end sm:self-auto">
              {t("phishing.review")}
            </Button>
          </div>
        </form>
      </Card>
      {review && (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="mb-2 flex flex-col gap-1">
              <h3 className="h6 text-neutral-950">{t("phishing.review")}</h3>
              <p className="text-sm text-neutral-600">{t("phishing.reviewDescription")}</p>
            </div>
            <dl className="flex flex-col divide-y divide-neutral-100">
              <ReviewItem icon={Tag} label={t("phishing.name")}>
                <span className="break-words font-medium">{review.name}</span>
              </ReviewItem>
              <ReviewItem icon={Mail} label={t("phishing.scenario")}>
                {scenarios?.find((s) => s.id === review.scenarioId)?.name}
              </ReviewItem>
              <ReviewItem icon={GraduationCap} label={t("phishing.course")}>
                {selectedCourse[0]?.label}
              </ReviewItem>
              <ReviewItem icon={Users} label={t("phishing.audience")}>
                {countingAudience && t("phishing.loading")}
                {audienceError && (
                  <Button type="button" variant="outline" onClick={() => void recountAudience()}>
                    {t("phishing.retry")}
                  </Button>
                )}
                {audienceCount !== undefined && (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {t("phishing.audienceCount", { count: audienceCount })}
                    </span>
                    <span className="text-neutral-600">{t("phishing.audienceRecheck")}</span>
                  </div>
                )}
              </ReviewItem>
              <ReviewItem icon={CalendarClock} label={t("phishing.columns.sendWindow")}>
                {formatLocalizedDate(i18n.language, review.sendWindow.start)}
                {review.sendWindow.end !== review.sendWindow.start &&
                  ` – ${formatLocalizedDate(i18n.language, review.sendWindow.end)}`}
              </ReviewItem>
            </dl>
          </CardContent>
          <div className="flex flex-col gap-4 rounded-b-xl border-t border-neutral-200 bg-neutral-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-neutral-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden />
              {t("phishing.authorization")}
            </p>
            <div className="flex shrink-0 gap-3 self-end sm:self-auto">
              <Button variant="outline" disabled={isPending} onClick={() => setReview(null)}>
                {t("phishing.edit")}
              </Button>
              <Button
                onClick={() => void launch()}
                disabled={isPending || countingAudience || audienceError || !audienceCount}
                className="min-w-28"
              >
                {isPending ? t("phishing.loading") : t("phishing.launch")}
              </Button>
            </div>
          </div>
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
