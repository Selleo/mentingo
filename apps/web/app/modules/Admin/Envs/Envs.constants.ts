import { OAUTH_LOGIN_METHODS } from "@repo/shared";

import type { OAuthLoginMethod } from "@repo/shared";

export const SECRET_METADATA = {
  MICROSOFT_CLIENT_ID: {
    labelKey: "adminEnvsView.form.MICROSOFT_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  MICROSOFT_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.MICROSOFT_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  MICROSOFT_CALENDAR_CLIENT_ID: {
    labelKey: "adminEnvsView.form.MICROSOFT_CALENDAR_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  MICROSOFT_CALENDAR_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.MICROSOFT_CALENDAR_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  OPENAI_API_KEY: {
    labelKey: "adminEnvsView.form.OPENAI_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_API_KEY: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_READ_ONLY_API_KEY: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_READ_ONLY_API_KEY.label",
    descriptionKey: "adminEnvsView.form.BUNNY_STREAM_READ_ONLY_API_KEY.description",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_LIBRARY_ID: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_LIBRARY_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_TOKEN_SIGNING_KEY: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_TOKEN_SIGNING_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_CDN_URL: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_CDN_URL.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  GOOGLE_CLIENT_ID: {
    labelKey: "adminEnvsView.form.GOOGLE_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  GOOGLE_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.GOOGLE_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  STRIPE_WEBHOOK_SECRET: {
    labelKey: "adminEnvsView.form.STRIPE_WEBHOOK_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  STRIPE_SECRET_KEY: {
    labelKey: "adminEnvsView.form.STRIPE_SECRET_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  VITE_STRIPE_PUBLISHABLE_KEY: {
    labelKey: "adminEnvsView.form.VITE_STRIPE_PUBLISHABLE_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  SLACK_CLIENT_ID: {
    labelKey: "adminEnvsView.form.SLACK_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  SLACK_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.SLACK_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  PHISHING_API_KEY: {
    labelKey: "phishing.PHISHING_API_KEY",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  PHISHING_BASE_URL: {
    labelKey: "phishing.PHISHING_BASE_URL",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  PHISHING_WEBHOOK_SECRET: {
    labelKey: "phishing.PHISHING_WEBHOOK_SECRET",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LUMA_API_KEY: {
    labelKey: "adminEnvsView.form.LUMA_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LIVEKIT_URL: {
    labelKey: "adminEnvsView.form.LIVEKIT_URL.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LIVEKIT_API_KEY: {
    labelKey: "adminEnvsView.form.LIVEKIT_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LIVEKIT_API_SECRET: {
    labelKey: "adminEnvsView.form.LIVEKIT_API_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
};

type SecretName = keyof typeof SECRET_METADATA;

export const ENV_GROUPS = [
  {
    id: "googleSignIn",
    titleKey: "adminEnvsView.groups.googleSignIn.title",
    descriptionKey: "adminEnvsView.groups.googleSignIn.description",
    secretNames: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "microsoftSignIn",
    titleKey: "adminEnvsView.groups.microsoftSignIn.title",
    descriptionKey: "adminEnvsView.groups.microsoftSignIn.description",
    secretNames: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  },
  {
    id: "slackSignIn",
    titleKey: "adminEnvsView.groups.slackSignIn.title",
    descriptionKey: "adminEnvsView.groups.slackSignIn.description",
    secretNames: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
  },
  {
    id: "microsoftCalendar",
    titleKey: "adminEnvsView.groups.microsoftCalendar.title",
    descriptionKey: "adminEnvsView.groups.microsoftCalendar.description",
    secretNames: ["MICROSOFT_CALENDAR_CLIENT_ID", "MICROSOFT_CALENDAR_CLIENT_SECRET"],
  },
  {
    id: "payments",
    titleKey: "adminEnvsView.groups.payments.title",
    descriptionKey: "adminEnvsView.groups.payments.description",
    secretNames: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "VITE_STRIPE_PUBLISHABLE_KEY"],
  },
  {
    id: "videoStreaming",
    titleKey: "adminEnvsView.groups.videoStreaming.title",
    descriptionKey: "adminEnvsView.groups.videoStreaming.description",
    secretNames: [
      "BUNNY_STREAM_API_KEY",
      "BUNNY_STREAM_READ_ONLY_API_KEY",
      "BUNNY_STREAM_LIBRARY_ID",
      "BUNNY_STREAM_TOKEN_SIGNING_KEY",
      "BUNNY_STREAM_CDN_URL",
    ],
  },
  {
    id: "artificialIntelligence",
    titleKey: "adminEnvsView.groups.artificialIntelligence.title",
    descriptionKey: "adminEnvsView.groups.artificialIntelligence.description",
    secretNames: ["OPENAI_API_KEY", "LUMA_API_KEY"],
  },
  {
    id: "liveTraining",
    titleKey: "adminEnvsView.groups.liveTraining.title",
    descriptionKey: "adminEnvsView.groups.liveTraining.description",
    secretNames: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
  },
  {
    id: "phishingSimulations",
    titleKey: "adminEnvsView.groups.phishingSimulations.title",
    descriptionKey: "adminEnvsView.groups.phishingSimulations.description",
    secretNames: ["PHISHING_API_KEY", "PHISHING_BASE_URL", "PHISHING_WEBHOOK_SECRET"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  titleKey: string;
  descriptionKey: string;
  secretNames: ReadonlyArray<SecretName>;
}>;

export type EnvGroupId = (typeof ENV_GROUPS)[number]["id"];

export const OAUTH_LOGIN_METHOD_ENV_GROUP_IDS = {
  [OAUTH_LOGIN_METHODS.GOOGLE]: "googleSignIn",
  [OAUTH_LOGIN_METHODS.MICROSOFT]: "microsoftSignIn",
  [OAUTH_LOGIN_METHODS.SLACK]: "slackSignIn",
} as const satisfies Record<OAuthLoginMethod, EnvGroupId>;
