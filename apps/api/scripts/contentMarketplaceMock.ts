/* eslint-disable no-console */
import crypto from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { CONTENT_MARKETPLACE_DURATIONS, CONTENT_MARKETPLACE_SORT } from "@repo/shared";
import dotenv from "dotenv";
import postgres from "postgres";

import { CONTENT_MARKETPLACE_ENV } from "src/content-marketplace/content-marketplace.constants";
import { ENCRYPTION_ALG } from "src/env/env.config";

dotenv.config({ path: ".env" });

const DEFAULT_PORT = 4010;
const MOCK_API_KEY = "local-content-marketplace-mock";

type MockOptions = { port: number; tenantHost?: string; archivePath?: string };

type MockListing = {
  id: string;
  title: string;
  description: string;
  locales: string[];
  hasThumbnail: boolean;
  versionId: string;
  metadata: { category: string | null; durationMinutes: number | null; lessonCount: number };
  updatedAt: string;
};

const LISTING_SEEDS: Array<[title: string, category: string, minutes: number, lessons: number]> = [
  ["Leading Hybrid Teams", "Leadership", 95, 8],
  ["Giving Feedback That Lands", "Leadership", 40, 5],
  ["First 90 Days as a Manager", "Leadership", 210, 14],
  ["Cybersecurity Essentials", "Compliance", 55, 6],
  ["GDPR in Everyday Work", "Compliance", 35, 4],
  ["Anti-Harassment Training", "Compliance", 60, 5],
  ["Customer Conversations 101", "Sales", 70, 7],
  ["Negotiation Fundamentals", "Sales", 180, 12],
  ["Discovery Calls That Convert", "Sales", 45, 5],
  ["Time Management for Busy People", "Productivity", 30, 4],
  ["Writing Clear Emails", "Productivity", 25, 3],
  ["Prompting AI Assistants at Work", "Productivity", 50, 6],
  ["Onboarding: Welcome to the Team", "Onboarding", 20, 3],
  ["Data Literacy Basics", "Analytics", 120, 10],
];

const PALETTES = [
  ["#1e3a8a", "#3b82f6"],
  ["#7c2d12", "#f97316"],
  ["#14532d", "#22c55e"],
  ["#581c87", "#a855f7"],
  ["#831843", "#ec4899"],
  ["#134e4a", "#14b8a6"],
];

/** Stable UUID-shaped ids so listings and copies survive mock restarts. */
const stableUuid = (seed: string) => {
  const hex = crypto.createHash("sha256").update(seed).digest("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(
    17,
    20,
  )}-${hex.slice(20, 32)}`;
};

const LISTINGS: MockListing[] = LISTING_SEEDS.map(([title, category, minutes, lessons], index) => ({
  id: stableUuid(`listing:${title}`),
  title,
  description: `<p>${title} is a ready-made ${category.toLowerCase()} course from the content marketplace, with ${lessons} lessons you can copy into your platform.</p>`,
  locales: ["en"],
  hasThumbnail: true,
  versionId: stableUuid(`version:${title}`),
  metadata: { category, durationMinutes: minutes, lessonCount: lessons },
  updatedAt: new Date(Date.UTC(2026, 9, 20 - index)).toISOString(),
}));

const DURATION_RANGES: Record<string, [number, number]> = {
  [CONTENT_MARKETPLACE_DURATIONS.SHORT]: [0, 60],
  [CONTENT_MARKETPLACE_DURATIONS.MEDIUM]: [60, 180],
  [CONTENT_MARKETPLACE_DURATIONS.LONG]: [180, Number.POSITIVE_INFINITY],
};

const renderThumbnail = (listing: MockListing, index: number) => {
  const [from, to] = PALETTES[index % PALETTES.length];
  const title = listing.title.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="1080" cy="140" r="220" fill="#ffffff" opacity="0.08"/>
  <circle cx="1180" cy="620" r="160" fill="#ffffff" opacity="0.06"/>
  <text x="80" y="560" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#ffffff" opacity="0.8">${
    listing.metadata.category ?? ""
  }</text>
  <text x="80" y="620" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${title}</text>
</svg>`;
};

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const listCatalog = (params: URLSearchParams) => {
  const keyword = params.get("keyword")?.toLowerCase();
  const category = params.get("category");
  const duration = params.get("duration");
  const page = Number(params.get("page") ?? 1);
  const perPage = Number(params.get("perPage") ?? 20);

  const filtered = LISTINGS.filter((listing) => {
    if (keyword && !listing.title.toLowerCase().includes(keyword)) return false;
    if (category && listing.metadata.category !== category) return false;
    if (!duration) return true;

    const [min, max] = DURATION_RANGES[duration] ?? [0, Number.POSITIVE_INFINITY];
    const minutes = listing.metadata.durationMinutes ?? 0;

    return minutes >= min && minutes < max;
  }).sort((a, b) =>
    params.get("sortBy") === CONTENT_MARKETPLACE_SORT.TITLE
      ? a.title.localeCompare(b.title)
      : b.updatedAt.localeCompare(a.updatedAt),
  );

  return {
    data: filtered.slice((page - 1) * perPage, page * perPage),
    pagination: { totalItems: filtered.length, page, perPage },
  };
};

