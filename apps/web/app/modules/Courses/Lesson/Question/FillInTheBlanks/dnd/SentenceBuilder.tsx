import { BlankAnswerSentence } from "../BlankAnswerSentence";

type FillInTheDndBlanksProps = {
  content: string;
  replacement: (index: number, answerId?: string) => JSX.Element;
};

export const SentenceBuilder = ({ content, replacement }: FillInTheDndBlanksProps) => {
  return <BlankAnswerSentence content={content} replacement={replacement} />;
};
