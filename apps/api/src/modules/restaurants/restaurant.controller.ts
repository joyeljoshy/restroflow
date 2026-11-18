import type { UpdateRestaurantRequest } from "@restroflow/contracts";
import type { RequestHandler } from "express";

import type { RestaurantServiceContract } from "./restaurant.service.js";

export class RestaurantController {
  constructor(private readonly service: RestaurantServiceContract) {}

  get: RequestHandler = async (req, res) => {
    const restaurant = await this.service.get(
      req.params.restaurantId as string,
    );
    res.status(200).json({ restaurant });
  };

  update: RequestHandler = async (req, res) => {
    const restaurant = await this.service.update(
      req.params.restaurantId as string,
      req.body as UpdateRestaurantRequest,
    );
    res.status(200).json({ restaurant });
  };
}
