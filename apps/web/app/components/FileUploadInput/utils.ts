import type { Area } from "react-easy-crop";

export const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
};

export const generateImageCrop = async (imageUrl: string, pixelCrop: Area): Promise<File> => {
  const image = await createImage(imageUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return Promise.reject("Canvas not supported");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
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
