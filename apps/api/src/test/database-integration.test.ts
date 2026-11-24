import { describe, expect, it } from "vitest";

import { isolatedTestDatabaseUrl } from "./database-integration.js";

describe("database integration test configuration", () => {
  it("stays disabled and ignores DATABASE_URL without the explicit run flag", () => {
    expect(
      isolatedTestDatabaseUrl({
        DATABASE_URL: "postgresql://production.example/restroflow",
      }),
    ).toBeUndefined();
  });

  it("requires TEST_DATABASE_URL and never falls back to DATABASE_URL", () => {
    expect(() =>
      isolatedTestDatabaseUrl({
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        DATABASE_URL: "postgresql://production.example/restroflow",
      }),
    ).toThrow(
      "TEST_DATABASE_URL is required when database integration tests are enabled.",
    );
  });

  it.each([
    ["malformed", "not-a-database-url", "valid PostgreSQL URL"],
    ["wrong protocol", "mysql://127.0.0.1/restroflow_test", "use PostgreSQL"],
    [
      "remote host",
      "postgresql://user:password@production.example/restroflow_test",
      "isolated loopback database",
    ],
    [
      "non-test database",
      "postgresql://user:password@127.0.0.1/restroflow",
      "database name must include 'test'",
    ],
    [
      "malformed database name",
      "postgresql://user:password@127.0.0.1/restroflow_test%ZZ",
      "valid database name",
    ],
  ])("rejects %s configuration", (_case, value, message) => {
    expect(() =>
      isolatedTestDatabaseUrl({
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        TEST_DATABASE_URL: value,
      }),
    ).toThrow(message);
  });

  it.each([
    "postgresql://user:password@127.0.0.1:5432/restroflow_test",
    "postgres://user:password@localhost:5432/integration_test",
    "postgresql://user:password@[::1]:5432/restroflow_test",
  ])("accepts isolated PostgreSQL test URL %s", (value) => {
    expect(
      isolatedTestDatabaseUrl({
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        TEST_DATABASE_URL: value,
      }),
    ).toBe(value);
  });
});
