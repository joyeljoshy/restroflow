import { requireIsolatedTestDatabaseUrl } from "../config/database-target.js";

type DatabaseIntegrationEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function isolatedTestDatabaseUrl(
  environment: DatabaseIntegrationEnvironment = process.env,
): string | undefined {
  if (environment.RUN_DATABASE_INTEGRATION_TESTS !== "1") return undefined;
  return requireIsolatedTestDatabaseUrl(environment);
}
