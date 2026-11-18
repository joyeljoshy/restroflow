import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type RequestSchemas = Partial<Record<"body" | "params" | "query", ZodType>>;

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (schema) {
        Object.defineProperty(req, key, {
          value: schema.parse(req[key]),
          writable: true,
        });
      }
    }
    next();
  };
}
