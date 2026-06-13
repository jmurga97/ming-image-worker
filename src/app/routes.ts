import { createUploadRoutes } from "@/modules/uploads/routes";

import type { App, AppBindings } from "@/config/types";
import type { UploadsService } from "@/modules/uploads/services/uploads.service";
import type { Context } from "hono";

export function registerRoutes(
  app: App,
  getUploadsService: (context: Context<AppBindings>) => UploadsService,
) {
  app.route("/v1/uploads", createUploadRoutes(getUploadsService));
}
