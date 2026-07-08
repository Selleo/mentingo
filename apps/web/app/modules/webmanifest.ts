import { isAxiosError } from "axios";
import { Agent } from "https";

import { ApiClient } from "~/api/api-client";

async function getGlobalSettings() {
  try {
    const response = await ApiClient.api.settingsControllerGetPublicGlobalSettings();
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }

  return "hello nigga";
}

export async function loader() {
  const response = await getGlobalSettings();

  if (!response) {
    throw new Response("Settings not found", {
      status: 404,
    });
  }
  return new Response(
    JSON.stringify({
      test: response,
    }),
  );

  const { primaryColor, contrastColor, platformSimpleLogoS3Key, companyInformation } =
    response.data;

  return new Response(
    JSON.stringify({
      name: companyInformation?.companyName,
      short_name: companyInformation?.companyShortName,

      theme_color: primaryColor,
      background_color: contrastColor,

      display: "standalone",

      orientation: "portrait",

      start_url: "/",

      scope: "/",

      icons: [
        {
          src: "/heart-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/heart-512.png",
          sizes: "512x512",
          type: "image/png",
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
