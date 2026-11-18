import type { ErrorRequestHandler } from "express";
import { ZodError, z } from "zod";

import { AppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const errorValue: unknown = error;
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request did not pass validation.",
        requestId: req.id,
        details: z.flattenError(error),
      },
    });
    return;
  }

  if (
    typeof errorValue === "object" &&
    errorValue !== null &&
    "status" in errorValue &&
    errorValue.status === 413
  ) {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body exceeds the allowed size.",
        requestId: req.id,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId: req.id,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  req.log.error({ err: error }, "Unhandled request error");
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      requestId: req.id,
    },
  });
};
