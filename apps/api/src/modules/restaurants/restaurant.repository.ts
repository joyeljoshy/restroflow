import type { UpdateRestaurantRequest } from "@restroflow/contracts";

import type { PrismaClient } from "../../generated/prisma/client.js";

export type RestaurantRecord = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  taxName: string;
  taxRateBasisPoints: number;
  pricesIncludeTax: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface RestaurantRepository {
  findById(id: string): Promise<RestaurantRecord | null>;
  update(id: string, input: UpdateRestaurantRequest): Promise<RestaurantRecord>;
}

const restaurantSelection = {
  id: true,
  name: true,
  slug: true,
  address: true,
  phone: true,
  email: true,
  timezone: true,
  currency: true,
  taxName: true,
  taxRateBasisPoints: true,
  pricesIncludeTax: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaRestaurantRepository implements RestaurantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<RestaurantRecord | null> {
    return this.prisma.restaurant.findUnique({
      where: { id },
      select: restaurantSelection,
    });
  }

  update(
    id: string,
    input: UpdateRestaurantRequest,
  ): Promise<RestaurantRecord> {
    return this.prisma.restaurant.update({
      where: { id },
      data: input,
      select: restaurantSelection,
    });
  }
}
