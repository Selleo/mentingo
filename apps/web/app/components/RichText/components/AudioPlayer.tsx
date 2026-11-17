import { clamp } from "lodash-es";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import {
  DEFAULT_MEDIA_PLAYBACK_RATE,
  MEDIA_PLAYBACK_RATES,
  isMediaPlaybackRate,
  type MediaPlaybackRate,
} from "~/utils/mediaPlayback";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import type { VideoCoverageRange } from "@repo/shared";

const AUDIO_PLAYBACK_STATUS = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

type AudioPlaybackStatus = (typeof AUDIO_PLAYBACK_STATUS)[keyof typeof AUDIO_PLAYBACK_STATUS];

const AUDIO_PAUSE_EVENT = "mentingo:lesson-audios-pause";
const AUDIO_RESUME_EVENT = "mentingo:lesson-audio-resume";
const AUDIO_RESUME_END_OFFSET_SECONDS = 0.5;

type ResumeAudioEvent = CustomEvent<{ resourceEntityId: string }>;

export const pauseAllLessonAudios = () => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(AUDIO_PAUSE_EVENT));
};

export const resumeLessonAudio = (resourceEntityId: string) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ResumeAudioEvent["detail"]>(AUDIO_RESUME_EVENT, {
      detail: { resourceEntityId },
    }),
  );
};

const getListenedRangeStyle = (start: number, end: number, durationSeconds: number) => {
  const left = clamp((start / durationSeconds) * 100, 0, 100);
  const width = clamp(((end - start) / durationSeconds) * 100, 0, 100 - left);

  return { left: `${left}%`, width: `${width}%` };
};

const formatPlaybackTime = (seconds: number) => {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");

  if (!hours) return `${minutes}:${remainingSeconds}`;

  return `${hours}:${String(minutes).padStart(2, "0")}:${remainingSeconds}`;
};

export type AudioPlayerCoverage = {
  resourceEntityId: string;
  showCoverageMarkers: boolean;
  listenedRanges: VideoCoverageRange[];
  durationSeconds: number | null;
  resumeTimeSeconds: number;
  onAudioActivated?: (resourceEntityId: string) => void;
};

type AudioPlayerProps = {
  src: string;
  name: string;
  coverage?: AudioPlayerCoverage;
  onAudioElementChange?: (audio: HTMLAudioElement | null) => void;
};

