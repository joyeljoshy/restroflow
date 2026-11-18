import { createHash, randomBytes } from "node:crypto";

import type {
  AuthenticatedUser,
  LoginRequest,
  StaffMembership,
} from "@restroflow/contracts";
import argon2 from "argon2";

import { AppError } from "../../errors/app-error.js";
import type { AuthRepository, AuthUserRecord } from "./auth.repository.js";

const INVALID_CREDENTIAL_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$cnHZMw5loXg9bkjo3aqmdQ$KKbPWjvjPXwP3jynCxLBBJob2UT1jx/JI5pM/yM+0Z0";

export type AuthSession = {
  user: AuthenticatedUser;
  sessionTokenHash: string;
};

export interface AuthServiceContract {
  login(input: LoginRequest): Promise<{
    user: AuthenticatedUser;
    sessionToken: string;
    expiresAt: Date;
  }>;
  authenticate(sessionToken: string | undefined): Promise<AuthSession>;
  logout(sessionToken: string | undefined): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    memberships: user.memberships.map((membership): StaffMembership => ({
      ...membership,
    })),
  };
}

export class AuthService implements AuthServiceContract {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionTtlMs: number,
    private readonly now: () => Date = () => new Date(),
    private readonly createToken: () => string = () =>
      randomBytes(32).toString("base64url"),
  ) {}

  async login(input: LoginRequest) {
    const user = await this.repository.findUserByEmail(input.email);
    const passwordValid = await this.passwordHasher.verify(
      user?.passwordHash ?? INVALID_CREDENTIAL_PASSWORD_HASH,
      input.password,
    );

    if (!user || !passwordValid || !user.isActive || !user.memberships.length) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "The email or password is incorrect.",
      );
    }

    const sessionToken = this.createToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs);
    await this.repository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return { user: toAuthenticatedUser(user), sessionToken, expiresAt };
  }

  async authenticate(sessionToken: string | undefined): Promise<AuthSession> {
    if (!sessionToken) this.throwUnauthenticated();

    const tokenHash = hashSessionToken(sessionToken);
    const session = await this.repository.findSessionByTokenHash(tokenHash);

    if (!session || session.revokedAt) this.throwUnauthenticated();

    if (session.expiresAt.getTime() <= this.now().getTime()) {
      await this.repository.revokeSession(tokenHash, this.now());
      this.throwUnauthenticated();
    }

    if (!session.user.isActive || !session.user.memberships.length) {
      await this.repository.revokeSession(tokenHash, this.now());
      this.throwUnauthenticated();
    }

    return {
      user: toAuthenticatedUser(session.user),
      sessionTokenHash: tokenHash,
    };
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    await this.repository.revokeSession(
      hashSessionToken(sessionToken),
      this.now(),
    );
  }

  private throwUnauthenticated(): never {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "A valid staff session is required.",
    );
  }
}
