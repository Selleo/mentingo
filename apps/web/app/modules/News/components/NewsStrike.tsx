type NewsStrikeProps = {
  text: string;
};

export const NewsStrike = ({ text }: NewsStrikeProps) => {
  return <p className="text-base leading-7 text-neutral-700 line-through">{text}</p>;
};
