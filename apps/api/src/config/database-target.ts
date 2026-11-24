export type DatabaseTargetClassification =
  | "LOCAL_LOOPBACK"
  | "REMOTE_PRODUCTION"
  | "REMOTE_OTHER"
  | "INVALID"
  | "MISSING";

export type DatabaseTargetEnvironment = Readonly<
  Record<string, string | undefined>
>;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SAFE_PRISMA_CONFIG_URL =
  "postgresql://configuration-only:configuration-only@127.0.0.1:1/prisma_configuration_only";
export const PRODUCTION_MIGRATION_CONFIRMATION =
  "APPLY_REVIEWED_PRODUCTION_MIGRATIONS";

type DatabaseTargetAnalysis = {
  classification: DatabaseTargetClassification;
  databaseName?: string;
  hostname?: string;
  isPooler?: boolean;
  invalidReason?: "URL" | "PROTOCOL" | "DATABASE_NAME";
};

function analyzeDatabaseTarget(
  value: string | undefined,
): DatabaseTargetAnalysis {
  if (!value?.trim()) return { classification: "MISSING" };

  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      return { classification: "INVALID", invalidReason: "PROTOCOL" };

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const targetOverrides = [
      "host",
      "hostaddr",
      "port",
      "database",
      "dbname",
      "service",
    ];
    if (
      value !== value.trim() ||
      url.hash ||
      [...url.searchParams.keys()].some((key) =>
        targetOverrides.includes(key.toLowerCase()),
      )
    )
      return { classification: "INVALID", invalidReason: "URL" };
    let databaseName: string;
    try {
      databaseName = decodeURIComponent(url.pathname.slice(1));
    } catch {
      return { classification: "INVALID", invalidReason: "DATABASE_NAME" };
    }
    if (!/^(?:[a-z0-9.-]+|::1)$/.test(hostname))
      return { classification: "INVALID", invalidReason: "URL" };
    if (!databaseName || databaseName.includes("/"))
      return { classification: "INVALID", invalidReason: "DATABASE_NAME" };

    if (LOOPBACK_HOSTS.has(hostname))
      return { classification: "LOCAL_LOOPBACK", databaseName };
    if (hostname.endsWith(".neon.tech"))
      return {
        classification: "REMOTE_PRODUCTION",
        databaseName,
        hostname,
        isPooler: hostname.includes("-pooler"),
      };
    return { classification: "REMOTE_OTHER", databaseName };
  } catch {
    return { classification: "INVALID", invalidReason: "URL" };
  }
}

export function classifyDatabaseTarget(
  value: string | undefined,
): DatabaseTargetClassification {
  return analyzeDatabaseTarget(value).classification;
}

function requirePresent(
  environment: DatabaseTargetEnvironment,
  name: string,
  message: string,
): string {
  const value = environment[name];
  if (!value?.trim()) throw new Error(message);
  return value;
}

function rejectConflictingUrls(
  environment: DatabaseTargetEnvironment,
  selectedUrl: string,
  names: readonly string[],
) {
  for (const name of names) {
    const value = environment[name];
    if (value?.trim() && value !== selectedUrl)
      throw new Error(
        "Conflicting database target variables are not allowed for this operation.",
      );
  }
}

