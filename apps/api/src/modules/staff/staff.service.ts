import type {
  CreateStaffRequest,
  StaffListQuery,
  StaffMember,
  UpdateStaffRequest,
} from "@restroflow/contracts";

import { AppError } from "../../errors/app-error.js";
import type { PasswordHasher } from "../auth/auth.service.js";
import type { StaffRecord, StaffRepository } from "./staff.repository.js";

export interface StaffServiceContract {
  list(
    restaurantId: string,
    query: StaffListQuery,
  ): Promise<{ staff: StaffMember[]; total: number }>;
  create(restaurantId: string, input: CreateStaffRequest): Promise<StaffMember>;
  update(
    restaurantId: string,
    staffId: string,
    input: UpdateStaffRequest,
  ): Promise<StaffMember>;
}

function toStaffMember(record: StaffRecord): StaffMember {
  return {
    id: record.id,
    displayName: record.displayName,
    email: record.email,
    role: record.role,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export class StaffService implements StaffServiceContract {
  constructor(
    private readonly repository: StaffRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(
    restaurantId: string,
    query: StaffListQuery,
  ): Promise<{ staff: StaffMember[]; total: number }> {
    const records = await this.repository.list(restaurantId, query);
    return { staff: records.map(toStaffMember), total: records.length };
  }

  async create(
    restaurantId: string,
    input: CreateStaffRequest,
  ): Promise<StaffMember> {
    const passwordHash = await this.passwordHasher.hash(input.password);

    try {
      const record = await this.repository.withTransaction(
        async (repository) => {
          if (await repository.emailExists(input.email)) {
            throw this.emailConflict();
          }
          return repository.create(restaurantId, {
            displayName: input.displayName,
            email: input.email,
            passwordHash,
            role: input.role,
          });
        },
      );
      return toStaffMember(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw this.emailConflict();
      throw error;
    }
  }

  async update(
    restaurantId: string,
    staffId: string,
    input: UpdateStaffRequest,
  ): Promise<StaffMember> {
    try {
      const record = await this.repository.withTransaction(
        async (repository) => {
          const current = await repository.findById(restaurantId, staffId);
          if (!current) {
            throw new AppError(
              404,
              "STAFF_NOT_FOUND",
              "Staff member not found.",
            );
          }

          const removesActiveAdmin =
            current.isActive &&
            current.role === "ADMIN" &&
            (input.isActive === false ||
              (input.role !== undefined && input.role !== "ADMIN"));
          if (
            removesActiveAdmin &&
            (await repository.countActiveAdmins(restaurantId)) <= 1
          ) {
            throw new AppError(
              409,
              "LAST_ACTIVE_ADMIN",
              "The restaurant must retain at least one active admin.",
            );
          }

          if (
            input.email &&
            input.email !== current.email &&
            (await repository.emailExists(input.email, current.userId))
          ) {
            throw this.emailConflict();
          }

          const updated = await repository.update(restaurantId, staffId, input);
          if (input.isActive !== undefined) {
            const hasActiveMembership =
              (await repository.countActiveMemberships(current.userId)) > 0;
            await repository.setUserActive(current.userId, hasActiveMembership);
          }

          const roleChanged =
            input.role !== undefined && input.role !== current.role;
          const statusChanged =
            input.isActive !== undefined && input.isActive !== current.isActive;
          if (roleChanged || statusChanged) {
            await repository.revokeSessions(current.userId, this.now());
          }
          return updated;
        },
      );
      return toStaffMember(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw this.emailConflict();
      throw error;
    }
  }

  private emailConflict(): AppError {
    return new AppError(
      409,
      "STAFF_EMAIL_CONFLICT",
      "A staff account already uses that email address.",
    );
  }
}
