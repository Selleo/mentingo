import { type FC, Fragment } from "react";

import Viewer from "~/components/RichText/Viever";
import {
  normalizeBlankAnswerLineBreaks,
  splitByBlankAnswerMarkers,
} from "~/utils/blankAnswerMarkers";

type BlankAnswerSentenceProps = {
  content: string;
  replacement: (index: number, answerId?: string) => JSX.Element;
};

const inlineViewerClassName =
  "inline [&>div]:inline [&>div>div]:inline [&_.ProseMirror]:inline [&_.ProseMirror>p]:inline [&_.ProseMirror>p]:!m-0 [&_.ProseMirror>*]:!my-0";

export const BlankAnswerSentence: FC<BlankAnswerSentenceProps> = ({ content, replacement }) => {
  const parts = splitByBlankAnswerMarkers(normalizeBlankAnswerLineBreaks(content));

  return (
    <div className="body-base leading-9 text-neutral-900">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part.text && <Viewer content={part.text} className={inlineViewerClassName} />}
          {part.answerId && replacement(index, part.answerId)}
        </Fragment>
      ))}
    </div>
  );
};
