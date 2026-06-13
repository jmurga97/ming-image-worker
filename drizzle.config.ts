import { defineConfig } from "drizzle-kit";

function readEnv(name: string): string {
  return process.env[name] ?? "";
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: readEnv("CLOUDFLARE_ACCOUNT_ID"),
    databaseId: readEnv("CLOUDFLARE_DATABASE_ID"),
    token: readEnv("CLOUDFLARE_D1_TOKEN"),
  },
  verbose: true,
  strict: true,
});
