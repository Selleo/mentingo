import Viewer from "../../../components/RichText/Viever";

type NewsTextProps = {
  content: string;
};

export const NewsText = ({ content }: NewsTextProps) => {
  return <Viewer variant="news" content={content} />;
};
