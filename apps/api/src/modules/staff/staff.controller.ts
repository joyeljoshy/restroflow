import type {
  CreateStaffRequest,
  StaffListQuery,
  UpdateStaffRequest,
} from "@restroflow/contracts";
import type { RequestHandler } from "express";

import type { StaffServiceContract } from "./staff.service.js";

export class StaffController {
  constructor(private readonly service: StaffServiceContract) {}

  list: RequestHandler = async (req, res) => {
    const result = await this.service.list(
      req.params.restaurantId as string,
      req.query as StaffListQuery,
    );
    res.status(200).json(result);
  };

  create: RequestHandler = async (req, res) => {
    const staffMember = await this.service.create(
      req.params.restaurantId as string,
      req.body as CreateStaffRequest,
    );
    res.status(201).json({ staffMember });
  };

  update: RequestHandler = async (req, res) => {
    const staffMember = await this.service.update(
      req.params.restaurantId as string,
      req.params.staffId as string,
      req.body as UpdateStaffRequest,
    );
    res.status(200).json({ staffMember });
  };
}
