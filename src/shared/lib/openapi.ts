import { createRoute } from "@hono/zod-openapi";

import { errorResponseSchema } from "./http";

import type { RouteConfig } from "@hono/zod-openapi";

export function createErrorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: errorResponseSchema,
      },
    },
  } as const;
}

type ApiRouteOptions = RouteConfig & {
  errorResponses?: RouteConfig["responses"];
};

export function createApiRoute<const Route extends ApiRouteOptions>(route: Route) {
  const { responses, errorResponses = {}, ...routeConfig } = route;

  return createRoute({
    ...routeConfig,
    responses: {
      ...responses,
      ...errorResponses,
    },
  });
}
