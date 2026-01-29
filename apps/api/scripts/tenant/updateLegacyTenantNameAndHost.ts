/* eslint-disable no-console */

import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { loadEsm } from "load-esm";
import postgres from "postgres";

import { tenants } from "src/storage/schema";

import * as schema from "../../src/storage/schema";

import type { DatabasePg } from "src/common";

dotenv.config({ path: ".env" });

async function run() {
  const yargsModule = await loadEsm<typeof import("yargs")>("yargs");
  const helpersModule = await loadEsm<typeof import("yargs/helpers")>("yargs/helpers");

  const yargsFactory =
    typeof yargsModule.default === "function" ? yargsModule.default : yargsModule;

  const hideBin =
    typeof helpersModule.hideBin === "function"
      ? helpersModule.hideBin
      : (helpersModule as any).default.hideBin;

  const argv = await yargsFactory(hideBin(process.argv))
    .option("new-name", {
      alias: "n",
      description: "New tenant name",
      type: "string",
      demandOption: true,
    })
    .option("new-host", {
      alias: "nh",
      description: "New tenant host",
      type: "string",
      demandOption: true,
    })
    .check((args) => {
      if (!args["new-name"] || !args["new-host"]) {
        throw new Error("Provide --new-name and --new-host to update the tenant.");
      }

      return true;
    })
    .help().argv;

  const pg = postgres(process.env.DATABASE_URL!, { connect_timeout: 2 });
  const db = drizzle(pg, { schema }) as DatabasePg;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.host, "legacy.local")).limit(1);

  if (!tenant) {
    console.error("Tenant not found. Check if your migrations are up to date.");
    await pg.end();
    process.exit(1);
  }

  const [updatedTenant] = await db
    .update(tenants)
    .set({ name: argv["new-name"] as string, host: argv["new-host"] as string })
    .where(eq(tenants.id, tenant.id))
    .returning();

  console.log("Tenant updated:", {
    id: updatedTenant.id,
    previousName: tenant.name,
    newName: updatedTenant.name,
    previousHost: tenant.host,
    newHost: updatedTenant.host,
  });

  await pg.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
