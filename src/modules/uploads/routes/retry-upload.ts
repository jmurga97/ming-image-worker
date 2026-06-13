import { createRouter } from "@/app/create-router";
import { CONFLICT, FORBIDDEN, NOT_FOUND, OK } from "@/config/status-codes";
import { jsonSuccess } from "@/shared/lib/http";
import { createApiRoute, createErrorResponse } from "@/shared/lib/openapi";

import { productQuerySchema, uploadIdParamsSchema, uploadResultResponseSchema } from "../schemas";

import type { UploadsService } from "../services/uploads.service";
import type { AppBindings } from "@/config/types";
import type { Context } from "hono";

const route = createApiRoute({
  method: "post",
  path: "/{uploadId}/retry",
  tags: ["Uploads"],
  request: {
    query: productQuerySchema,
    params: uploadIdParamsSchema,
  },
  errorResponses: {
    [FORBIDDEN]: createErrorResponse("Product is not allowed"),
    [NOT_FOUND]: createErrorResponse("Upload job was not found"),
    [CONFLICT]: createErrorResponse("Upload cannot be retried"),
  },
  responses: {
    [OK]: {
      description: "Retry a failed upload job",
      content: {
        "application/json": {
          schema: uploadResultResponseSchema,
        },
      },
    },
  },
});

export function createRetryUploadRoute(
  getService: (context: Context<AppBindings>) => UploadsService,
) {
  return createRouter().openapi(route, async (context) => {
    const { productId } = context.req.valid("query");
    const { uploadId } = context.req.valid("param");
    const result = await getService(context).retryUpload(productId, uploadId);

    return jsonSuccess(context, result, OK);
  });
}
