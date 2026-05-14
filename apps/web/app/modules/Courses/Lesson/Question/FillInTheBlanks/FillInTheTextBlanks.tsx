import { type FC, Fragment } from "react";

import Viewer from "~/components/RichText/Viever";
import { splitByBlankAnswerMarkers } from "~/utils/blankAnswerMarkers";

type FillInTheTextBlanksProps = {
  content: string;
  replacement: (index: number, answerId?: string) => JSX.Element;
};

export const FillInTheTextBlanks: FC<FillInTheTextBlanksProps> = ({ content, replacement }) => {
  const parts = splitByBlankAnswerMarkers(content);

  return (
    <div className="body-base flex flex-wrap items-center text-neutral-900">
      {parts.map((part, index) => (
        <Fragment key={index}>
          <Viewer content={part.text} />
          {part.answerId && replacement(index, part.answerId)}
        </Fragment>
      ))}
    </div>
  );
};
