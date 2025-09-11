import type { QuizQuestionOption } from "../types";

type ScaleOptionListProps = {
  options: QuizQuestionOption[];
  isCompleted: boolean;
};

export const ScaleOptionList = ({ options, isCompleted }: ScaleOptionListProps) => {
  console.log("scale options", options, isCompleted);
  return <div>ScaleOptionList</div>;
};
