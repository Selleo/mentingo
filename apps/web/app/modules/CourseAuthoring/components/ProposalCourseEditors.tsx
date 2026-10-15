/** Edits the supported course metadata and settings operation payloads. */
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ContentEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";

type Props = {
  type: string;
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
};

/** Narrows operation payload values before rendering editable fields. */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Renders only the supported course metadata and settings fields. */
export const ProposalCourseFieldsEditor = ({ type, payload, onChange }: Props) => {
  const { t } = useTranslation();
  if (type === "course.metadata.update") {
    const outcomes = Array.isArray(payload.learningOutcomes)
      ? payload.learningOutcomes.filter((item): item is string => typeof item === "string")
      : null;
    return (
      <div className="space-y-3">
        {typeof payload.description === "string" && (
          <div>
            <Label>{t("courseAuthoring.editors.courseDescription")}</Label>
            <ContentEditor
              content={payload.description}
              ariaLabel={t("courseAuthoring.editors.editCourseDescription")}
              parentClassName="mt-1 bg-white"
              contentClassName="min-h-28"
              onChange={(description) => onChange({ ...payload, description })}
            />
          </div>
        )}
        {outcomes && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("courseAuthoring.editors.learningOutcomes")}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => onChange({ ...payload, learningOutcomes: [...outcomes, ""] })}
              >
                <Plus className="size-3.5" /> {t("courseAuthoring.editors.addOutcome")}
              </Button>
            </div>
            {outcomes.map((outcome, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={outcome}
                  aria-label={t("courseAuthoring.editors.learningOutcome", { number: index + 1 })}
                  onChange={(event) =>
                    onChange({
                      ...payload,
                      learningOutcomes: outcomes.map((item, current) =>
                        current === index ? event.target.value : item,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t("courseAuthoring.editors.removeLearningOutcome")}
                  onClick={() =>
                    onChange({
                      ...payload,
                      learningOutcomes: outcomes.filter((_, current) => current !== index),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {typeof payload.thumbnailAssetId === "string" && (
          <div className="flex items-center justify-between rounded-md bg-neutral-100 p-2 text-xs text-neutral-700">
            <span>{t("courseAuthoring.editors.preparedThumbnailRetained")}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange({ ...payload, thumbnailAssetId: null })}
            >
              {t("courseAuthoring.editors.remove")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (type !== "course.settings.update") return null;
  const validity = isObject(payload.certificateValidity) ? payload.certificateValidity : null;
  const booleanSettings = [
    ["lessonSequenceEnabled", "courseAuthoring.editors.requireLessonsInSequence"],
    ["quizFeedbackEnabled", "courseAuthoring.editors.showQuizFeedback"],
    ["videoCompletionTrackingEnabled", "courseAuthoring.editors.requireVideoCompletion"],
    [
      "applyValidityToExistingCertificates",
      "courseAuthoring.editors.applyValidityToExistingCertificates",
    ],
  ] as const;

  return (
    <div className="space-y-3">
      {booleanSettings.map(
        ([field, label]) =>
          field in payload && (
            <div
              key={field}
              className="flex items-center justify-between gap-3 rounded-md bg-neutral-50 p-2 text-sm"
            >
              <span>{t(label)}</span>
              <Switch
                checked={payload[field] === true}
                onCheckedChange={(checked) => onChange({ ...payload, [field]: checked })}
              />
            </div>
          ),
      )}
      {"certificateFontColor" in payload && (
        <div>
          <Label>{t("courseAuthoring.editors.certificateFontColor")}</Label>
          <Input
            className="mt-1"
            type="color"
            value={
              typeof payload.certificateFontColor === "string"
                ? payload.certificateFontColor
                : "#000000"
            }
            onChange={(event) => onChange({ ...payload, certificateFontColor: event.target.value })}
          />
        </div>
      )}
      {"certificateValidity" in payload && (
        <div className="space-y-2 rounded-md border border-neutral-200 p-3">
          <Label>{t("courseAuthoring.editors.certificateValidity")}</Label>
          <Select
            value={
              validity?.type === "period" || validity?.type === "fixed_date"
                ? validity.type
                : "none"
            }
            onValueChange={(value) => {
              if (value === "none") onChange({ ...payload, certificateValidity: null });
              else if (value === "period")
                onChange({
                  ...payload,
                  certificateValidity: { type: "period", value: 1, unit: "years" },
                });
              else onChange({ ...payload, certificateValidity: { type: "fixed_date", date: "" } });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("courseAuthoring.editors.noExpiration")}</SelectItem>
              <SelectItem value="period">{t("courseAuthoring.editors.validForPeriod")}</SelectItem>
              <SelectItem value="fixed_date">
                {t("courseAuthoring.editors.fixedExpirationDate")}
              </SelectItem>
            </SelectContent>
          </Select>
          {validity?.type === "period" && (
            <div className="grid grid-cols-[1fr_160px] gap-2">
              <Input
                type="number"
                min={1}
                value={typeof validity.value === "number" ? validity.value : 1}
                onChange={(event) =>
                  onChange({
                    ...payload,
                    certificateValidity: { ...validity, value: Number(event.target.value) },
                  })
                }
              />
              <Select
                value={typeof validity.unit === "string" ? validity.unit : "years"}
                onValueChange={(unit) =>
                  onChange({ ...payload, certificateValidity: { ...validity, unit } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">{t("adminCourseView.settings.other.days")}</SelectItem>
                  <SelectItem value="months">
                    {t("adminCourseView.settings.other.months")}
                  </SelectItem>
                  <SelectItem value="years">{t("adminCourseView.settings.other.years")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {validity?.type === "fixed_date" && (
            <Input
              type="date"
              value={typeof validity.date === "string" ? validity.date : ""}
              onChange={(event) =>
                onChange({
                  ...payload,
                  certificateValidity: { ...validity, date: event.target.value },
                })
              }
            />
          )}
        </div>
      )}
      {typeof payload.certificateSignatureAssetId === "string" && (
        <div className="flex items-center justify-between rounded-md bg-neutral-100 p-2 text-xs text-neutral-700">
          <span>{t("courseAuthoring.editors.preparedCertificateSignatureRetained")}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange({
                ...payload,
                certificateSignatureAssetId: undefined,
                removeCertificateSignature: true,
              })
            }
          >
            {t("courseAuthoring.editors.remove")}
          </Button>
        </div>
      )}
    </div>
  );
};