export function requireIsolatedTestDatabaseUrl(
  environment: DatabaseTargetEnvironment = process.env,
): string {
  if (environment.RUN_DATABASE_INTEGRATION_TESTS !== "1")
    throw new Error(
      "RUN_DATABASE_INTEGRATION_TESTS=1 is required for database-writing tests.",
    );

  const value = requirePresent(
    environment,
    "TEST_DATABASE_URL",
    "TEST_DATABASE_URL is required when database integration tests are enabled.",
  );
  const target = analyzeDatabaseTarget(value);
  if (target.classification === "INVALID") {
    if (target.invalidReason === "PROTOCOL")
      throw new Error("TEST_DATABASE_URL must use PostgreSQL.");
    if (target.invalidReason === "DATABASE_NAME")
      throw new Error("TEST_DATABASE_URL must contain a valid database name.");
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (target.classification !== "LOCAL_LOOPBACK")
    throw new Error(
      "TEST_DATABASE_URL must use an isolated loopback database.",
    );
  if (!target.databaseName?.toLowerCase().includes("test"))
    throw new Error("TEST_DATABASE_URL database name must include 'test'.");

  rejectConflictingUrls(environment, value, [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
  ]);
  return value;
}

export function requireDevelopmentDatabaseUrl(
  environment: DatabaseTargetEnvironment = process.env,
): string {
  const value = requirePresent(
    environment,
    "DATABASE_URL",
    "DATABASE_URL is required for local database operations.",
  );
  if (analyzeDatabaseTarget(value).classification !== "LOCAL_LOOPBACK")
    throw new Error(
      "Local database operations require a valid loopback PostgreSQL target.",
    );
  rejectConflictingUrls(environment, value, [
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
  ]);
  return value;
}

export function requireProductionMigrationUrl(
  environment: DatabaseTargetEnvironment = process.env,
): string {
  if (environment.PRISMA_DATABASE_MODE !== "production")
    throw new Error("Explicit production migration mode is required.");
  if (
    environment.PRISMA_PRODUCTION_MIGRATION_CONFIRM !==
    PRODUCTION_MIGRATION_CONFIRMATION
  )
    throw new Error("Explicit production migration confirmation is required.");
  if (
    environment.RUN_DATABASE_INTEGRATION_TESTS === "1" ||
    environment.TEST_DATABASE_URL?.trim()
  )
    throw new Error(
      "Test database configuration is not allowed during production migrations.",
    );

  const directTargets = [
    environment.DATABASE_URL_UNPOOLED,
    environment.DIRECT_URL,
  ].filter((value): value is string => Boolean(value?.trim()));
  if (directTargets.length !== 1)
    throw new Error(
      "Production migrations require exactly one explicit direct database URL.",
    );

  const selected = directTargets[0]!;
  const target = analyzeDatabaseTarget(selected);
  if (target.classification !== "REMOTE_PRODUCTION" || target.isPooler)
    throw new Error(
      "Production migrations require an authorized direct production target.",
    );
  if (environment.DATABASE_URL?.trim()) {
    const runtimeTarget = analyzeDatabaseTarget(environment.DATABASE_URL);
    if (
      runtimeTarget.classification !== "REMOTE_PRODUCTION" ||
      runtimeTarget.databaseName !== target.databaseName ||
      runtimeTarget.hostname?.replace(/-pooler(?=\.)/, "") !== target.hostname
    )
      throw new Error(
        "The production runtime and migration database targets are inconsistent.",
      );
  }
  return selected;
}

export function requireBenchmarkDatabaseUrl(
  value: string | undefined,
  allowRemote: boolean,
): string {
  const target = analyzeDatabaseTarget(value);
  if (target.classification === "MISSING")
    throw new Error("DATABASE_URL is required for this database operation.");
  if (target.classification === "INVALID")
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  if (target.classification !== "LOCAL_LOOPBACK" && allowRemote !== true)
    throw new Error(
      "Refusing to use a remote database without explicit authorization.",
    );
  return value!;
}

export function requireDemoSeedDatabaseUrl(
  environment: DatabaseTargetEnvironment,
  demoEnvironment: string,
): string {
  if (demoEnvironment === "local")
    return requireDevelopmentDatabaseUrl(environment);
  if (demoEnvironment !== "production-demo")
    throw new Error("Invalid demo seed environment.");

  const value = requirePresent(
    environment,
    "DATABASE_URL",
    "DATABASE_URL is required for the explicit demo seed.",
  );
  if (classifyDatabaseTarget(value) !== "REMOTE_PRODUCTION")
    throw new Error(
      "Production demo seeding requires an authorized production target.",
    );
  return value;
}

export function resolvePrismaDatasourceUrl(
  environment: DatabaseTargetEnvironment = process.env,
): string {
  const mode = environment.PRISMA_DATABASE_MODE;
  if (!mode) {
    if (environment.PRISMA_DATABASE_URL?.trim())
      throw new Error(
        "PRISMA_DATABASE_URL cannot be used without an explicit database mode.",
      );
    return SAFE_PRISMA_CONFIG_URL;
  }

  const effectiveUrl = requirePresent(
    environment,
    "PRISMA_DATABASE_URL",
    "The guarded Prisma database URL is missing.",
  );
  const expectedUrl =
    mode === "test"
      ? requireIsolatedTestDatabaseUrl(environment)
      : mode === "development"
        ? requireDevelopmentDatabaseUrl(environment)
        : mode === "production"
          ? requireProductionMigrationUrl(environment)
          : undefined;
  if (!expectedUrl) throw new Error("Invalid Prisma database mode.");
  if (effectiveUrl !== expectedUrl)
    throw new Error("The guarded Prisma database target is inconsistent.");
  return effectiveUrl;
}
