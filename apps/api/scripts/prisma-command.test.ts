import { describe, expect, it } from "vitest";

import { PRODUCTION_MIGRATION_CONFIRMATION } from "../src/config/database-target.js";
import {
  preparePrismaCommand,
  redactDatabaseOutput,
} from "./prisma-command.js";

const localTestUrl =
  "postgresql://sensitive_user:sensitive_password@127.0.0.1:5432/restroflow_test";
const remoteProductionUrl =
  "postgresql://production_user:production_password@ep-example.neon.tech/restroflow";

describe("guarded Prisma command preparation", () => {
  it("prepares production commands only from the explicitly confirmed direct URL", () => {
    const environment = {
      PRISMA_DATABASE_MODE: "production",
      PRISMA_PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRMATION,
      DIRECT_URL: remoteProductionUrl,
    };
    const command = preparePrismaCommand("migrate-production", environment);
    expect(command.args).toEqual(["migrate", "deploy"]);
    expect(command.classification).toBe("REMOTE_PRODUCTION");
    expect(command.environment.PRISMA_DATABASE_URL).toBe(remoteProductionUrl);
    expect(
      preparePrismaCommand("migrate-production", environment, ["--status"])
        .args,
    ).toEqual(["migrate", "status"]);
  });

  it.each(["migrate-development", "studio"] as const)(
    "blocks target selection overrides for %s",
    (operation) => {
      expect(() =>
        preparePrismaCommand(operation, { DATABASE_URL: localTestUrl }, [
          "--url",
          remoteProductionUrl,
        ]),
      ).toThrow("Unsupported arguments");
    },
  );

  it("constructs an explicit test-only child environment", () => {
    const command = preparePrismaCommand("migrate-test", {
      RUN_DATABASE_INTEGRATION_TESTS: "1",
      TEST_DATABASE_URL: localTestUrl,
      DATABASE_URL: localTestUrl,
    });

    expect(command.args).toEqual(["migrate", "deploy"]);
    expect(command.classification).toBe("LOCAL_LOOPBACK");
    expect(command.environment).toMatchObject({
      PRISMA_DATABASE_MODE: "test",
      PRISMA_DATABASE_URL: localTestUrl,
      TEST_DATABASE_URL: localTestUrl,
      DATABASE_URL: localTestUrl,
      DATABASE_URL_UNPOOLED: localTestUrl,
      DIRECT_URL: localTestUrl,
    });
  });

  it("rejects remote precedence before a child process can start", () => {
    expect(() =>
      preparePrismaCommand("migrate-test", {
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        TEST_DATABASE_URL: localTestUrl,
        DATABASE_URL: localTestUrl,
        DATABASE_URL_UNPOOLED: remoteProductionUrl,
      }),
    ).toThrow("Conflicting database target variables");
  });

  it("redacts URLs, credentials, and hosts from child output", () => {
    const output = [
      `Datasource "db": PostgreSQL at "127.0.0.1:5432"`,
      localTestUrl,
      "sensitive_user sensitive_password 127.0.0.1",
    ].join("\n");
    const sanitized = redactDatabaseOutput(
      output,
      localTestUrl,
      "LOCAL_LOOPBACK",
    );

    expect(sanitized).toContain("Datasource target: LOCAL_LOOPBACK");
    expect(sanitized).not.toContain("sensitive_user");
    expect(sanitized).not.toContain("sensitive_password");
    expect(sanitized).not.toContain("127.0.0.1");
    expect(sanitized).not.toContain("postgresql://");
  });
});