const handleRequest =
  (options: MockOptions) => (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", `http://localhost:${options.port}`);
    const path = url.pathname.replace(/^\/marketplace\/v1\//, "");
    const [resource, id, child] = path.split("/");

    console.log(`[marketplace-mock] ${request.method} ${url.pathname}${url.search}`);

    if (request.headers.authorization !== `Bearer ${MOCK_API_KEY}`) {
      return sendJson(response, 401, { message: "Invalid API key" });
    }

    if (path === "configuration") {
      return sendJson(response, 200, { capabilities: { contentMarketplace: { enabled: true } } });
    }

    if (path === "catalog") return sendJson(response, 200, listCatalog(url.searchParams));

    if (path === "catalog/filters") {
      const categories = [...new Set(LISTINGS.map((listing) => listing.metadata.category))];

      return sendJson(response, 200, { categories: categories.filter(Boolean).sort() });
    }

    if (path === "events" && request.method === "POST") {
      return sendJson(response, 200, { eventId: crypto.randomUUID(), duplicate: false });
    }

    const listingIndex = LISTINGS.findIndex((listing) => listing.id === id);
    const listing = LISTINGS[listingIndex];

    if (resource === "listings" && listing && !child) return sendJson(response, 200, listing);

    if (resource === "listings" && listing && child === "thumbnail") {
      response.writeHead(200, { "content-type": "image/svg+xml" });
      return response.end(renderThumbnail(listing, listingIndex));
    }

    if (resource === "listings" && listing && child === "acquisitions") {
      return sendJson(response, 201, {
        acquisitionId: crypto.randomUUID(),
        versionId: listing.versionId,
      });
    }

    if (resource === "acquisitions" && child === "archive") {
      if (!options.archivePath) {
        return sendJson(response, 404, {
          message: "Start the mock with --archive to enable copies",
        });
      }

      response.writeHead(200, {
        "content-type": "application/zip",
        "content-length": statSync(options.archivePath).size,
      });
      return createReadStream(options.archivePath).pipe(response);
    }

    return sendJson(response, 404, { message: "Not found" });
  };

const encryptSecret = (value: string, masterKey: Buffer) => {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALG, dek, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const dekIv = crypto.randomBytes(12);
  const dekCipher = crypto.createCipheriv(ENCRYPTION_ALG, masterKey, dekIv);
  const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    encryptedDek: encryptedDek.toString("base64"),
    encryptedDekIv: dekIv.toString("base64"),
    encryptedDekTag: dekCipher.getAuthTag().toString("base64"),
  };
};

/** Saves the plugin connection the same way the integration API would, but for a local tenant. */
const connectTenant = async (options: MockOptions) => {
  const masterKey = Buffer.from(process.env.MASTER_KEY ?? "", "base64");
  if (masterKey.length !== 32) throw new Error("MASTER_KEY must be a base64-encoded 32-byte key");

  const sql = postgres(process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!);

  try {
    const tenants = options.tenantHost
      ? await sql`SELECT id, host FROM tenants WHERE host = ${options.tenantHost}`
      : await sql`SELECT id, host FROM tenants ORDER BY created_at LIMIT 1`;
    const [tenant] = tenants;
    if (!tenant) throw new Error(`Tenant not found: ${options.tenantHost ?? "(first tenant)"}`);

    const values = {
      [CONTENT_MARKETPLACE_ENV.BASE_URL]: `http://localhost:${options.port}`,
      [CONTENT_MARKETPLACE_ENV.API_KEY]: MOCK_API_KEY,
    };

    for (const [secretName, value] of Object.entries(values)) {
      const secret = encryptSecret(value, masterKey);

      await sql`
        INSERT INTO secrets (secret_name, ciphertext, iv, tag, encrypted_dek, encrypted_dek_iv, encrypted_dek_tag, tenant_id)
        VALUES (${secretName}, ${secret.ciphertext}, ${secret.iv}, ${secret.tag}, ${secret.encryptedDek}, ${secret.encryptedDekIv}, ${secret.encryptedDekTag}, ${tenant.id})
        ON CONFLICT (tenant_id, secret_name) DO UPDATE SET
          ciphertext = excluded.ciphertext, iv = excluded.iv, tag = excluded.tag,
          encrypted_dek = excluded.encrypted_dek, encrypted_dek_iv = excluded.encrypted_dek_iv,
          encrypted_dek_tag = excluded.encrypted_dek_tag, version = secrets.version + 1`;
    }

    console.log(`[marketplace-mock] Connected tenant ${tenant.host} (${tenant.id})`);
  } finally {
    await sql.end();
  }
};

const parseOptions = (args: string[]): MockOptions => {
  const readFlag = (name: string) => {
    const prefix = `--${name}=`;

    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };

  return {
    port: Number(readFlag("port") ?? DEFAULT_PORT),
    tenantHost: readFlag("tenant"),
    archivePath: readFlag("archive"),
  };
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2));

  await connectTenant(options);

  createServer(handleRequest(options)).listen(options.port, () => {
    console.log(
      `[marketplace-mock] Serving ${LISTINGS.length} listings on http://localhost:${options.port}`,
    );
    if (!options.archivePath) {
      console.log(
        "[marketplace-mock] Copying is disabled; pass --archive=<course export> to enable it",
      );
    }
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
