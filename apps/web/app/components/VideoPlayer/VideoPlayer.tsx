import type { VideoPlayerProps } from "./VideoPlayer.types";

export const VideoPlayer = ({ url }: VideoPlayerProps) => {
  if (!url) throw new Error("Something went wrong");

  // refreshing url with token and ttl

  return (
    <div className="relative aspect-video w-full">
      <iframe
        title="Video Player"
        src={url}
        loading="lazy"
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};
