import { Video } from "../../../components/VideoPlayer/Video";

type NewsVideoProps = {
  url: string;
  isExternal?: boolean;
  description?: string;
};

export const NewsVideo = ({ url, isExternal = false, description }: NewsVideoProps) => {
  return (
    <div className="flex flex-col gap-3">
      <figure className="overflow-hidden rounded-lg shadow-lg">
        <Video url={url} isExternalUrl={isExternal} />
      </figure>

      {description && (
        <p className="text-sm text-neutral-600 leading-6 text-center">{description}</p>
      )}
    </div>
  );
};
