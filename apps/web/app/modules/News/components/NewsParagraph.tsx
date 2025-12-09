type NewsParagraphProps = {
  text: string;
};

export const NewsParagraph = ({ text }: NewsParagraphProps) => {
  return <p className="text-base leading-7 text-neutral-800">{text}</p>;
};
