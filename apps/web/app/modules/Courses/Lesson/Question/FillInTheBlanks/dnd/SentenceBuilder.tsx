import { type FC, Fragment } from "react";

import Viewer from "~/components/RichText/Viever";

type FillInTheDndBlanksProps = {
  content: string;
  replacement: (index: number) => JSX.Element;
};

export const SentenceBuilder: FC<FillInTheDndBlanksProps> = ({ content, replacement }) => {
  const text = content.replace(/<\/?p\b[^>]*>/gi, "");
  const parts = text.split(/\[word]/g);

  return (
    <div className="body-base flex flex-wrap items-center gap-y-2 text-neutral-900">
      {parts?.map((part, index) => (
        <Fragment key={index}>
          <Viewer content={part} />
          {index < parts.length - 1 && replacement(index)}
        </Fragment>
      ))}
    </div>
  );
};
