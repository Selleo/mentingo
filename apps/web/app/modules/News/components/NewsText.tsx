import Viewer from "../../../components/RichText/Viever";

type NewsTextProps = {
  content: string;
};

export const NewsText = ({ content }: NewsTextProps) => {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <Viewer variant="lesson" content={content} />
    </div>
  );
};
