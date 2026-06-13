import { createRouter } from "@/app/create-router";
import {
  BAD_REQUEST,
  CONFLICT,
  CREATED,
  FORBIDDEN,
  PAYLOAD_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE,
} from "@/config/status-codes";
import { jsonSuccess } from "@/shared/lib/http";
import { createErrorResponse, createApiRoute } from "@/shared/lib/openapi";

import {
  createUploadRequestSchema,
  idempotencyHeadersSchema,
  productQuerySchema,
  signedUploadResponseSchema,
} from "../schemas";

import type { UploadsService } from "../services/uploads.service";
import type { AppBindings } from "@/config/types";
import type { Context } from "hono";

const route = createApiRoute({
  method: "post",
  path: "/",
  tags: ["Uploads"],
  request: {
    query: productQuerySchema,
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: createUploadRequestSchema,
        },
      },
    },
  },
  errorResponses: {
    [BAD_REQUEST]: createErrorResponse("Invalid upload request"),
    [FORBIDDEN]: createErrorResponse("Product or preset is not allowed"),
    [CONFLICT]: createErrorResponse("Idempotency conflict"),
    [PAYLOAD_TOO_LARGE]: createErrorResponse("Upload exceeds configured limit"),
    [UNSUPPORTED_MEDIA_TYPE]: createErrorResponse("Unsupported image type"),
  },
  responses: {
    [CREATED]: {
      description: "Create an image upload job and presigned R2 PUT URL",
      content: {
        "application/json": {
          schema: signedUploadResponseSchema,
        },
      },
    },
  },
});

export function createUploadRoute(getService: (context: Context<AppBindings>) => UploadsService) {
  return createRouter().openapi(route, async (context) => {
    const { productId } = context.req.valid("query");
    const headers = context.req.valid("header");
    const input = context.req.valid("json");
    const result = await getService(context).createUpload(
      productId,
      headers["idempotency-key"],
      input,
    );

    return jsonSuccess(context, result, CREATED);
  });
}
