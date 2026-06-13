import { HTTPException } from "hono/http-exception";

import { toServiceError } from "@/shared/errors/service-error";
import { errorResponse } from "@/shared/lib/http";

import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "./status-codes";

import type { AppBindings } from "./types";
import type { OpenAPIHonoOptions } from "@hono/zod-openapi";
import type { ErrorHandler, NotFoundHandler } from "hono";
import type { ZodError } from "zod";

function formatValidationError(error: ZodError): string {
  const issue = error.issues[0];

  if (!issue) {
    return "Invalid request";
  }

  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export const defaultValidationHook: OpenAPIHonoOptions<AppBindings>["defaultHook"] = (result) => {
  if (result.success) {
    return undefined;
  }

  return errorResponse("INVALID_BODY", formatValidationError(result.error), false, 400);
};

export const notFoundHandler: NotFoundHandler<AppBindings> = () =>
  errorResponse("NOT_FOUND", "Not found", false, NOT_FOUND);

export const onErrorHandler: ErrorHandler<AppBindings> = (error) => {
  if (
    error instanceof HTTPException &&
    error.status === 400 &&
    error.message === "Malformed JSON in request body"
  ) {
    return errorResponse("INVALID_JSON", error.message, false, 400);
  }

  const serviceError = toServiceError(error);

  if (serviceError.status === INTERNAL_SERVER_ERROR) {
    console.error("Unhandled image worker error");
  }

  return errorResponse(
    serviceError.code,
    serviceError.message,
    serviceError.retryable,
    serviceError.status,
  );
};
