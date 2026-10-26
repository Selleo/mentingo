import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { match, P } from "ts-pattern";

import type { createSecretFactory } from "../factory/secret.factory";
import type {
  Campaign,
  CreateCampaign,
  RecipientResult,
  ReportActivity,
  Scenario,
} from "@mentingo/phishing-simulation-sdk";
import type { IncomingMessage, ServerResponse } from "node:http";

export const FAKE_PHISHING_SCENARIOS: Scenario[] = [
  {
    id: "course-reminder",
    name: "Course reminder",
    description: "A reminder to finish an assigned course",
    action: "clicked",
  },
  {
    id: "password-reset",
    name: "Password reset",
    description: "A request to reset the account password",
    action: "submitted",
  },
];

export const FAKE_PHISHING_SETTINGS = {
  apiKey: "fake-phishing-plugin-key",
  webhookSecret: "fake-phishing-webhook-secret-of-32+chars",
} as const;

export type RecordedPluginRequest = {
  method: string;
  path: string;
  query: Record<string, string[]>;
  tenantId: string;
  body: unknown;
};

type StoredCampaign = { campaign: Campaign; recipients: RecipientResult[] };

type SeededRecipient = Pick<RecipientResult, "userId"> & Partial<RecipientResult>;

/**
 * In-memory stand-in for the external phishing plugin. It speaks the SDK's HTTP routes, scopes
 * reports by `groupIds` like the real plugin, and records every request it receives.
 */
