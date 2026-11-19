import type {
  CreateTableRequest,
  TableListQuery,
  TableSessionListQuery,
  UpdateTableRequest,
} from "@restroflow/contracts";
import type { RequestHandler } from "express";

import { AppError } from "../../errors/app-error.js";
import type { TableServiceContract } from "./table.service.js";

export class TableController {
  constructor(private readonly service: TableServiceContract) {}

  private scope(req: Parameters<RequestHandler>[0]) {
    return req.restaurantAccess!;
  }

  listTables: RequestHandler = async (req, res) => {
    const tables = await this.service.listTables(
      this.scope(req).restaurantId,
      req.query as unknown as TableListQuery,
    );
    res.status(200).json({ tables });
  };

  getTable: RequestHandler = async (req, res) => {
    const table = await this.service.getTable(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ table });
  };

  createTable: RequestHandler = async (req, res) => {
    const table = await this.service.createTable(
      this.scope(req).restaurantId,
      req.body as CreateTableRequest,
    );
    res.status(201).json({ table });
  };

  updateTable: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const table = await this.service.updateTable(
      scope.restaurantId,
      req.params.id as string,
      req.body as UpdateTableRequest,
      scope.role,
    );
    res.status(200).json({ table });
  };

  deactivateTable: RequestHandler = async (req, res) => {
    const table = await this.service.deactivateTable(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ table });
  };

  openSession: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const session = await this.service.openSession(
      scope.restaurantId,
      req.params.id as string,
      scope.id,
    );
    res.status(201).json({ session });
  };

  listSessions: RequestHandler = async (req, res) => {
    const sessions = await this.service.listSessions(
      this.scope(req).restaurantId,
      req.params.id as string,
      req.query as unknown as TableSessionListQuery,
    );
    res.status(200).json({ sessions });
  };

  getSession: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const session = await this.service.getSession(
      scope.restaurantId,
      req.params.id as string,
    );
    if (scope.role === "CASHIER" && session.status !== "OPEN")
      throw new AppError(
        404,
        "TABLE_SESSION_NOT_FOUND",
        "Table session not found.",
      );
    res.status(200).json({ session });
  };

  closeSession: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const session = await this.service.closeSession(
      scope.restaurantId,
      req.params.id as string,
      scope.id,
    );
    res.status(200).json({ session });
  };

  getQrCode: RequestHandler = async (req, res) => {
    const qrCode = await this.service.getQrCode(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ qrCode });
  };

  rotateQrCode: RequestHandler = async (req, res) => {
    const qrCode = await this.service.rotateQrCode(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ qrCode });
  };
}
