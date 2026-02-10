import { createRoot, type Root } from "react-dom/client";
import videojs from "video.js";

import { FullscreenToggleButton } from "./FullscreenToggleButton";

const CONTROL_NAME = "MentingoFullscreenToggle";

type FullscreenTargetResolver = () => HTMLElement | null;

type PlayerWithFullscreenOption = {
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  dispose: () => void;
  options_: {
    getFullscreenTarget?: FullscreenTargetResolver;
  };
};

type VideoJsBaseComponentCtor = new (player: PlayerWithFullscreenOption) => {
  player: () => PlayerWithFullscreenOption;
  dispose(): void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

const isAnyFullscreenActive = () => {
  if (typeof document === "undefined") return false;
  const doc = document as FullscreenDocument;
  return Boolean(
    document.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement,
  );
};

export const registerMentingoFullscreenControl = () => {
  if (videojs.getComponent(CONTROL_NAME)) {
    return;
  }

  const Component = videojs.getComponent("Component") as unknown as VideoJsBaseComponentCtor;

  class MentingoFullscreenToggle extends Component {
    private root: Root | null = null;
    private onFullscreenChange = () => {
      this.render();
    };

    constructor(player: PlayerWithFullscreenOption) {
      super(player);
      player.on("fullscreenchange", this.onFullscreenChange);
      if (typeof document !== "undefined") {
        document.addEventListener("fullscreenchange", this.onFullscreenChange);
        document.addEventListener(
          "webkitfullscreenchange",
          this.onFullscreenChange as EventListener,
        );
        document.addEventListener("MSFullscreenChange", this.onFullscreenChange as EventListener);
      }
    }

    createEl() {
      const el = videojs.dom.createEl("div", {
        className: "vjs-control vjs-button vjs-fullscreen-control mentingo-fullscreen-control",
      });
      const mountPoint = document.createElement("div");
      mountPoint.style.width = "100%";
      mountPoint.style.height = "100%";
      mountPoint.style.display = "flex";
      mountPoint.style.alignItems = "center";
      mountPoint.style.justifyContent = "center";
      el.appendChild(mountPoint);
      this.root = createRoot(mountPoint);
      this.render();
      return el;
    }

    dispose() {
      const player = this.player();
      player.off("fullscreenchange", this.onFullscreenChange);
      if (typeof document !== "undefined") {
        document.removeEventListener("fullscreenchange", this.onFullscreenChange);
        document.removeEventListener(
          "webkitfullscreenchange",
          this.onFullscreenChange as EventListener,
        );
        document.removeEventListener(
          "MSFullscreenChange",
          this.onFullscreenChange as EventListener,
        );
      }
      this.root?.unmount();
      this.root = null;
      super.dispose();
    }

    private render() {
      if (!this.root) return;
      const player = this.player();
      const target = player.options_.getFullscreenTarget?.() ?? null;

      this.root.render(
        <FullscreenToggleButton
          isAnyFullscreen={false}
          visible
          onToggle={() => {
            if (isAnyFullscreenActive()) {
              void document
                .exitFullscreen()
                .then(this.onFullscreenChange)
                .catch(() => undefined);
              return;
            }
            if (!target) return;
            void target
              .requestFullscreen()
              .then(this.onFullscreenChange)
              .catch(() => undefined);
          }}
          className="!static !inset-auto !z-0 !flex !h-full !w-full !items-center !justify-center !rounded-md !bg-transparent !p-0"
        />,
      );
    }
  }

  videojs.registerComponent(
    CONTROL_NAME,
    MentingoFullscreenToggle as unknown as Parameters<typeof videojs.registerComponent>[1],
  );
};

export const MENTINGO_FULLSCREEN_CONTROL_NAME = CONTROL_NAME;
