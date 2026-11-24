import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoSeedTransactionOptions } from "./demo-seed.config.js";

type TransactionOptions = {
  maxWait: number;
  timeout: number;
};

const testState = vi.hoisted(() => ({
  attemptedWrites: [] as string[],
  committedWrites: [] as string[],
  disconnects: 0,
  failAtWrite: null as number | null,
  transactionOptions: null as TransactionOptions | null,
}));

function transactionClient() {
  return new Proxy<Record<string, unknown>>(
    {},
    {
      get: (_target, model) => ({
        upsert: () => {
          const label = `${String(model)}.upsert`;
          testState.attemptedWrites.push(label);
          if (testState.attemptedWrites.length === testState.failAtWrite)
            throw new Error("Injected transaction failure");
          return Promise.resolve({});
        },
      }),
    },
  );
}

vi.mock("../src/lib/prisma.js", () => ({
  createPrismaClient: () => ({
    $queryRaw: () => Promise.resolve([{ value: 1 }]),
    restaurant: { findUnique: () => Promise.resolve(null) },
    $transaction: async (
      work: (
        transaction: ReturnType<typeof transactionClient>,
      ) => Promise<void>,
      options: TransactionOptions,
    ) => {
      testState.transactionOptions = options;
      const stagedStart = testState.attemptedWrites.length;
      await work(transactionClient());
      testState.committedWrites.push(
        ...testState.attemptedWrites.slice(stagedStart),
      );
    },
    $disconnect: () => {
      testState.disconnects += 1;
      return Promise.resolve();
    },
  }),
}));

vi.mock("../src/modules/auth/auth.service.js", () => ({
  Argon2PasswordHasher: class {
    hash(password: string) {
      return Promise.resolve(`hashed:${password.length}`);
    }
  },
}));

function testPassword(role: string, index: number): string {
  return `${role}-${"x".repeat(24)}-${index}`;
}

const environment = {
  DATABASE_URL: "postgresql://fixture@127.0.0.1/restroflow_test",
  DEMO_SEED_DATABASE_LABEL: "isolated-test",
  DEMO_SEED_ENVIRONMENT: "local",
  DEMO_SEED_CONFIRM: "CREATE_THE_URBAN_TABLE",
  DEMO_SEED_ADMIN_PASSWORD: testPassword("admin", 1),
  DEMO_SEED_MANAGER_PASSWORD: testPassword("manager", 2),
  DEMO_SEED_WAITER_PASSWORD: testPassword("waiter", 3),
  DEMO_SEED_KITCHEN_PASSWORD: testPassword("kitchen", 4),
  DEMO_SEED_CASHIER_PASSWORD: testPassword("cashier", 5),
} as const;

describe("production demo seed transaction", () => {
  beforeEach(() => {
    vi.resetModules();
    testState.attemptedWrites = [];
    testState.committedWrites = [];
    testState.disconnects = 0;
    testState.failAtWrite = null;
    testState.transactionOptions = null;
    Object.assign(process.env, environment);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const name of Object.keys(environment)) delete process.env[name];
    vi.restoreAllMocks();
  });

  it("stages all 73 deterministic writes with a bounded 60-second timeout", async () => {
    await import("./demo-seed.js");

    expect(testState.transactionOptions).toEqual(demoSeedTransactionOptions);
    expect(testState.attemptedWrites).toHaveLength(73);
    expect(testState.committedWrites).toHaveLength(73);
    expect(testState.disconnects).toBe(1);
  });

  it("commits no staged writes when the transaction fails partway through", async () => {
    testState.failAtWrite = 47;

    await expect(import("./demo-seed.js")).rejects.toThrow(
      "Injected transaction failure",
    );

    expect(testState.attemptedWrites).toHaveLength(47);
    expect(testState.committedWrites).toHaveLength(0);
    expect(testState.disconnects).toBe(1);
  });
});
