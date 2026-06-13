import { z } from "@hono/zod-openapi";

import type { AppBindings } from "@/config/types";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodType } from "zod";

export const serviceErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  })
  .openapi("ServiceError");

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: serviceErrorSchema,
  })
  .openapi("ErrorResponse");

export function createSuccessResponseSchema<DataSchema extends ZodType>(dataSchema: DataSchema) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export function jsonSuccess<Data, Status extends ContentfulStatusCode>(
  context: Context<AppBindings>,
  data: Data,
  status: Status,
) {
  return context.json(
    {
      success: true as const,
      data,
    },
    status,
  );
}

export function errorResponse(
  code: string,
  message: string,
  retryable: boolean,
  status: ContentfulStatusCode,
) {
  return Response.json(
    {
      success: false as const,
      error: {
        code,
        message,
        retryable,
      },
    },
    { status },
  );
}
