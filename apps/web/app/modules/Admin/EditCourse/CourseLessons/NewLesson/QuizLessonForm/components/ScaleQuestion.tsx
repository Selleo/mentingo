import { RadioGroup } from "@radix-ui/react-radio-group";
import { useTranslation } from "react-i18next";

import { Label } from "~/components/ui/label";
import { RadioGroupItem } from "~/components/ui/radio-group";

type ScaleQuestionProps = {
  questionIndex: number;
  isAdminQuestion?: boolean;
};

const ScaleQuestion = ({ questionIndex, isAdminQuestion = false }: ScaleQuestionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="text-sm text-neutral-600">
        {t("adminQuizLessonForm.scaleQuestion.description")}
      </div>

      <RadioGroup className="grid grid-cols-5 gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
        {[1, 2, 3, 4, 5].map((scaleValue) => (
          <div key={scaleValue} className="flex flex-col items-center gap-3">
            <Label
              htmlFor={`admin-scale-${questionIndex}-${scaleValue}`}
              className="flex min-h-[60px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white p-3 transition-all hover:border-neutral-400"
            >
              <RadioGroupItem
                disabled={true}
                id={`admin-scale-${questionIndex}-${scaleValue}`}
                value={String(scaleValue)}
                className="sr-only"
              />
              <span className="text-xl font-bold">{scaleValue}</span>
            </Label>

            {/* Kontener dla tekstu z min-height dla równego wyrównania */}
            <div className="flex min-h-[32px] items-center justify-center">
              {scaleValue === 1 && (
                <span className="text-center text-xs leading-tight text-neutral-600">
                  {t("adminQuizLessonForm.scaleQuestion.stronglyDisagree")}
                </span>
              )}
              {scaleValue === 5 && (
                <span className="text-center text-xs leading-tight text-neutral-600">
                  {t("adminQuizLessonForm.scaleQuestion.stronglyAgree")}
                </span>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>

      {!isAdminQuestion && (
        <div className="text-xs italic text-neutral-500">
          {t("adminQuizLessonForm.scaleQuestion.previewNote")}
        </div>
      )}
    </div>
  );
};

export default ScaleQuestion;
