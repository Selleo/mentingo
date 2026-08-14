import { sql } from "drizzle-orm";
import request from "supertest";

import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { settings } from "../../src/storage/schema";

import { DEFAULT_E2E_GLOBAL_SETTINGS } from "./e2e-settings";

import type { DatabasePg } from "../../src/common";
import type { INestApplication } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { UserWithCredentials } from "test/factory/user.factory";

const POSTGRES_DEADLOCK_CODE = "40P01";
const TRUNCATE_MAX_ATTEMPTS = 3;

type CamelToSnake<T extends string, P extends string = ""> = string extends T
  ? string
  : T extends `${infer C0}${infer R}`
    ? CamelToSnake<R, `${P}${C0 extends Lowercase<C0> ? "" : "_"}${Lowercase<C0>}`>
    : P;

type StringKeys<T> = Extract<keyof T, string>;

export function environmentVariablesFactory() {
  return {
    get: jest.fn((key: string) => {
      switch (key) {
        case "JWT_SECRET":
          return "secret";
        case "DEBUG":
          return "false";
      }
    }),
  };
}

export function signInAs(userId: string, jwtService: JwtService): string {
  return jwtService.sign({ sub: userId });
}

export async function truncateAllTables(
  connection: DatabasePg,
  scopedConnection: DatabasePg,
): Promise<void> {
  const tables = connection._.tableNamesMap;
  // Keep the tenant row alive so FK defaults remain valid when we recreate settings.
  const tableNames = Object.keys(tables)
    .filter((t) => t !== "tenants")
    .map((t) => `"${t}"`)
    .join(", ");

  for (let attempt = 1; attempt <= TRUNCATE_MAX_ATTEMPTS; attempt++) {
    try {
      await connection.transaction(async (transaction) => {
        // SET LOCAL restores the role when the transaction finishes, including
        // when Postgres rolls it back after a deadlock.
        await transaction.execute(
          sql.raw(`
            SET LOCAL session_replication_role = 'replica';
            TRUNCATE TABLE ${tableNames} RESTART IDENTITY;
          `),
        );
      });
      break;
    } catch (error) {
      const isDeadlock =
        error instanceof Object && "code" in error && error.code === POSTGRES_DEADLOCK_CODE;

      if (!isDeadlock || attempt === TRUNCATE_MAX_ATTEMPTS) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }

  // Recreate global settings required for authentication
  await scopedConnection.insert(settings).values({
    userId: null,
    createdAt: new Date().toISOString(),
    settings: settingsToJSONBuildObject(DEFAULT_E2E_GLOBAL_SETTINGS),
  });
}

export async function truncateTables(
  connection: DatabasePg,
  tables: Array<CamelToSnake<StringKeys<NonNullable<DatabasePg["_"]["schema"]>>>>,
): Promise<void> {
  for (const table of tables) {
    await connection.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
  }
}

export async function cookieFor(
  user: UserWithCredentials,
  app: INestApplication<any>,
  referer?: string,
) {
  const loginRequest = request(app.getHttpServer()).post("/api/auth/login");

  if (referer) {
    loginRequest.set("Referer", referer.endsWith("/") ? referer : `${referer}/`);
  }

  const loginResponse = await loginRequest
    .send({
      email: user.email,
      password: user.credentials?.password,
    })
    .expect(201);

  const cookies = loginResponse.headers["set-cookie"];

  if (!cookies) {
    throw new Error(`E2E login returned no cookies for ${user.email}`);
  }

  const cookieHeaders = Array.isArray(cookies) ? cookies : [cookies];

  return cookieHeaders.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}
