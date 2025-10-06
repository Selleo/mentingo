import * as Accordion from "@radix-ui/react-accordion";

import { Label } from "~/components/ui/label";

type ScaleQuestionProps = {
  questionIndex: number;
};

const ScaleQuestion = ({ questionIndex }: ScaleQuestionProps) => {
  return (
    <Accordion.Item value={`item-${questionIndex}`}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((scaleValue, index) => (
            <div key={index} className="flex flex-col items-center gap-3">
              <Label
                htmlFor={`scale-${scaleValue}`}
                className={
                  "flex min-h-[70px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-4 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                }
              >
                <input
                  disabled
                  id={`scale-${scaleValue}`}
                  type="radio"
                  value={String(scaleValue)}
                  className="sr-only"
                />
                <span className="text-2xl font-bold">{index + 1}</span>
              </Label>
            </div>
          ))}
        </div>
      </div>
    </Accordion.Item>
  );
};

export default ScaleQuestion;
