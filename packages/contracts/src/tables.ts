import { z } from "zod";

const identifierSchema = z.uuid();
const trimmedString = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const tableParamsSchema = z.object({ id: identifierSchema });

export const tableSessionStaffSchema = z.object({
  id: identifierSchema,
  displayName: trimmedString(1, 120),
});

export const tableSessionSchema = z.object({
  id: identifierSchema,
  tableId: identifierSchema,
  status: z.enum(["OPEN", "CLOSED"]),
  openedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
  openedBy: tableSessionStaffSchema,
  closedBy: tableSessionStaffSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const restaurantTableSchema = z.object({
  id: identifierSchema,
  tableNumber: trimmedString(1, 30),
  displayName: trimmedString(1, 100),
  capacity: z.number().int().positive(),
  isActive: z.boolean(),
  occupancy: z.enum(["AVAILABLE", "OCCUPIED", "OUT_OF_SERVICE"]),
  activeSession: tableSessionSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createTableRequestSchema = z
  .object({
    tableNumber: trimmedString(1, 30),
    displayName: trimmedString(1, 100),
    capacity: z.number().int().min(1).max(1_000),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateTableRequestSchema = z
  .object({
    tableNumber: trimmedString(1, 30).optional(),
    displayName: trimmedString(1, 100).optional(),
    capacity: z.number().int().min(1).max(1_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one table field is required.",
  });

export const tableListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  occupancy: z
    .enum(["all", "available", "occupied", "out_of_service"])
    .default("all"),
});

export const tableSessionListQuerySchema = z.object({
  status: z.enum(["all", "open", "closed"]).default("all"),
});

export const tableResponseSchema = z.object({ table: restaurantTableSchema });
export const tableListResponseSchema = z.object({
  tables: z.array(restaurantTableSchema),
});
export const tableSessionResponseSchema = z.object({
  session: tableSessionSchema,
});
export const tableSessionListResponseSchema = z.object({
  sessions: z.array(tableSessionSchema),
});
export const tableQrCodeSchema = z.object({
  qrIdentifier: trimmedString(32, 64),
  targetUrl: z.url(),
  svg: z.string().min(1),
  fileName: trimmedString(1, 160),
});
export const tableQrCodeResponseSchema = z.object({
  qrCode: tableQrCodeSchema,
});

export type RestaurantTable = z.infer<typeof restaurantTableSchema>;
export type TableSession = z.infer<typeof tableSessionSchema>;
export type CreateTableRequest = z.infer<typeof createTableRequestSchema>;
export type UpdateTableRequest = z.infer<typeof updateTableRequestSchema>;
export type TableListQuery = z.infer<typeof tableListQuerySchema>;
export type TableSessionListQuery = z.infer<typeof tableSessionListQuerySchema>;
export type TableQrCode = z.infer<typeof tableQrCodeSchema>;
