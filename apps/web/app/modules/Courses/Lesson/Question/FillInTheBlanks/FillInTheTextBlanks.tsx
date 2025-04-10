import { type FC, Fragment } from "react";

import Viewer from "~/components/RichText/Viever";

type FillInTheTextBlanksProps = {
  content: string;
  replacement: (index: number) => JSX.Element;
};

export const FillInTheTextBlanks: FC<FillInTheTextBlanksProps> = ({ content, replacement }) => {
  const parts = content.split(/\[word]/g);

  return (
    <div className="body-base flex flex-wrap items-center text-neutral-900">
      {parts.map((part, index) => (
        <Fragment key={index}>
          <Viewer content={part} />
          {index < parts.length - 1 && replacement(index)}
        </Fragment>
      ))}
    </div>
  );
};
