import { Injectable } from "@nestjs/common";
import axios from "axios";

import { CONVERTER_DEADLINE_MS, MAX_PRESENTATION_BYTES } from "./presentation-preview.constants";

@Injectable()
export class PresentationConverterClient {
  async convert(input: Buffer, extension: "pptx" | "odp"): Promise<Buffer> {
    try {
      const configuredUrl = process.env.PRESENTATION_CONVERTER_URL;
      if (process.env.NODE_ENV === "production" && !configuredUrl)
        throw new Error("Missing converter URL");
      const baseUrl = (configuredUrl || "http://127.0.0.1:8090").replace(/\/$/, "");
      const form = new FormData();
      form.append("files", new Blob([new Uint8Array(input)]), `presentation.${extension}`);
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), CONVERTER_DEADLINE_MS);
      try {
        const response = await axios.post<ArrayBuffer>(
          `${baseUrl}/forms/libreoffice/convert`,
          form,
          {
            responseType: "arraybuffer",
            maxBodyLength: MAX_PRESENTATION_BYTES + 1024 * 1024,
            maxContentLength: MAX_PRESENTATION_BYTES,
            maxRedirects: 0,
            proxy: false,
            timeout: CONVERTER_DEADLINE_MS,
            signal: controller.signal,
          },
        );
        const pdf = Buffer.from(response.data);
        if (
          !pdf.length ||
          pdf.length > MAX_PRESENTATION_BYTES ||
          pdf.subarray(0, 5).toString() !== "%PDF-"
        ) {
          throw new Error("Invalid converter response");
        }
        return pdf;
      } finally {
        clearTimeout(deadline);
      }
    } catch {
      throw new Error("Presentation conversion failed");
    }
  }
}
