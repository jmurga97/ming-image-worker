import { notFoundHandler, onErrorHandler } from "@/config/handlers";
import { parseRuntimeConfig } from "@/config/runtime";
import { createUploadsService } from "@/modules/uploads/factory";

import { createRouter } from "./create-router";
import { registerRoutes } from "./routes";

import type { AppBindings } from "@/config/types";
import type { UploadsService } from "@/modules/uploads/services/uploads.service";
import type { Context } from "hono";

export interface AppDependencies {
  getUploadsService?: (context: Context<AppBindings>) => UploadsService;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = createRouter();
  const getUploadsService =
    dependencies.getUploadsService ??
    ((context: Context<AppBindings>) =>
      createUploadsService(context.env, context.get("runtimeConfig")));

  app.use("*", async (context, next) => {
    context.set("runtimeConfig", parseRuntimeConfig(context.env));
    await next();
  });

  app.get("/health", (context) =>
    context.json({
      success: true as const,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    }),
  );

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "Ming Image Worker",
      version: "1.0.0",
      description: "Private multi-product image upload and optimization service",
    },
  });

  registerRoutes(app, getUploadsService);
  app.notFound(notFoundHandler);
  app.onError(onErrorHandler);

  return app;
}
