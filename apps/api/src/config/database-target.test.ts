import { parse, populate } from "dotenv";
import { describe, expect, it } from "vitest";

import {
  classifyDatabaseTarget,
  PRODUCTION_MIGRATION_CONFIRMATION,
  requireIsolatedTestDatabaseUrl,
  requireProductionMigrationUrl,
  resolvePrismaDatasourceUrl,
} from "./database-target.js";

const localTestUrl =
  "postgresql://local_user:local_password@127.0.0.1:5432/restroflow_test";
const remoteProductionUrl =
  "postgresql://remote_user:remote_password@ep-example.neon.tech/restroflow";

describe("database target classification", () => {
  it.each([
    [undefined, "MISSING"],
    ["not-a-url", "INVALID"],
    ["mysql://127.0.0.1/restroflow_test", "INVALID"],
    ["postgresql://127.0.0.1/restroflow_test?host=remote.example", "INVALID"],
    ["postgresql://127.0.0.1/", "INVALID"],
    [localTestUrl, "LOCAL_LOOPBACK"],
    [remoteProductionUrl, "REMOTE_PRODUCTION"],
    ["postgresql://user:password@database.example/restroflow", "REMOTE_OTHER"],
  ] as const)("classifies sanitized target %#", (value, classification) => {
    expect(classifyDatabaseTarget(value)).toBe(classification);
  });
});

describe("isolated test database selection", () => {
  it("requires explicit test mode and URL", () => {
    expect(() =>
      requireIsolatedTestDatabaseUrl({ TEST_DATABASE_URL: localTestUrl }),
    ).toThrow("RUN_DATABASE_INTEGRATION_TESTS=1");
    expect(() =>
      requireIsolatedTestDatabaseUrl({
        RUN_DATABASE_INTEGRATION_TESTS: "1",
      }),
    ).toThrow("TEST_DATABASE_URL is required");
  });

  it.each([
    ["malformed", "not-a-url", "valid PostgreSQL URL"],
    ["wrong protocol", "mysql://127.0.0.1/restroflow_test", "use PostgreSQL"],
    ["remote", remoteProductionUrl, "isolated loopback database"],
    [
      "non-test database",
      "postgresql://user:password@127.0.0.1/restroflow",
      "database name must include 'test'",
    ],
  ])("rejects %s", (_case, value, message) => {
    expect(() =>
      requireIsolatedTestDatabaseUrl({
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        TEST_DATABASE_URL: value,
      }),
    ).toThrow(message);
  });

  it.each(["DATABASE_URL_UNPOOLED", "DIRECT_URL"])(
    "rejects incident-style conflict from %s",
    (name) => {
      expect(() =>
        requireIsolatedTestDatabaseUrl({
          RUN_DATABASE_INTEGRATION_TESTS: "1",
          TEST_DATABASE_URL: localTestUrl,
          DATABASE_URL: localTestUrl,
          [name]: remoteProductionUrl,
        }),
      ).toThrow("Conflicting database target variables");
    },
  );

  it("accepts one unambiguous loopback test target", () => {
    expect(
      requireIsolatedTestDatabaseUrl({
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        TEST_DATABASE_URL: localTestUrl,
        DATABASE_URL: localTestUrl,
      }),
    ).toBe(localTestUrl);
  });
});

