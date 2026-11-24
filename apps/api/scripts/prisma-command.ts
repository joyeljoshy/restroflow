import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  classifyDatabaseTarget,
  requireDevelopmentDatabaseUrl,
  requireIsolatedTestDatabaseUrl,
  requireProductionMigrationUrl,
  type DatabaseTargetClassification,
  type DatabaseTargetEnvironment,
} from "../src/config/database-target.js";

type GuardedPrismaOperation =
  "migrate-development" | "migrate-test" | "migrate-production" | "studio";

export type PreparedPrismaCommand = {
  args: string[];
  classification: DatabaseTargetClassification;
  databaseUrl: string;
  environment: NodeJS.ProcessEnv;
};

function guardedChildEnvironment(
  environment: DatabaseTargetEnvironment,
  mode: "development" | "test" | "production",
  databaseUrl: string,
): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {
    ...environment,
    PRISMA_DATABASE_MODE: mode,
    PRISMA_DATABASE_URL: databaseUrl,
  };
  if (mode !== "production") {
    child.DATABASE_URL = databaseUrl;
    child.DATABASE_URL_UNPOOLED = databaseUrl;
    child.DIRECT_URL = databaseUrl;
  }
  return child;
}

export function preparePrismaCommand(
  operation: GuardedPrismaOperation,
  environment: DatabaseTargetEnvironment,
  forwardedArgs: readonly string[] = [],
): PreparedPrismaCommand {
  const productionStatus =
    operation === "migrate-production" &&
    forwardedArgs.length === 1 &&
    forwardedArgs[0] === "--status";
  if (
    operation !== "migrate-development" &&
    !productionStatus &&
    forwardedArgs.length > 0
  )
    throw new Error("Unsupported arguments for this guarded Prisma operation.");
  if (operation === "migrate-development") {
    const args = [...forwardedArgs];
    while (args.length) {
      const argument = args.shift();
      if (argument === "--create-only") continue;
      if (argument === "--name" && /^[\w][\w-]*$/.test(args.shift() ?? ""))
        continue;
      throw new Error(
        "Unsupported arguments for this guarded Prisma operation.",
      );
    }
  }
  if (operation === "migrate-test") {
    const databaseUrl = requireIsolatedTestDatabaseUrl(environment);
    return {
      args: ["migrate", "deploy"],
      classification: "LOCAL_LOOPBACK",
      databaseUrl,
      environment: guardedChildEnvironment(environment, "test", databaseUrl),
    };
  }

  if (operation === "migrate-production") {
    const databaseUrl = requireProductionMigrationUrl(environment);
    return {
      args: ["migrate", productionStatus ? "status" : "deploy"],
      classification: "REMOTE_PRODUCTION",
      databaseUrl,
      environment: guardedChildEnvironment(
        environment,
        "production",
        databaseUrl,
      ),
    };
  }

  const databaseUrl = requireDevelopmentDatabaseUrl(environment);
  return {
    args:
      operation === "studio"
        ? ["studio"]
        : ["migrate", "dev", ...forwardedArgs],
    classification: classifyDatabaseTarget(databaseUrl),
    databaseUrl,
    environment: guardedChildEnvironment(
      environment,
      "development",
      databaseUrl,
    ),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactDatabaseOutput(
  output: string,
  databaseUrl: string,
  classification: DatabaseTargetClassification,
): string {
  let sanitized = output.replace(
    /Datasource "db":[^\r\n]*/gi,
    `Datasource target: ${classification}`,
  );
  const url = new URL(databaseUrl);
  const sensitiveValues = [
    databaseUrl,
    url.username,
    url.password,
    url.hostname,
  ].filter((value) => value.length >= 3);
  for (const value of sensitiveValues) {
    sanitized = sanitized.replace(
      new RegExp(escapeRegExp(value), "gi"),
      "[REDACTED]",
    );
  }
  return sanitized.replace(
    /postgres(?:ql)?:\/\/[^\s"'`]+/gi,
    "[REDACTED_DATABASE_URL]",
  );
}

async function execute(command: PreparedPrismaCommand): Promise<number> {
  console.info(`Database target validated: ${command.classification}.`);
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("prisma/package.json");
  const prismaPackage = require(packagePath) as { bin: { prisma: string } };
  const prismaCli = resolve(dirname(packagePath), prismaPackage.bin.prisma);
  if (command.args[0] === "studio") {
    const child = spawn(process.execPath, [prismaCli, ...command.args], {
      cwd: new URL("..", import.meta.url),
      env: command.environment,
      stdio: ["inherit", "pipe", "pipe"],
    });
    for (const [input, output] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ] as const) {
      createInterface({ input }).on("line", (line) => {
        output.write(
          redactDatabaseOutput(
            line,
            command.databaseUrl,
            command.classification,
          ) + "\n",
        );
      });
    }
    return new Promise((resolve) => {
      child.once("error", () => resolve(1));
      child.once("close", (status) => resolve(status ?? 1));
    });
  }
  const result = spawnSync(process.execPath, [prismaCli, ...command.args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: command.environment,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (command.classification === "REMOTE_PRODUCTION") {
    if (result.status === 0)
      console.info("Production migration command completed.");
    else
      console.error(
        "Production migration command failed. Consult the deployment runbook.",
      );
    return result.status ?? 1;
  }
  if (result.stdout)
    process.stdout.write(
      redactDatabaseOutput(
        result.stdout,
        command.databaseUrl,
        command.classification,
      ),
    );
  if (result.stderr)
    process.stderr.write(
      redactDatabaseOutput(
        result.stderr,
        command.databaseUrl,
        command.classification,
      ),
    );
  if (result.error) {
    console.error("The guarded Prisma command could not be started.");
    return 1;
  }
  return result.status ?? 1;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;
if (entryPoint) {
  const [operation, ...forwardedArgs] = process.argv.slice(2);
  if (
    ![
      "migrate-development",
      "migrate-test",
      "migrate-production",
      "studio",
    ].includes(operation ?? "")
  ) {
    console.error("A supported guarded Prisma operation is required.");
    process.exitCode = 1;
  } else {
    try {
      process.exitCode = await execute(
        preparePrismaCommand(
          operation as GuardedPrismaOperation,
          process.env,
          forwardedArgs,
        ),
      );
    } catch (error) {
      console.error(
        error instanceof Error
          ? error.message
          : "Database target validation failed.",
      );
      process.exitCode = 1;
    }
  }
}
