import videojs from "video.js";

type VideoJSType = ReturnType<typeof videojs>;

const HLS_QUALITY_CONTROL_NAME = "MentingoHlsQualityControl";
const HLS_QUALITY_CONTROL_INDEX = 13;

let registered = false;

export const registerHlsQualityControlComponent = () => {
  if (registered) return;

  const Component = videojs.getComponent("Component");

  class HlsQualityControlComponent extends Component {
    createEl() {
      return videojs.dom.createEl("div", {
        className: "mentingo-vjs-quality-selector-host vjs-hidden",
      });
    }
  }

  videojs.registerComponent(HLS_QUALITY_CONTROL_NAME, HlsQualityControlComponent);
  registered = true;
};

export const addHlsQualityControlComponent = (player: VideoJSType) => {
  registerHlsQualityControlComponent();

  const controlBar = player.getChild("controlBar");
  if (!controlBar) return null;

  const existingControl = controlBar.getChild(HLS_QUALITY_CONTROL_NAME);
  if (existingControl) return existingControl.el() as HTMLDivElement;

  const control = controlBar.addChild(HLS_QUALITY_CONTROL_NAME, {}, HLS_QUALITY_CONTROL_INDEX);

  return control.el() as HTMLDivElement;
};
