import { Icon } from "~/components/Icon";

type VideoProcessingPlaceholderProps = {
  title: string;
  body: string;
};

export const VideoProcessingPlaceholder = ({ title, body }: VideoProcessingPlaceholderProps) => {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-[rgba(18,21,33,0.85)] text-center">
        <div className="flex flex-col items-center gap-y-2 px-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-neutral-900/60">
            <Icon name="UploadImageIcon" className="size-8 text-primary-400" />
          </div>
          <div className="body-sm flex flex-col gap-y-1">
            <span className="text-white">{title}</span>
            <span className="details text-neutral-200">{body}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
