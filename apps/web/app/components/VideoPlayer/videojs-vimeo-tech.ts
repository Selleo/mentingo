import VimeoPlayer from "@vimeo/player";
import videojs from "video.js";

type VimeoSource = {
  src: string;
  type?: string;
};

type VimeoTechOptions = {
  poster?: string;
  source?: VimeoSource;
  autoplay?: boolean;
  height?: number;
  width?: number;
  maxheight?: number;
  maxwidth?: number;
  loop?: boolean;
  color?: string;
  techId?: string;
};

type VimeoTechBase = {
  options_: VimeoTechOptions;
  setPoster: (poster?: string) => void;
  trigger: (event: string, data?: unknown) => void;
  triggerReady: () => void;
  el: () => HTMLElement;
  dispose(): void;
};

type VimeoSourceHandler = {
  canPlayType: (source: string) => "maybe" | "";
  canHandleSource: (source: VimeoSource) => "maybe" | "";
  handleSource: (source: VimeoSource, tech: VimeoTech) => void;
  dispose: () => void;
};

type VimeoTechClass = {
  new (options: VimeoTechOptions, ready?: () => void): VimeoTechBase;
  withSourceHandlers: (tech: typeof VimeoTech) => void;
};

type VimeoTechRegistrable = {
  registerSourceHandler: (handler: VimeoSourceHandler) => void;
};

type VimeoProgress = {
  seconds: number;
  percent: number;
  duration: number;
};

type VimeoVolume = {
  volume: number;
};

type VimeoState = {
  ended: boolean;
  playing: boolean;
  muted: boolean;
  volume: number;
  progress: VimeoProgress;
};

type VimeoEventName = Parameters<VimeoPlayer["on"]>[0];

function isVimeoProgress(value: unknown): value is Partial<VimeoProgress> {
  if (!value || typeof value !== "object") return false;
  return "seconds" in value || "percent" in value || "duration" in value;
}

let cssInjected = false;

function injectCss() {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;

  const style = document.createElement("style");
  style.type = "text/css";
  style.textContent = `
    .vjs-vimeo iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  `;

  (document.head ?? document.getElementsByTagName("head")[0])?.appendChild(style);
}

function withVimeoEmbedParams(src: string) {
  try {
    const url = new URL(src);
    url.searchParams.set("controls", "0");
    url.searchParams.set("title", "0");
    url.searchParams.set("byline", "0");
    url.searchParams.set("portrait", "0");
    return url.toString();
  } catch {
    return src;
  }
}

const Tech = videojs.getTech("Tech") as unknown as VimeoTechClass;

class VimeoTech extends Tech {
  private _player!: VimeoPlayer;
  private _sourceSrc = "";
  private _lastNonZeroVolume = 1;
  private _state: VimeoState = {
    ended: false,
    playing: false,
    muted: false,
    volume: 0,
    progress: {
      seconds: 0,
      percent: 0,
      duration: 0,
    },
  };

  constructor(options: VimeoTechOptions, ready?: () => void) {
    super(options, ready);
    injectCss();
    this.setPoster(options.poster);
    this._sourceSrc = options?.source?.src ?? "";
    if (this._sourceSrc) {
      this.initVimeoPlayer();
    }
  }

  static isSupported() {
    return true;
  }

  createEl() {
    const div = videojs.dom.createEl("div", { id: this.options_.techId });
    (div as HTMLElement).style.cssText = "width:100%;height:100%;top:0;left:0;position:absolute";
    div.className = "vjs-vimeo";
    return div;
  }

  controls() {
    return false;
  }

  supportsFullScreen() {
    return true;
  }

  supportsPictureInPicture() {
    return false;
  }

  src(source?: string | VimeoSource) {
    if (source) {
      const nextSrc = typeof source === "string" ? source : source.src;
      this._sourceSrc = nextSrc;
      this.options_.source = { ...(this.options_.source ?? {}), src: nextSrc } as VimeoSource;

      if (this._player) {
        void this._player.loadVideo(withVimeoEmbedParams(nextSrc));
      } else {
        this.initVimeoPlayer();
      }
    }

    return this.options_.source;
  }

  currentSrc() {
    return this._sourceSrc;
  }

  currentTime() {
    return this._state.progress.seconds;
  }

  setCurrentTime(time: number) {
    return this._player.setCurrentTime(time);
  }

  volume() {
    return this._state.volume;
  }

  setVolume(volume: number) {
    this._state.volume = volume;
    this._state.muted = volume === 0;
    if (volume > 0) {
      this._lastNonZeroVolume = volume;
    }
    this.trigger("volumechange");
    return this._player.setVolume(volume);
  }

