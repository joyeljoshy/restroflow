import { z } from "zod";

const optionalContactField = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null)
    .nullable();

export const restaurantIdParamsSchema = z.object({
  restaurantId: z.uuid(),
});

export const restaurantSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.email().nullable(),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  taxName: z.string().min(1),
  taxRateBasisPoints: z.number().int().min(0).max(10_000),
  pricesIncludeTax: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const restaurantResponseSchema = z.object({
  restaurant: restaurantSchema,
});

export const updateRestaurantRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Restaurant name is required.").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(80)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and single hyphens.",
      ),
    address: optionalContactField(500),
    phone: optionalContactField(40),
    email: z
      .union([z.literal(""), z.email("Enter a valid contact email.")])
      .transform((value) => value || null)
      .nullable(),
    timezone: z.string().trim().min(1).max(100),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
    taxName: z.string().trim().min(1, "Tax name is required.").max(40),
    taxRateBasisPoints: z.number().int().min(0).max(10_000),
    pricesIncludeTax: z.boolean(),
  })
  .strict();

export type Restaurant = z.infer<typeof restaurantSchema>;
export type RestaurantResponse = z.infer<typeof restaurantResponseSchema>;
export type UpdateRestaurantRequest = z.infer<
  typeof updateRestaurantRequestSchema
>;
