import { z } from "zod";

const trimmedString = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const identifierSchema = z.uuid();
export const menuEntityParamsSchema = z.object({ id: identifierSchema });
export const modifierParamsSchema = z.object({
  groupId: identifierSchema,
  modifierId: identifierSchema,
});
export const modifierGroupParamsSchema = z.object({
  groupId: identifierSchema,
});

export const menuCategorySchema = z.object({
  id: identifierSchema,
  name: trimmedString(1, 100),
  description: z.string().max(500).nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createMenuCategoryRequestSchema = z.object({
  name: trimmedString(1, 100),
  description: trimmedString(1, 500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
  isActive: z.boolean().default(true),
});
export const updateMenuCategoryRequestSchema = createMenuCategoryRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one category field is required.",
  });
export const menuCategoryListQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
});

export const modifierSchema = z.object({
  id: identifierSchema,
  name: trimmedString(1, 100),
  priceDeltaMinor: z.number().int(),
  isAvailable: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const modifierGroupSchema = z.object({
  id: identifierSchema,
  name: trimmedString(1, 100),
  minSelections: z.number().int().nonnegative(),
  maxSelections: z.number().int().positive(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  modifiers: z.array(modifierSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const selectionLimitsSchema = z
  .object({
    minSelections: z.number().int().min(0).max(50),
    maxSelections: z.number().int().min(1).max(50),
  })
  .refine((value) => value.minSelections <= value.maxSelections, {
    message: "Minimum selections cannot exceed maximum selections.",
    path: ["maxSelections"],
  });
export const createModifierGroupRequestSchema = z
  .object({ name: trimmedString(1, 100), isActive: z.boolean().default(true) })
  .and(selectionLimitsSchema);
export const updateModifierGroupRequestSchema = z
  .object({
    name: trimmedString(1, 100).optional(),
    minSelections: z.number().int().min(0).max(50).optional(),
    maxSelections: z.number().int().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one modifier group field is required.",
  });
export const modifierGroupListQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
});
export const createModifierRequestSchema = z.object({
  name: trimmedString(1, 100),
  // Part 4 supports add-on surcharges only. Discounts remain an order/pricing concern.
  priceDeltaMinor: z.number().int().min(0).max(10_000_000),
  isAvailable: z.boolean().default(true),
});
export const updateModifierRequestSchema = createModifierRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one modifier field is required.",
  });

export const menuItemModifierGroupSchema = z.object({
  sortOrder: z.number().int(),
  group: modifierGroupSchema,
});
export const menuItemSchema = z.object({
  id: identifierSchema,
  categoryId: identifierSchema,
  name: trimmedString(1, 120),
  description: z.string().max(1000).nullable(),
  priceMinor: z.number().int().nonnegative(),
  imageUrl: z.string().max(2048).nullable(),
  isAvailable: z.boolean(),
  isEffectivelyAvailable: z.boolean(),
  isVegetarian: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  category: menuCategorySchema,
  modifierGroups: z.array(menuItemModifierGroupSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const imageReferenceSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value.startsWith("https://") || value.startsWith("/uploads/menu/"),
    "Use an HTTPS URL or a RestroFlow menu upload reference.",
  );
export const createMenuItemRequestSchema = z.object({
  categoryId: identifierSchema,
  name: trimmedString(1, 120),
  description: trimmedString(1, 1000).nullable().optional(),
  priceMinor: z.number().int().min(0).max(1_000_000_000),
  imageUrl: imageReferenceSchema.nullable().optional(),
  isAvailable: z.boolean().default(true),
  isVegetarian: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
});
export const updateMenuItemRequestSchema = createMenuItemRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one menu item field is required.",
  });
export const updateMenuItemAvailabilityRequestSchema = z.object({
  isAvailable: z.boolean(),
});
export const menuItemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  search: z.string().trim().max(100).optional(),
  categoryId: identifierSchema.optional(),
  availability: z.enum(["all", "available", "unavailable"]).default("all"),
  status: z.enum(["active", "inactive", "all"]).default("active"),
});
export const assignModifierGroupsRequestSchema = z.object({
  assignments: z
    .array(
      z.object({
        modifierGroupId: identifierSchema,
        sortOrder: z.number().int().min(0).max(100_000),
      }),
    )
    .max(50)
    .refine(
      (assignments) =>
        new Set(assignments.map((item) => item.modifierGroupId)).size ===
        assignments.length,
      "Modifier groups cannot be assigned more than once.",
    ),
});

