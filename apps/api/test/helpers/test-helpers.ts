import { sql } from "drizzle-orm";
import request from "supertest";

import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { settings } from "../../src/storage/schema";

import type { DatabasePg } from "../../src/common";
import type { INestApplication } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { UserWithCredentials } from "test/factory/user.factory";

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

  // Disable FK constraints during truncate to prevent deadlocks with async operations
  // session_replication_role = 'replica' disables all triggers including FK checks
  await connection.execute(
    sql.raw(`
      SET session_replication_role = 'replica';
      TRUNCATE TABLE ${tableNames} RESTART IDENTITY;
      SET session_replication_role = 'origin';
      `),
  );

  // Recreate global settings required for authentication
  await scopedConnection.insert(settings).values({
    userId: null,
    createdAt: new Date().toISOString(),
    settings: settingsToJSONBuildObject(DEFAULT_GLOBAL_SETTINGS),
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

export async function cookieFor(user: UserWithCredentials, app: INestApplication<any>) {
  const loginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
    email: user.email,
    password: user.credentials?.password,
  });

  return loginResponse.headers["set-cookie"];
}
