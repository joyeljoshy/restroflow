import { z } from "zod";

export const roleSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "WAITER",
  "KITCHEN",
  "CASHIER",
]);

export type Role = z.infer<typeof roleSchema>;

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid work email.")),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const staffMembershipSchema = z.object({
  restaurantId: z.uuid(),
  restaurantName: z.string().min(1),
  role: roleSchema,
});

export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  memberships: z.array(staffMembershipSchema),
});

export const authResponseSchema = z.object({
  user: authenticatedUserSchema,
});

export type StaffMembership = z.infer<typeof staffMembershipSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