describe("production migration selection", () => {
  const productionEnvironment = {
    PRISMA_DATABASE_MODE: "production",
    PRISMA_PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRMATION,
    DIRECT_URL: remoteProductionUrl,
  } as const;

  it("requires a separate mode and confirmation", () => {
    expect(() =>
      requireProductionMigrationUrl({ DIRECT_URL: remoteProductionUrl }),
    ).toThrow("production migration mode");
    expect(() =>
      requireProductionMigrationUrl({
        PRISMA_DATABASE_MODE: "production",
        DIRECT_URL: remoteProductionUrl,
      }),
    ).toThrow("production migration confirmation");
  });

  it("rejects test mode and ambiguous direct URLs", () => {
    expect(() =>
      requireProductionMigrationUrl({
        ...productionEnvironment,
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        TEST_DATABASE_URL: localTestUrl,
      }),
    ).toThrow("Test database configuration");
    expect(() =>
      requireProductionMigrationUrl({
        ...productionEnvironment,
        DATABASE_URL_UNPOOLED: remoteProductionUrl,
      }),
    ).toThrow("exactly one explicit direct database URL");
  });

  it("rejects incorrect confirmation and refuses to fall back to the runtime URL", () => {
    expect(() =>
      requireProductionMigrationUrl({
        ...productionEnvironment,
        PRISMA_PRODUCTION_MIGRATION_CONFIRM: "incorrect",
      }),
    ).toThrow("production migration confirmation");
    expect(() =>
      requireProductionMigrationUrl({
        ...productionEnvironment,
        DIRECT_URL: undefined,
        DATABASE_URL: remoteProductionUrl,
      }),
    ).toThrow("exactly one explicit direct database URL");
  });

  it("rejects a pooler as the direct URL and mismatched runtime targets", () => {
    expect(() =>
      requireProductionMigrationUrl({
        ...productionEnvironment,
        DIRECT_URL: remoteProductionUrl.replace(
          "ep-example.",
          "ep-example-pooler.",
        ),
      }),
    ).toThrow("direct production target");
    expect(() =>
      requireProductionMigrationUrl({
        ...productionEnvironment,
        DATABASE_URL: remoteProductionUrl.replace("ep-example", "ep-other"),
      }),
    ).toThrow("targets are inconsistent");
  });

  it("accepts one explicitly confirmed direct production target", () => {
    expect(requireProductionMigrationUrl(productionEnvironment)).toBe(
      remoteProductionUrl,
    );
    expect(
      requireProductionMigrationUrl({
        ...productionEnvironment,
        DATABASE_URL: remoteProductionUrl.replace(
          "ep-example.",
          "ep-example-pooler.",
        ),
      }),
    ).toBe(remoteProductionUrl);
  });
});

describe("Prisma datasource resolution", () => {
  it("reproduces and rejects the dotenv precedence incident", () => {
    const environment: Record<string, string> = {
      PRISMA_DATABASE_MODE: "test",
      PRISMA_DATABASE_URL: localTestUrl,
      RUN_DATABASE_INTEGRATION_TESTS: "1",
      TEST_DATABASE_URL: localTestUrl,
      DATABASE_URL: localTestUrl,
    };
    populate(
      environment,
      parse(
        `DATABASE_URL=${remoteProductionUrl}\nDATABASE_URL_UNPOOLED=${remoteProductionUrl}`,
      ),
    );
    expect(environment.DATABASE_URL).toBe(localTestUrl);
    expect(
      environment.DATABASE_URL_UNPOOLED ??
        environment.DIRECT_URL ??
        environment.DATABASE_URL,
    ).toBe(remoteProductionUrl);
    expect(() => resolvePrismaDatasourceUrl(environment)).toThrow(
      "Conflicting database target variables",
    );
  });

  it("rejects an effective URL without an explicit mode", () => {
    expect(() =>
      resolvePrismaDatasourceUrl({ PRISMA_DATABASE_URL: remoteProductionUrl }),
    ).toThrow("without an explicit database mode");
  });

  it("resolves a guarded test target", () => {
    expect(
      resolvePrismaDatasourceUrl({
        PRISMA_DATABASE_MODE: "test",
        PRISMA_DATABASE_URL: localTestUrl,
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        TEST_DATABASE_URL: localTestUrl,
        DATABASE_URL: localTestUrl,
        DATABASE_URL_UNPOOLED: localTestUrl,
        DIRECT_URL: localTestUrl,
      }),
    ).toBe(localTestUrl);
  });
});
