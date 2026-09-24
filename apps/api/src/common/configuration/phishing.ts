import { registerAs } from "@nestjs/config";
export default registerAs("phishing", () => ({
  apiKey: process.env.PHISHING_API_KEY || "",
  baseURL: process.env.PHISHING_BASE_URL || "",
  webhookSecret: process.env.PHISHING_WEBHOOK_SECRET || "",
}));
