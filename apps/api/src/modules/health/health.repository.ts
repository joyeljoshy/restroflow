import type { PrismaClient } from "../../generated/prisma/client.js";

export interface HealthRepository {
  isDatabaseAvailable(): Promise<boolean>;
}

export class PrismaHealthRepository implements HealthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isDatabaseAvailable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
