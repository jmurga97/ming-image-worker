import { OpenAPIHono } from "@hono/zod-openapi";

import { defaultValidationHook } from "@/config/handlers";

import type { AppBindings } from "@/config/types";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook: defaultValidationHook,
  });
}