export const menuCategoryResponseSchema = z.object({
  category: menuCategorySchema,
});
export const menuCategoryListResponseSchema = z.object({
  categories: z.array(menuCategorySchema),
});
export const menuItemResponseSchema = z.object({ item: menuItemSchema });
export const menuItemListResponseSchema = z.object({
  items: z.array(menuItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export const modifierGroupResponseSchema = z.object({
  group: modifierGroupSchema,
});
export const modifierGroupListResponseSchema = z.object({
  groups: z.array(modifierGroupSchema),
});
export const modifierResponseSchema = z.object({ modifier: modifierSchema });
export const menuImageResponseSchema = z.object({
  imageUrl: imageReferenceSchema,
});

// This intentionally excludes management flags. A future QR route can reuse it
// without exposing internal lifecycle state or accepting customer commands.
export const publicModifierSchema = modifierSchema.pick({
  id: true,
  name: true,
  priceDeltaMinor: true,
});
export const publicModifierGroupSchema = modifierGroupSchema
  .pick({
    id: true,
    name: true,
    minSelections: true,
    maxSelections: true,
    isRequired: true,
  })
  .extend({ modifiers: z.array(publicModifierSchema) });
export const publicMenuCategorySchema = menuCategorySchema.pick({
  id: true,
  name: true,
  description: true,
  sortOrder: true,
});
export const publicMenuItemSchema = menuItemSchema
  .pick({
    id: true,
    categoryId: true,
    name: true,
    description: true,
    priceMinor: true,
    imageUrl: true,
    isVegetarian: true,
    sortOrder: true,
  })
  .extend({
    modifierGroups: z.array(
      z.object({
        sortOrder: z.number().int(),
        group: publicModifierGroupSchema,
      }),
    ),
  });
export const publicMenuResponseSchema = z.object({
  categories: z.array(publicMenuCategorySchema),
  items: z.array(publicMenuItemSchema),
});

export type MenuCategory = z.infer<typeof menuCategorySchema>;
export type CreateMenuCategoryRequest = z.infer<
  typeof createMenuCategoryRequestSchema
>;
export type UpdateMenuCategoryRequest = z.infer<
  typeof updateMenuCategoryRequestSchema
>;
export type MenuItem = z.infer<typeof menuItemSchema>;
export type CreateMenuItemRequest = z.infer<typeof createMenuItemRequestSchema>;
export type UpdateMenuItemRequest = z.infer<typeof updateMenuItemRequestSchema>;
export type MenuItemListQuery = z.infer<typeof menuItemListQuerySchema>;
export type MenuItemListResponse = z.infer<typeof menuItemListResponseSchema>;
export type Modifier = z.infer<typeof modifierSchema>;
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type CreateModifierGroupRequest = z.infer<
  typeof createModifierGroupRequestSchema
>;
export type UpdateModifierGroupRequest = z.infer<
  typeof updateModifierGroupRequestSchema
>;
export type CreateModifierRequest = z.infer<typeof createModifierRequestSchema>;
export type UpdateModifierRequest = z.infer<typeof updateModifierRequestSchema>;
export type AssignModifierGroupsRequest = z.infer<
  typeof assignModifierGroupsRequestSchema
>;
export type PublicMenuCategory = z.infer<typeof publicMenuCategorySchema>;
export type PublicMenuItem = z.infer<typeof publicMenuItemSchema>;
