import { useState } from "react";

import { AudioPlayer } from "./AudioPlayer";
import { useAudioCoverageTracker } from "./useAudioCoverageTracker";

import type { VideoCoverageTrackingOptions } from "~/components/VideoPlayer/videoCoverage.types";

type TrackedAudioPlayerProps = {
  src: string;
  name: string;
  resourceEntityId: string;
  coverageTracking: VideoCoverageTrackingOptions;
};

export const TrackedAudioPlayer = ({
  src,
  name,
  resourceEntityId,
  coverageTracking,
}: TrackedAudioPlayerProps) => {
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const { snapshot, resumeTimeSeconds } = useAudioCoverageTracker(audioElement, {
    ...coverageTracking,
    resourceEntityId,
  });

  return (
    <AudioPlayer
      src={src}
      name={name}
      onAudioElementChange={setAudioElement}
      coverage={{
        resourceEntityId,
        showCoverageMarkers: Boolean(coverageTracking.showCoverageMarkers),
        listenedRanges: snapshot.watchedRanges,
        durationSeconds: snapshot.durationSeconds,
        resumeTimeSeconds,
        onAudioActivated: coverageTracking.onVideoActivated,
      }}
    />
  );
};
