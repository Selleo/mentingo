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

async function getPlatformSimpleLogoPwaIcons(baseURL: string) {
  const httpsAgent =
    env.NODE_ENV === "development" ? new Agent({ rejectUnauthorized: false }) : undefined;

  try {
    const response = await ApiClient.api.settingsControllerGetPlatformSimpleLogoPwaIcons({
      baseURL,
      httpsAgent,
    });

    return response.data.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const baseURL = new URL(request.url).origin;
  const globalSettings = await getGlobalSettings(request, baseURL);

  if (!globalSettings) {
    throw new Response("Settings not found", {
      status: 404,
    });
  }

  const { primaryColor, contrastColor, platformSimpleLogoS3Key, companyInformation } =
    globalSettings.data;

  const defaultIcon = `${baseURL}/app.svg`;
  const pwaIcons = platformSimpleLogoS3Key ? await getPlatformSimpleLogoPwaIcons(baseURL) : null;

  const icon192Url = pwaIcons?.icon192Url;
  const icon512Url = pwaIcons?.icon512Url;
  const icon192Type = pwaIcons?.icon192Type;
  const icon512Type = pwaIcons?.icon512Type;

  return new Response(
    JSON.stringify({
      name: companyInformation?.companyName || companyInformation?.companyShortName || "Mentingo",

      theme_color: primaryColor || "#3f58b6",
      background_color: contrastColor || "#fcfcfc",

      display: "standalone",

      orientation: "portrait",

      start_url: "/",

      scope: "/",

      icons: pwaIcons
        ? [
            {
              src: icon192Url,
              sizes: "192x192",
              type: icon192Type,
            },
            {
              src: icon512Url,
              sizes: "512x512",
              type: icon512Type,
            },
          ]
        : [
            {
              src: defaultIcon,
              sizes: "any",
              type: "image/svg+xml",
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
