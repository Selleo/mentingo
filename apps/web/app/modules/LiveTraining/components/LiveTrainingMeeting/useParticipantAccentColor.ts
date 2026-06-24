import { useEffect, useState } from "react";

const FALLBACK_ACCENT = "var(--primary-700)";
const sampledColorByProfilePictureUrl = new Map<string, string>();

const getSampledImageColor = (image: HTMLImageElement) => {
  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, size, size);

  const { data } = context.getImageData(0, 0, size, size);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;

    if (alpha < 128) continue;

    red += data[index] ?? 0;
    green += data[index + 1] ?? 0;
    blue += data[index + 2] ?? 0;
    count += 1;
  }

  if (!count) return null;

  return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(
    blue / count,
  )})`;
};

export const useParticipantAccentColor = (profilePictureUrl: string | null | undefined) => {
  const [sampledColor, setSampledColor] = useState<string | null>(
    profilePictureUrl ? (sampledColorByProfilePictureUrl.get(profilePictureUrl) ?? null) : null,
  );

  useEffect(() => {
    if (!profilePictureUrl) {
      setSampledColor(null);
      return;
    }

    const cachedColor = sampledColorByProfilePictureUrl.get(profilePictureUrl);

    if (cachedColor) {
      setSampledColor(cachedColor);
      return;
    }

    setSampledColor(null);

    let isCancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      if (isCancelled) return;

      try {
        const nextColor = getSampledImageColor(image);

        if (nextColor) {
          sampledColorByProfilePictureUrl.set(profilePictureUrl, nextColor);
        }

        setSampledColor(nextColor);
      } catch {
        setSampledColor(null);
      }
    };
    image.onerror = () => {
      if (!isCancelled) setSampledColor(null);
    };
    image.src = profilePictureUrl;

    return () => {
      isCancelled = true;
    };
  }, [profilePictureUrl]);

  if (!profilePictureUrl) return FALLBACK_ACCENT;

  return sampledColor ?? FALLBACK_ACCENT;
};
