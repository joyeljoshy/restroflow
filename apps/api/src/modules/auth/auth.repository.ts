import type { Role } from "@restroflow/contracts";

import type { PrismaClient } from "../../generated/prisma/client.js";

export type AuthMembershipRecord = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  role: Role;
};

export type AuthUserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
  memberships: AuthMembershipRecord[];
};

export type SessionRecord = {
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUserRecord;
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;
}

const userSelection = {
  id: true,
  email: true,
  displayName: true,
  passwordHash: true,
  isActive: true,
  memberships: {
    where: { isActive: true },
    select: {
      id: true,
      restaurantId: true,
      role: true,
      restaurant: { select: { name: true } },
    },
  },
} as const;

type SelectedUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
  memberships: {
    id: string;
    restaurantId: string;
    role: Role;
    restaurant: { name: string };
  }[];
};

function toAuthUser(user: SelectedUser): AuthUserRecord {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    isActive: user.isActive,
    memberships: user.memberships.map((membership) => ({
      id: membership.id,
      restaurantId: membership.restaurantId,
      restaurantName: membership.restaurant.name,
      role: membership.role,
    })),
  };
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: userSelection,
    });
    return user ? toAuthUser(user) : null;
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.session.create({ data: input });
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      select: {
        tokenHash: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: userSelection },
      },
    });
    return session ? { ...session, user: toAuthUser(session.user) } : null;
  }

  async revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }
}
