type NewsHeadingProps = {
  text: string;
  level?: 2 | 3 | 4;
};

export const NewsHeading = ({ text, level = 3 }: NewsHeadingProps) => {
  const Tag = `h${level}` as unknown as keyof JSX.IntrinsicElements;

  return <Tag className="font-gothic font-bold text-2xl text-neutral-900">{text}</Tag>;
};
