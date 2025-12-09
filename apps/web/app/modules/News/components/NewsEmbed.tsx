type NewsEmbedProps = {
  url: string;
  allowFullscreen?: boolean;
  title?: string;
};

export const NewsEmbed = ({
  url,
  allowFullscreen = true,
  title = "Embedded content",
}: NewsEmbedProps) => {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <iframe
        src={url}
        title={title}
        allowFullScreen={allowFullscreen}
        className="h-full w-full rounded-lg"
      />
    </div>
  );
};