  duration() {
    return this._state.progress.duration;
  }

  buffered() {
    const p = this._state.progress;
    return videojs.createTimeRange(0, p.percent * p.duration);
  }

  paused() {
    return !this._state.playing;
  }

  pause() {
    return this._player.pause();
  }

  play() {
    return this._player.play();
  }

  muted() {
    return this._state.muted;
  }

  setMuted(muted: boolean) {
    this._state.muted = muted;
    this._state.volume = muted ? 0 : this._lastNonZeroVolume;
    this.trigger("volumechange");
    if (this._player) {
      return this._player.setVolume(muted ? 0 : this._lastNonZeroVolume);
    }
    return Promise.resolve();
  }

  ended() {
    return this._state.ended;
  }

  playbackRate() {
    return 1;
  }

  dispose() {
    if (this._player) {
      void this._player.destroy().catch(() => undefined);
    }
    super.dispose();
  }

  private initVimeoPlayer() {
    if (this._player || !this._sourceSrc) {
      return;
    }

    const embedUrl = withVimeoEmbedParams(this._sourceSrc);

    const vimeoOptions: Record<string, unknown> = {
      url: embedUrl,
      byline: false,
      portrait: false,
      title: false,
      controls: false,
    };

    if (this.options_.autoplay) vimeoOptions.autoplay = true;
    if (this.options_.height) vimeoOptions.height = this.options_.height;
    if (this.options_.width) vimeoOptions.width = this.options_.width;
    if (this.options_.maxheight) vimeoOptions.maxheight = this.options_.maxheight;
    if (this.options_.maxwidth) vimeoOptions.maxwidth = this.options_.maxwidth;
    if (this.options_.loop) vimeoOptions.loop = this.options_.loop;
    if (this.options_.color) vimeoOptions.color = String(this.options_.color).replace(/^#/, "");

    this._player = new VimeoPlayer(this.el(), vimeoOptions);
    this.initState();

    const trackedEvents: VimeoEventName[] = [
      "play",
      "pause",
      "ended",
      "timeupdate",
      "progress",
      "seeked",
    ];

    trackedEvents.forEach((eventName) => {
      this._player.on(eventName, (data: unknown) => {
        const progress = isVimeoProgress(data) ? data : undefined;
        if (
          typeof progress?.duration === "number" &&
          this._state.progress.duration !== progress.duration
        ) {
          this.trigger("durationchange");
        }
        this._state.progress = {
          ...this._state.progress,
          ...(progress ?? {}),
        };
        this.trigger(eventName);
      });
    });

    this._player.on("pause", () => {
      this._state.playing = false;
    });
    this._player.on("play", () => {
      this._state.playing = true;
      this._state.ended = false;
    });
    this._player.on("ended", () => {
      this._state.playing = false;
      this._state.ended = true;
    });
    this._player.on("volumechange", (v: VimeoVolume) => {
      this._state.volume = v.volume;
      this._state.muted = v.volume === 0;
      if (v.volume > 0) {
        this._lastNonZeroVolume = v.volume;
      }
      this.trigger("volumechange");
    });
    this._player.on("error", (error) => this.trigger("error", error));

    this.triggerReady();
  }

  private initState() {
    this._player.getCurrentTime().then((time) => {
      this._state.progress.seconds = time;
    });
    this._player.getDuration().then((duration) => {
      this._state.progress.duration = duration;
    });
    this._player.getPaused().then((paused) => {
      this._state.playing = !paused;
    });
    this._player.getVolume().then((volume) => {
      this._state.volume = volume;
      this._state.muted = volume === 0;
      if (volume > 0) {
        this._lastNonZeroVolume = volume;
      }
    });
  }
}

Object.assign(VimeoTech.prototype, {
  featuresTimeupdateEvents: true,
  featuresVolumeControl: true,
});
Tech.withSourceHandlers(VimeoTech);

(VimeoTech as unknown as VimeoTechRegistrable).registerSourceHandler({
  canPlayType(source: string) {
    return source === "video/vimeo" ? "maybe" : "";
  },
  canHandleSource(source: VimeoSource) {
    if (source.type) return source.type === "video/vimeo" ? "maybe" : "";
    if (source.src) return /vimeo\.com/.test(source.src) ? "maybe" : "";
    return "";
  },
  handleSource(source: VimeoSource, tech: VimeoTech) {
    tech.src(source);
  },
  dispose() {},
});

if (!videojs.getTech("Vimeo")) {
  videojs.registerTech("Vimeo", VimeoTech);
}