export const AudioPlayer = ({ src, name, coverage, onAudioElementChange }: AudioPlayerProps) => {
  const { t, i18n } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resumeAppliedRef = useRef(false);
  const [status, setStatus] = useState<AudioPlaybackStatus>(AUDIO_PLAYBACK_STATUS.LOADING);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<MediaPlaybackRate>(DEFAULT_MEDIA_PLAYBACK_RATE);

  const coverageResourceEntityId = coverage?.resourceEntityId;
  const coverageDurationSeconds = duration || coverage?.durationSeconds || 0;
  const shouldShowCoverageMarkers = Boolean(
    coverage?.showCoverageMarkers && coverageDurationSeconds > 0,
  );

  const attachAudioElement = useCallback(
    (element: HTMLAudioElement | null) => {
      audioRef.current = element;
      resumeAppliedRef.current = false;
      onAudioElementChange?.(element);
    },
    [onAudioElementChange],
  );

  useEffect(() => {
    const handlePause = () => audioRef.current?.pause();
    const handleResume = (event: Event) => {
      const { resourceEntityId } = (event as ResumeAudioEvent).detail;
      if (!coverageResourceEntityId || resourceEntityId !== coverageResourceEntityId) return;

      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      audioRef.current?.play().catch(() => setStatus(AUDIO_PLAYBACK_STATUS.ERROR));
    };

    window.addEventListener(AUDIO_PAUSE_EVENT, handlePause);
    window.addEventListener(AUDIO_RESUME_EVENT, handleResume);

    return () => {
      window.removeEventListener(AUDIO_PAUSE_EVENT, handlePause);
      window.removeEventListener(AUDIO_RESUME_EVENT, handleResume);
    };
  }, [coverageResourceEntityId]);

  const applyListenedResumeTime = (audio: HTMLAudioElement) => {
    if (!coverage || resumeAppliedRef.current) return;

    resumeAppliedRef.current = true;
    const resumeTimeSeconds =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.min(
            coverage.resumeTimeSeconds,
            Math.max(0, audio.duration - AUDIO_RESUME_END_OFFSET_SECONDS),
          )
        : coverage.resumeTimeSeconds;

    if (resumeTimeSeconds <= 0) return;

    audio.currentTime = resumeTimeSeconds;
    setCurrentTime(resumeTimeSeconds);
  };

  const markAudioActivated = () => {
    if (coverageResourceEntityId) coverage?.onAudioActivated?.(coverageResourceEntityId);
  };

  const isReady = status === AUDIO_PLAYBACK_STATUS.READY;
  const playbackLabel = isPlaying ? t("richText.audio.pause") : t("richText.audio.play");

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    audio.play().catch(() => setStatus(AUDIO_PLAYBACK_STATUS.ERROR));
  };

  const seekTo = (time: number) => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const changeVolume = (nextVolume: number) => {
    if (!audioRef.current) return;

    audioRef.current.volume = nextVolume;
    audioRef.current.muted = nextVolume === 0;
  };

  const changePlaybackRate = (nextRate: number) => {
    if (!audioRef.current || !isMediaPlaybackRate(nextRate)) return;

    audioRef.current.defaultPlaybackRate = nextRate;
    audioRef.current.playbackRate = nextRate;
  };

  const formatPlaybackRate = (rate: number) => `${rate.toLocaleString(i18n.language)}×`;

  const toggleMuted = () => {
    if (!audioRef.current) return;

    audioRef.current.muted = !audioRef.current.muted;
  };

  const syncDuration = (audio: HTMLAudioElement) =>
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);

  return (
    <div ref={containerRef} className="flex min-w-0 flex-col gap-1" contentEditable={false}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Audio uploads do not include a text track. */}
      <audio
        ref={attachAudioElement}
        key={src}
        src={src}
        aria-label={name}
        preload="metadata"
        className="hidden"
        onLoadStart={() => setStatus(AUDIO_PLAYBACK_STATUS.LOADING)}
        onWaiting={() => setStatus(AUDIO_PLAYBACK_STATUS.LOADING)}
        onLoadedMetadata={(event) => {
          syncDuration(event.currentTarget);
          applyListenedResumeTime(event.currentTarget);
          setStatus(AUDIO_PLAYBACK_STATUS.READY);
        }}
        onDurationChange={(event) => syncDuration(event.currentTarget)}
        onCanPlay={() => setStatus(AUDIO_PLAYBACK_STATUS.READY)}
        onPlaying={() => setStatus(AUDIO_PLAYBACK_STATUS.READY)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setIsPlaying(true);
          markAudioActivated();
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onRateChange={(event) => {
          const { playbackRate: nextRate } = event.currentTarget;
          if (isMediaPlaybackRate(nextRate)) setPlaybackRate(nextRate);
        }}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setIsMuted(event.currentTarget.muted);
        }}
        onError={() => {
          setIsPlaying(false);
          setStatus(AUDIO_PLAYBACK_STATUS.ERROR);
        }}
      />
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="size-7 shrink-0 rounded-full text-neutral-700 hover:bg-neutral-200"
          aria-label={playbackLabel}
          title={playbackLabel}
          data-testid={RICH_TEXT_HANDLES.AUDIO_PLAY_BUTTON}
          disabled={status === AUDIO_PLAYBACK_STATUS.ERROR}
          onClick={togglePlayback}
        >
          {isPlaying ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
        </Button>
        <span className="shrink-0 text-xs tabular-nums text-neutral-600">
          {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
        </span>
        {shouldShowCoverageMarkers ? (
          <div className="relative flex h-3 min-w-0 flex-1 items-center">
            <div
              className="pointer-events-none absolute inset-x-1.5 h-1 rounded-full bg-neutral-200"
              data-testid={RICH_TEXT_HANDLES.AUDIO_COVERAGE_MARKERS}
              aria-hidden
            >
              {coverage?.listenedRanges.map(([start, end]) => (
                <span
                  key={`${start}-${end}`}
                  className="absolute inset-y-0 bg-primary-300"
                  style={getListenedRangeStyle(start, end, coverageDurationSeconds)}
                />
              ))}
              <span
                className="absolute inset-y-0 bg-primary-700"
                style={getListenedRangeStyle(0, currentTime, coverageDurationSeconds)}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              aria-label={t("richText.audio.seek")}
              aria-valuetext={`${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)}`}
              disabled={!isReady && !duration}
              onChange={(event) => seekTo(Number(event.target.value))}
              className={cn(
                "relative h-3 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default",
                "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent",
                "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-700",
                "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary-700",
              )}
            />
          </div>
        ) : (
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            aria-label={t("richText.audio.seek")}
            aria-valuetext={`${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)}`}
            disabled={!isReady && !duration}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-primary-700 disabled:cursor-default"
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-7 shrink-0 rounded-full px-2 text-xs tabular-nums text-neutral-700 hover:bg-neutral-200"
              aria-label={t("richText.audio.playbackSpeed")}
              title={t("richText.audio.playbackSpeed")}
              data-testid={RICH_TEXT_HANDLES.AUDIO_PLAYBACK_SPEED_BUTTON}
            >
              {formatPlaybackRate(playbackRate)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-20">
            <DropdownMenuRadioGroup
              value={String(playbackRate)}
              onValueChange={(value) => changePlaybackRate(Number(value))}
            >
              {MEDIA_PLAYBACK_RATES.map((rate) => (
                <DropdownMenuRadioItem
                  key={rate}
                  value={String(rate)}
                  className="pl-2 tabular-nums data-[state=checked]:bg-primary-50 data-[state=checked]:text-primary-800 [&>span:first-child]:hidden"
                >
                  {formatPlaybackRate(rate)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="size-7 shrink-0 rounded-full text-neutral-700 hover:bg-neutral-200"
          aria-label={isMuted ? t("richText.audio.unmute") : t("richText.audio.mute")}
          title={isMuted ? t("richText.audio.unmute") : t("richText.audio.mute")}
          onClick={toggleMuted}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="size-4" aria-hidden />
          ) : (
            <Volume2 className="size-4" aria-hidden />
          )}
        </Button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          aria-label={t("richText.audio.volume")}
          onChange={(event) => changeVolume(Number(event.target.value))}
          className="hidden h-1 w-20 shrink-0 cursor-pointer accent-primary-700 sm:block"
        />
      </div>
      {status === AUDIO_PLAYBACK_STATUS.LOADING && (
        <p role="status" className="m-0 text-xs text-neutral-600">
          {t("richText.audio.loading")}
        </p>
      )}
      {status === AUDIO_PLAYBACK_STATUS.ERROR && (
        <p role="alert" className="m-0 text-xs text-error-600">
          {t("richText.audio.error")}
        </p>
      )}
    </div>
  );
};
