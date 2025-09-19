import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type ScaleQuestionProps = {
  form?: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
};
// form, questionIndex
const ScaleQuestion = ({ questionIndex }: ScaleQuestionProps) => {
  return (
    <div>
      <RadioGroup
        defaultValue="1"
        name="example"
        className="flex w-full min-w-0 flex-row justify-between overflow-hidden bg-red-100 py-8"
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index + questionIndex}
            className="flex flex-shrink-0 flex-col items-center gap-6 px-4"
          >
            <Label className="text-sm font-medium">{index + 1}</Label>
            <RadioGroupItem disabled={true} value={String(index + 1)} />
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default ScaleQuestion;
