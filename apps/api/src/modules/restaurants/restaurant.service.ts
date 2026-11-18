import type {
  Restaurant,
  UpdateRestaurantRequest,
} from "@restroflow/contracts";

import { AppError } from "../../errors/app-error.js";
import type {
  RestaurantRecord,
  RestaurantRepository,
} from "./restaurant.repository.js";

export interface RestaurantServiceContract {
  get(restaurantId: string): Promise<Restaurant>;
  update(
    restaurantId: string,
    input: UpdateRestaurantRequest,
  ): Promise<Restaurant>;
}

function toRestaurant(record: RestaurantRecord): Restaurant {
  return {
    ...record,
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

export class RestaurantService implements RestaurantServiceContract {
  constructor(private readonly repository: RestaurantRepository) {}

  async get(restaurantId: string): Promise<Restaurant> {
    const restaurant = await this.repository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found.");
    }
    return toRestaurant(restaurant);
  }

  async update(
    restaurantId: string,
    input: UpdateRestaurantRequest,
  ): Promise<Restaurant> {
    try {
      return toRestaurant(await this.repository.update(restaurantId, input));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          409,
          "RESTAURANT_SLUG_CONFLICT",
          "That restaurant slug is already in use.",
        );
      }
      throw error;
    }
  }
}
