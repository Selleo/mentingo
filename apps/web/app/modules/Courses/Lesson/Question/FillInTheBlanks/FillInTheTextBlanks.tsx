import { BlankAnswerSentence } from "./BlankAnswerSentence";

type FillInTheTextBlanksProps = {
  content: string;
  replacement: (index: number, answerId?: string) => JSX.Element;
};

export const FillInTheTextBlanks = ({ content, replacement }: FillInTheTextBlanksProps) => {
  return <BlankAnswerSentence content={content} replacement={replacement} />;
};
