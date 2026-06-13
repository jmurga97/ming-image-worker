import { drizzle } from "drizzle-orm/d1";

import { getOrCreateInstance } from "@/shared/lib/instance-cache";

import * as schema from "./schema";

export * from "./schema";

export function createDb(client: D1Database) {
  return drizzle(client, { schema });
}

export type AppDb = ReturnType<typeof createDb>;

const instances = new WeakMap<D1Database, AppDb>();

export function getDb(client: D1Database): AppDb {
  return getOrCreateInstance(instances, client, () => createDb(client));
}
