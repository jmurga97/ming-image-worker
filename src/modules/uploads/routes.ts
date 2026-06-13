import { createRouter } from "@/app/create-router";

import { createUploadRoute } from "./routes/create-upload";
import { createGetUploadRoute } from "./routes/get-upload";
import { createRetryUploadRoute } from "./routes/retry-upload";

import type { UploadsService } from "./services/uploads.service";
import type { AppBindings } from "@/config/types";
import type { Context } from "hono";

export function createUploadRoutes(getService: (context: Context<AppBindings>) => UploadsService) {
  return createRouter()
    .route("/", createUploadRoute(getService))
    .route("/", createGetUploadRoute(getService))
    .route("/", createRetryUploadRoute(getService));
}
