import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  DEFAULT_MEDIA_PLAYBACK_RATE,
  MEDIA_PLAYBACK_RATES,
  isMediaPlaybackRate,
  type MediaPlaybackRate,
} from "~/utils/mediaPlayback";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

const AUDIO_PLAYBACK_STATUS = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

type AudioPlaybackStatus = (typeof AUDIO_PLAYBACK_STATUS)[keyof typeof AUDIO_PLAYBACK_STATUS];

const formatPlaybackTime = (seconds: number) => {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");

  if (!hours) return `${minutes}:${remainingSeconds}`;

  return `${hours}:${String(minutes).padStart(2, "0")}:${remainingSeconds}`;
};

type AudioPlayerProps = {
  src: string;
  name: string;
};

export const AudioPlayer = ({ src, name }: AudioPlayerProps) => {
  const { t, i18n } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<AudioPlaybackStatus>(AUDIO_PLAYBACK_STATUS.LOADING);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<MediaPlaybackRate>(DEFAULT_MEDIA_PLAYBACK_RATE);

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
    <div className="flex min-w-0 flex-col gap-1" contentEditable={false}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Audio uploads do not include a text track. */}
      <audio
        ref={audioRef}
        key={src}
        src={src}
        aria-label={name}
        preload="metadata"
        className="hidden"
        onLoadStart={() => setStatus(AUDIO_PLAYBACK_STATUS.LOADING)}
        onWaiting={() => setStatus(AUDIO_PLAYBACK_STATUS.LOADING)}
        onLoadedMetadata={(event) => {
          syncDuration(event.currentTarget);
          setStatus(AUDIO_PLAYBACK_STATUS.READY);
        }}
        onDurationChange={(event) => syncDuration(event.currentTarget)}
        onCanPlay={() => setStatus(AUDIO_PLAYBACK_STATUS.READY)}
        onPlaying={() => setStatus(AUDIO_PLAYBACK_STATUS.READY)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
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