export async function startFakePhishingPlugin() {
  const requests: RecordedPluginRequest[] = [];
  const campaigns = new Map<string, StoredCampaign>();
  let enabled = true;
  let failureStatus: number | null = null;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://fake-plugin");
    const segments = url.pathname.replace(/^\/v1\//, "").split("/");
    const body = await readJsonBody(request);
    const recorded: RecordedPluginRequest = {
      method: request.method ?? "GET",
      path: url.pathname.replace(/^\/v1/, ""),
      query: collectQuery(url.searchParams),
      tenantId: String(request.headers["x-tenant-id"]),
      body,
    };
    requests.push(recorded);

    if (failureStatus && segments[0] !== "configuration")
      return sendJson(response, failureStatus, {});

    match([recorded.method, segments] as const)
      .with(["GET", ["configuration"]], () =>
        sendJson(response, 200, { capabilities: { phishingSimulation: { enabled } } }),
      )
      .with(["GET", ["scenarios"]], () => sendJson(response, 200, FAKE_PHISHING_SCENARIOS))
      .with(["GET", ["campaigns"]], () =>
        sendJson(
          response,
          200,
          [...campaigns.values()].map(({ campaign }) => campaign),
        ),
      )
      .with(["POST", ["campaigns"]], () => {
        const input = body as CreateCampaign;
        const stored = storeCampaign(
          { name: input.name, scenarioId: input.scenarioId, courseId: input.courseId },
          input.createdBy,
          input.recipients.map((recipient) => toRecipientResult(recipient)),
        );
        sendJson(response, 200, stored.campaign);
      })
      .with(["GET", ["campaigns", P.string]], ([, [, id]]) =>
        withCampaign(response, id, ({ campaign }) => campaign),
      )
      .with(["POST", ["campaigns", P.string, "cancel"]], ([, [, id]]) =>
        withCampaign(response, id, (stored) => {
          stored.campaign = { ...stored.campaign, status: "cancelled" };
          return stored.campaign;
        }),
      )
      .with(["GET", ["campaigns", P.string, "report"]], ([, [, id]]) =>
        withCampaign(response, id, (stored) => stored),
      )
      .with(["GET", ["campaigns", P.string, "report", "summary"]], ([, [, id]]) =>
        withCampaign(response, id, (stored) => summarize(stored, recorded.query.groupIds)),
      )
      .with(["GET", ["campaigns", P.string, "report", "recipients"]], ([, [, id]]) =>
        withCampaign(response, id, (stored) => {
          const recipients = searchRecipients(
            scopeRecipients(stored.recipients, recorded.query.groupIds),
            recorded.query.search?.[0],
          );
          return {
            recipients,
            pagination: {
              page: Number(recorded.query.page?.[0] ?? 1),
              perPage: Number(recorded.query.perPage?.[0] ?? 20),
              totalItems: recipients.length,
            },
          };
        }),
      )
      .otherwise(() => sendJson(response, 404, {}));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake phishing plugin has no port");

  const withCampaign = (
    response: ServerResponse,
    id: string,
    respond: (stored: StoredCampaign) => unknown,
  ) => {
    const stored = campaigns.get(id);
    if (!stored) return sendJson(response, 404, {});
    sendJson(response, 200, respond(stored));
  };

  const storeCampaign = (
    details: Pick<Campaign, "name" | "scenarioId" | "courseId">,
    createdBy: string,
    recipients: RecipientResult[],
  ) => {
    const now = new Date().toISOString();
    const stored: StoredCampaign = {
      campaign: {
        id: randomUUID(),
        ...details,
        createdBy,
        createdAt: now,
        status: "scheduled",
        sendWindow: { start: now, end: now },
      },
      recipients,
    };
    campaigns.set(stored.campaign.id, stored);
    return stored;
  };

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    disableSimulations: () => {
      enabled = false;
    },
    failRequestsWith: (status: number) => {
      failureStatus = status;
    },
    seedCampaign: (
      details: Pick<Campaign, "courseId" | "createdBy"> & Partial<Pick<Campaign, "scenarioId">>,
      recipients: SeededRecipient[],
    ) =>
      storeCampaign(
        {
          name: "Seeded campaign",
          scenarioId: details.scenarioId ?? FAKE_PHISHING_SCENARIOS[0].id,
          courseId: details.courseId,
        },
        details.createdBy,
        recipients.map((recipient) => toRecipientResult(recipient)),
      ).campaign,
    requestsTo: (path: string) => requests.filter((request) => request.path === path),
    reset: () => {
      requests.length = 0;
      campaigns.clear();
      enabled = true;
      failureStatus = null;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

export type FakePhishingPlugin = Awaited<ReturnType<typeof startFakePhishingPlugin>>;

/** Stores the tenant's plugin connection settings; call inside a tenant context. */
export const storeFakePhishingPluginSettings = (
  secretFactory: ReturnType<typeof createSecretFactory>,
  plugin: FakePhishingPlugin,
) =>
  Promise.all([
    secretFactory.create({ name: "PHISHING_API_KEY", value: FAKE_PHISHING_SETTINGS.apiKey }),
    secretFactory.create({ name: "PHISHING_BASE_URL", value: plugin.baseUrl }),
    secretFactory.create({
      name: "PHISHING_WEBHOOK_SECRET",
      value: FAKE_PHISHING_SETTINGS.webhookSecret,
    }),
  ]);

/** Signs a webhook body the way the plugin does: HMAC-SHA256 over `<timestamp>.<raw body>`. */
export function signPhishingWebhook(
  rawBody: string,
  {
    secret = FAKE_PHISHING_SETTINGS.webhookSecret,
    timestamp = Math.floor(Date.now() / 1000),
  }: { secret?: string; timestamp?: number } = {},
) {
  return {
    "Content-Type": "application/json",
    "X-Phishing-Timestamp": String(timestamp),
    "X-Phishing-Signature": createHmac("sha256", secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest("hex"),
  };
}

function toRecipientResult(recipient: SeededRecipient): RecipientResult {
  return {
    email: `${recipient.userId}@example.com`,
    firstName: "Recipient",
    lastName: recipient.userId,
    groupIds: [],
    sentAt: null,
    clickedAt: null,
    submittedAt: null,
    failed: false,
    ...recipient,
  };
}

function scopeRecipients(recipients: RecipientResult[], groupIds?: string[]) {
  if (!groupIds) return recipients;

  return recipients.filter((recipient) => recipient.groupIds.some((id) => groupIds.includes(id)));
}

function searchRecipients(recipients: RecipientResult[], search?: string) {
  if (!search) return recipients;

  const needle = search.toLowerCase();
  return recipients.filter(({ firstName, lastName, email }) =>
    `${firstName} ${lastName} ${email}`.toLowerCase().includes(needle),
  );
}

function totalsOf(recipients: RecipientResult[]) {
  return {
    recipients: recipients.length,
    sent: recipients.filter(({ sentAt }) => sentAt).length,
    clicked: recipients.filter(({ clickedAt }) => clickedAt).length,
    submitted: recipients.filter(({ submittedAt }) => submittedAt).length,
    risky: recipients.filter(({ clickedAt, submittedAt }) => clickedAt || submittedAt).length,
  };
}

function summarize(stored: StoredCampaign, groupIds?: string[]) {
  const recipients = scopeRecipients(stored.recipients, groupIds);
  const reportedGroupIds = [
    ...new Set(recipients.flatMap((recipient) => recipient.groupIds)),
  ].filter((id) => !groupIds || groupIds.includes(id));
  const activity: ReportActivity[] = recipients.flatMap(
    ({ userId, firstName, lastName, clickedAt }) =>
      clickedAt ? [{ userId, firstName, lastName, action: "clicked" as const, at: clickedAt }] : [],
  );

  return {
    campaign: stored.campaign,
    totals: totalsOf(recipients),
    groups: reportedGroupIds.map((id) => ({
      id,
      totals: totalsOf(recipients.filter((recipient) => recipient.groupIds.includes(id))),
    })),
    activity,
  };
}

function collectQuery(searchParams: URLSearchParams) {
  const query: Record<string, string[]> = {};
  for (const [key, value] of searchParams) query[key] = [...(query[key] ?? []), value];
  return query;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : undefined;
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}
