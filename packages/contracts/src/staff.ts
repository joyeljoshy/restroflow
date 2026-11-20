import { z } from "zod";

import { roleSchema } from "./auth.js";

export const staffIdParamsSchema = z.object({
  restaurantId: z.uuid(),
  staffId: z.uuid(),
});

export const staffMemberSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  email: z.email(),
  role: roleSchema,
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const staffListResponseSchema = z.object({
  staff: z.array(staffMemberSchema),
  total: z.number().int().nonnegative(),
});

export const staffResponseSchema = z.object({
  staffMember: staffMemberSchema,
});

export const staffListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    role: roleSchema.optional(),
    status: z.enum(["active", "inactive", "all"]).default("active"),
  })
  .strict();

export const createStaffRequestSchema = z
  .object({
    displayName: z.string().trim().min(1, "Name is required.").max(120),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(12, "Use at least 12 characters.").max(128),
    role: roleSchema,
  })
  .strict();

export const updateStaffRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one staff change.",
  });

export type StaffMember = z.infer<typeof staffMemberSchema>;
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
export type StaffListResponse = z.infer<typeof staffListResponseSchema>;
export type StaffResponse = z.infer<typeof staffResponseSchema>;
export type CreateStaffRequest = z.infer<typeof createStaffRequestSchema>;
export type UpdateStaffRequest = z.infer<typeof updateStaffRequestSchema>;
