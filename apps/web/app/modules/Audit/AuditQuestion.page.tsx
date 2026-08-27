import { Link, Navigate, useParams } from "@remix-run/react";
import {
  AUDIT_DEFINITIONS,
  AUDIT_TYPES,
  isAuditType,
  type AuditAnswer,
  type AuditType,
} from "@repo/shared";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSubmitAudit } from "~/api/mutations/useSubmitAudit";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useLatestAudit } from "~/api/queries/useLatestAudit";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.audit");

export default function AuditQuestionPage() {
  const { type } = useParams();
  const { data: currentUser } = useCurrentUser();

  if (!isAuditType(type)) return <Navigate to="/audit" replace />;
  if (type === AUDIT_TYPES.SCHOOL && currentUser?.isManagingTenant && !currentUser.isSupportMode) {
    return <Navigate to="/audit" replace />;
  }

  return <AuditQuestionContent type={type} />;
}

const AuditQuestionContent = ({ type }: { type: AuditType }) => {
  const { t } = useTranslation();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedResult, setCompletedResult] = useState<{ id: string; score: number } | null>(
    null,
  );
  const definition = AUDIT_DEFINITIONS[type];
  const question = definition.questions[questionIndex];
  const selectedOptionId = answers[question.id] ?? "";
  const { data: latestAudit } = useLatestAudit(type);
  const { mutateAsync: submitAudit, isPending } = useSubmitAudit(type);
  const isSchoolAudit = type === AUDIT_TYPES.SCHOOL;
  const titleKey = isSchoolAudit ? "auditView.school.title" : "auditView.individual.title";
  const isLastQuestion = questionIndex === definition.questions.length - 1;
  let continueLabel = t("common.button.next");
  if (isLastQuestion) continueLabel = t("auditView.question.submit");
  if (isPending) continueLabel = t("auditView.question.saving");

  const handleContinue = async () => {
    if (!selectedOptionId) return;
    if (!isLastQuestion) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    const submittedAnswers: AuditAnswer[] = definition.questions.map((item) => ({
      questionId: item.id,
      optionId: answers[item.id],
    }));
    const result = await submitAudit({
      definitionVersion: definition.version,
      answers: submittedAnswers,
    });
    setCompletedResult({ id: result.id, score: result.score });
  };

  if (completedResult) {
    return (
      <PageWrapper>
        <Card className="mx-auto max-w-2xl border-neutral-200 p-8 text-center shadow-none md:p-12">
          <CheckCircle2 className="mx-auto size-12 text-success-600" aria-hidden="true" />
          <h1 className="mt-5 h3 text-neutral-950">{t("auditView.complete.title")}</h1>
          <p className="mt-3 body-lg text-neutral-700">{t("auditView.complete.description")}</p>
          <div className="mt-6 text-5xl font-semibold text-neutral-950">
            {completedResult.score}%
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="outline" asChild>
              <Link to="/audit">{t("auditView.complete.back")}</Link>
            </Button>
            <Button asChild>
              <Link to={`/audit/results/${type}/${completedResult.id}`}>
                {t("auditView.result.title")}
              </Link>
            </Button>
            {isSchoolAudit && (
              <Button variant="secondary" asChild>
                <Link to="/benchmark">{t("auditView.complete.benchmark")}</Link>
              </Button>
            )}
          </div>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("auditView.title"), href: "/audit" },
        { title: t(titleKey), href: `/audit/${type}` },
      ]}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="h3 text-neutral-950">{t(titleKey)}</h1>
          <p className="mt-2 body-base text-neutral-700">
            {latestAudit
              ? t("auditView.question.previousScore", { score: latestAudit.score })
              : t("auditView.question.firstAttempt")}
          </p>
        </div>
        <Card className="border-neutral-200 p-6 shadow-none md:p-8">
          <div className="mb-7">
            <div className="flex items-center justify-between gap-4">
              <p className="details uppercase text-primary-700">
                {t("auditView.question.number", {
                  current: questionIndex + 1,
                  total: definition.questions.length,
                })}
              </p>
              <span className="body-sm text-neutral-500">
                {Math.round(((questionIndex + 1) / definition.questions.length) * 100)}%
              </span>
            </div>
            <Progress
              value={((questionIndex + 1) / definition.questions.length) * 100}
              className="mt-3 h-2"
            />
          </div>
          <h2 className="h5 text-neutral-950">{t(`auditView.questions.${question.id}.title`)}</h2>
          <RadioGroup
            value={selectedOptionId}
            onValueChange={(optionId) =>
              setAnswers((current) => ({ ...current, [question.id]: optionId }))
            }
            className="mt-6 gap-3"
          >
            {question.options.map((option) => {
              const optionId = `${question.id}-${option.id}`;
              return (
                <Label
                  key={option.id}
                  htmlFor={optionId}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 p-4 body-base text-neutral-900 transition-colors hover:bg-neutral-50 has-[[data-state=checked]]:border-primary-700 has-[[data-state=checked]]:bg-primary-50"
                >
                  <RadioGroupItem id={optionId} value={option.id} />
                  {t(`auditView.scale.${option.id}`)}
                </Label>
              );
            })}
          </RadioGroup>
          <div className="mt-8 flex items-center justify-between gap-3">
            {questionIndex === 0 ? (
              <Button variant="ghost" asChild>
                <Link to="/audit">
                  <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                  {t("common.button.back")}
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setQuestionIndex((current) => current - 1)}>
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                {t("common.button.back")}
              </Button>
            )}
            <Button disabled={!selectedOptionId || isPending} onClick={() => void handleContinue()}>
              {continueLabel}
              {!isLastQuestion && <ArrowRight className="ml-2 size-4" aria-hidden="true" />}
            </Button>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};
