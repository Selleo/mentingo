import type { Area } from "react-easy-crop";

export const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
};

export const generateImageCrop = async (
  imageUrl: string,
  pixelCrop: Area,
  maxResolution?: { width?: number; height?: number },
): Promise<File> => {
  const image = await createImage(imageUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return Promise.reject("Canvas not supported");
  }

  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  if (maxResolution && (maxResolution.width || maxResolution.height)) {
    const scale = Math.min(
      1,
      maxResolution.width ? maxResolution.width / pixelCrop.width : 1,
      maxResolution.height ? maxResolution.height / pixelCrop.height : 1,
    );

    targetWidth = Math.round(pixelCrop.width * scale);
    targetHeight = Math.round(pixelCrop.height * scale);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        return reject("Blob creation failed");
      }

      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      resolve(file);
    }, "image/jpeg");
  });
};
