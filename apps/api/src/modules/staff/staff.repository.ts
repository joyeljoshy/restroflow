import type {
  Role,
  StaffListQuery,
  UpdateStaffRequest,
} from "@restroflow/contracts";

import type { PrismaClient } from "../../generated/prisma/client.js";

export type StaffRecord = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateStaffRecord = {
  displayName: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export interface StaffRepository {
  withTransaction<T>(
    operation: (repository: StaffRepository) => Promise<T>,
  ): Promise<T>;
  list(restaurantId: string, query: StaffListQuery): Promise<StaffRecord[]>;
  findById(restaurantId: string, staffId: string): Promise<StaffRecord | null>;
  emailExists(email: string, excludingUserId?: string): Promise<boolean>;
  create(restaurantId: string, input: CreateStaffRecord): Promise<StaffRecord>;
  update(
    restaurantId: string,
    staffId: string,
    input: UpdateStaffRequest,
  ): Promise<StaffRecord>;
  countActiveAdmins(restaurantId: string): Promise<number>;
  countActiveMemberships(userId: string): Promise<number>;
  setUserActive(userId: string, isActive: boolean): Promise<void>;
  revokeSessions(userId: string, revokedAt: Date): Promise<void>;
}

const staffSelection = {
  id: true,
  userId: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { displayName: true, email: true } },
} as const;

type SelectedStaff = {
  id: string;
  userId: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { displayName: string; email: string };
};

function toStaffRecord(record: SelectedStaff): StaffRecord {
  return {
    id: record.id,
    userId: record.userId,
    displayName: record.user.displayName,
    email: record.user.email,
    role: record.role,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaStaffRepository implements StaffRepository {
  constructor(private readonly prisma: PrismaClient) {}

  withTransaction<T>(
    operation: (repository: StaffRepository) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (transaction) =>
        operation(
          new PrismaStaffRepository(transaction as unknown as PrismaClient),
        ),
      { isolationLevel: "Serializable" },
    );
  }

  async list(
    restaurantId: string,
    query: StaffListQuery,
  ): Promise<StaffRecord[]> {
    const records = await this.prisma.staffMembership.findMany({
      where: {
        restaurantId,
        ...(query.role ? { role: query.role } : {}),
        ...(query.status === "all"
          ? {}
          : { isActive: query.status === "active" }),
        ...(query.search
          ? {
              user: {
                OR: [
                  {
                    displayName: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    email: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            }
          : {}),
      },
      select: staffSelection,
      orderBy: [{ isActive: "desc" }, { user: { displayName: "asc" } }],
    });
    return records.map(toStaffRecord);
  }

  async findById(
    restaurantId: string,
    staffId: string,
  ): Promise<StaffRecord | null> {
    const record = await this.prisma.staffMembership.findFirst({
      where: { id: staffId, restaurantId },
      select: staffSelection,
    });
    return record ? toStaffRecord(record) : null;
  }

  async emailExists(email: string, excludingUserId?: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        email,
        ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
      },
    });
    return count > 0;
  }

  async create(
    restaurantId: string,
    input: CreateStaffRecord,
  ): Promise<StaffRecord> {
    const user = await this.prisma.user.create({
      data: {
        displayName: input.displayName,
        email: input.email,
        passwordHash: input.passwordHash,
        memberships: {
          create: { restaurantId, role: input.role },
        },
      },
      select: { memberships: { select: staffSelection } },
    });
    const membership = user.memberships[0];
    if (!membership) throw new Error("Staff membership was not created.");
    return toStaffRecord(membership);
  }

  async update(
    restaurantId: string,
    staffId: string,
    input: UpdateStaffRequest,
  ): Promise<StaffRecord> {
    const membership = await this.prisma.staffMembership.update({
      where: { id: staffId, restaurantId },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.displayName || input.email
          ? {
              user: {
                update: {
                  ...(input.displayName
                    ? { displayName: input.displayName }
                    : {}),
                  ...(input.email ? { email: input.email } : {}),
                },
              },
            }
          : {}),
      },
      select: staffSelection,
    });
    return toStaffRecord(membership);
  }

  countActiveAdmins(restaurantId: string): Promise<number> {
    return this.prisma.staffMembership.count({
      where: { restaurantId, role: "ADMIN", isActive: true },
    });
  }

  countActiveMemberships(userId: string): Promise<number> {
    return this.prisma.staffMembership.count({
      where: { userId, isActive: true },
    });
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async revokeSessions(userId: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
