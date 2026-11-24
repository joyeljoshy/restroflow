const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

type DatabaseIntegrationEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function isolatedTestDatabaseUrl(
  environment: DatabaseIntegrationEnvironment = process.env,
): string | undefined {
  if (environment.RUN_DATABASE_INTEGRATION_TESTS !== "1") return undefined;

  const value = environment.TEST_DATABASE_URL;
  if (!value)
    throw new Error(
      "TEST_DATABASE_URL is required when database integration tests are enabled.",
    );

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("TEST_DATABASE_URL must use PostgreSQL.");

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!LOOPBACK_HOSTS.has(hostname))
    throw new Error(
      "TEST_DATABASE_URL must use an isolated loopback database.",
    );

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("TEST_DATABASE_URL must contain a valid database name.");
  }
  if (!databaseName.toLowerCase().includes("test"))
    throw new Error("TEST_DATABASE_URL database name must include 'test'.");

  return value;
}
