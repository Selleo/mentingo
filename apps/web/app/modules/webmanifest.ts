import { Agent } from "https";
import { env } from "process";

import { isAxiosError } from "axios";

import { ApiClient } from "~/api/api-client";

import type { LoaderFunctionArgs } from "@remix-run/node";

async function getGlobalSettings(request: Request, baseURL: string) {
  const httpsAgent =
    env.NODE_ENV === "development" ? new Agent({ rejectUnauthorized: false }) : undefined;

  try {
    const response = await ApiClient.api.settingsControllerGetPublicGlobalSettings({
      baseURL,
      httpsAgent,
    });
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

const getImageType = (url: string) => {
  const extension = url.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "svg":
      return "image/svg+xml";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    default:
      return undefined;
  }
};

export async function loader({ request }: LoaderFunctionArgs) {
  const baseURL = new URL(request.url).origin;
  const response = await getGlobalSettings(request, baseURL);

  if (!response) {
    throw new Response("Settings not found", {
      status: 404,
    });
  }

  const { primaryColor, contrastColor, platformSimpleLogoS3Key, companyInformation } =
    response.data;

  const imageURL = platformSimpleLogoS3Key
    ? `${baseURL}${platformSimpleLogoS3Key}`
    : `${baseURL}/app.svg`;
  const imageType = getImageType(imageURL);
  const imageSize = platformSimpleLogoS3Key ? null : "any";

  return new Response(
    JSON.stringify({
      name: companyInformation?.companyName || "Mentingo",

      theme_color: primaryColor || "#3f58b6",
      background_color: contrastColor || "#fcfcfc",

      display: "standalone",

      orientation: "portrait",

      start_url: "/",

      scope: "/",

      icons: [
        {
          src: imageURL,
          sizes: imageSize ?? "192x192",
          type: imageType,
        },
        {
          src: imageURL,
          sizes: imageSize ?? "512x512",
          type: imageType,
          purpose: "maskable",
        },
      ],
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store",
      },
    },
  );
}
