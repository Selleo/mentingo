import { type FC, Fragment } from "react";

import Viewer from "~/components/RichText/Viever";
import { splitByBlankAnswerMarkers } from "~/utils/blankAnswerMarkers";

type FillInTheDndBlanksProps = {
  content: string;
  replacement: (index: number, answerId?: string) => JSX.Element;
};

export const SentenceBuilder: FC<FillInTheDndBlanksProps> = ({ content, replacement }) => {
  const text = content.replace(/<\/?p\b[^>]*>/gi, "");
  const parts = splitByBlankAnswerMarkers(text);

  return (
    <div className="body-base flex flex-wrap items-center gap-y-2 text-neutral-900">
      {parts?.map((part, index) => (
        <Fragment key={index}>
          <Viewer content={part.text} />
          {part.answerId && replacement(index, part.answerId)}
        </Fragment>
      ))}
    </div>
  );
};
